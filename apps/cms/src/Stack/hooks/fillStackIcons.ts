import type { GlobalBeforeChangeHook, PayloadRequest } from 'payload'

import sharp from 'sharp'

import {
  fetchFavicon,
  ICON_SIZE,
  LOOKUP_BUDGET_MS,
  publicHost,
  withinDeadline,
  type Favicon,
} from '@/Stack/favicon'

type Item = {
  id?: string | null
  name?: string | null
  url?: string | null
  icon?: number | string | { id: number | string } | null
  [key: string]: unknown
}
type Group = { id?: string | null; items?: Item[] | null; [key: string]: unknown }

/** Sites looked up at once. */
const LOOKUP_CONCURRENCY = 4
/**
 * Time for all of a save's lookups together (DNS included), then for storing
 * the icons found. The API function may run 60 s; what is left over is the
 * save itself. A site not looked up or not stored in time gets no icon now
 * and is tried again on the next save.
 */
export const SAVE_LOOKUP_BUDGET_MS = 25_000
export const SAVE_STORE_BUDGET_MS = 15_000

/** `task` over `items`, at most `limit` at a time, results in input order. */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const iconId = (icon: Item['icon']): number | string | null =>
  icon && typeof icon === 'object' ? icon.id : (icon ?? null)

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** True when the filename is the one `saveFavicon` gives this host's icon (Payload may add `-1`). */
export const isFetchedIconOf = (filename: string | null | undefined, host: string): boolean =>
  Boolean(filename) &&
  new RegExp(`^favicon-${escapeRegExp(host)}(-\\d+)?\\.png$`).test(filename ?? '')

/** The Media filename of an icon, or null when it cannot be read. */
export const mediaFilename = async (
  req: PayloadRequest,
  id: number | string,
): Promise<string | null> => {
  try {
    const doc = await req.payload.findByID({ collection: 'media', id, depth: 0, req })
    return doc.filename ?? null
  } catch {
    return null
  }
}

/** Any image sharp can read, as a transparent 64×64 PNG. */
export const toPng = async (image: Uint8Array): Promise<Buffer | null> => {
  try {
    // A small file can still declare a huge canvas (an SVG especially): cap
    // the decoded size and the time libvips may spend on it.
    return await sharp(image, { density: 192, failOn: 'error', limitInputPixels: 4096 * 4096 })
      .timeout({ seconds: 5 })
      .resize(ICON_SIZE, ICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

/**
 * Stores the icon in Media once per host (`favicon-<host>.png`) and returns
 * its id. Runs outside the save's transaction (no `req`): a failed upload
 * must not abort the Stack save, and a stored icon is reused next time even
 * if the save itself fails.
 */
export const saveFavicon = async (req: PayloadRequest, icon: Favicon): Promise<number | string> => {
  const filename = `favicon-${icon.host}.png`
  const existing = await req.payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })
  const found = existing.docs[0]
  if (found) return found.id
  const created = await req.payload.create({
    collection: 'media',
    data: { alt: '' },
    file: { data: icon.data, mimetype: 'image/png', name: filename, size: icon.data.byteLength },
  })
  return created.id
}

/**
 * Fills the icon of each Stack item that has a link but no icon, from the
 * site's favicon. An icon picked by hand stays; changing an item's link to
 * another site replaces the icon fetched for the old one. A site without a
 * readable icon is not an error: the web app shows the name's initials.
 */
export const fillStackIcons =
  (
    lookup: (url: string, budgetMs: number) => Promise<Favicon | null> = (url, budgetMs) =>
      fetchFavicon(url, toPng, fetch, { budgetMs: Math.min(budgetMs, LOOKUP_BUDGET_MS) }),
    save: (req: PayloadRequest, icon: Favicon) => Promise<number | string> = saveFavicon,
    filenameOf: (
      req: PayloadRequest,
      id: number | string,
    ) => Promise<string | null> = mediaFilename,
    budgets: { lookupMs: number; storeMs: number } = {
      lookupMs: SAVE_LOOKUP_BUDGET_MS,
      storeMs: SAVE_STORE_BUDGET_MS,
    },
  ): GlobalBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const groups = (data as { groups?: Group[] | null }).groups
    if (!Array.isArray(groups) || groups.length === 0) return data
    const lookupUntil = Date.now() + budgets.lookupMs

    const before = new Map<string, { host: string | null; icon: number | string | null }>()
    for (const group of ((originalDoc as { groups?: Group[] | null } | undefined)?.groups ??
      []) as Group[]) {
      for (const old of group.items ?? []) {
        if (old.id) before.set(old.id, { host: publicHost(old.url), icon: iconId(old.icon) })
      }
    }

    // Decide which items need an icon, then look each site up once (a few
    // at a time, all within one shared deadline) and store the icons one by one.
    const plan = await Promise.all(
      groups.map((group) =>
        Promise.all(
          (group.items ?? []).map(async (item) => {
            const host = publicHost(item.url)
            const old = item.id ? before.get(item.id) : undefined
            let icon = iconId(item.icon)
            // The link moved to another site (or was removed) and the icon is
            // still the one fetched for the old site; a hand-picked one stays.
            if (
              icon &&
              old?.host &&
              old.host !== host &&
              old.icon === icon &&
              // An unanswered Media read counts as hand-picked: the icon stays.
              isFetchedIconOf(await withinDeadline(filenameOf(req, icon), lookupUntil), old.host)
            ) {
              icon = null
            }
            return { item, host, icon, fetch: !icon && Boolean(host) }
          }),
        ),
      ),
    )
    const wanted = new Map<string, string>()
    for (const entry of plan.flat()) {
      if (entry.fetch && entry.host && !wanted.has(entry.host))
        wanted.set(entry.host, entry.item.url ?? '')
    }
    const found = new Map<string, Favicon | null>(
      await mapLimit([...wanted], LOOKUP_CONCURRENCY, async ([host, url]) => {
        const left = lookupUntil - Date.now()
        if (left <= 0) return [host, null] as const
        try {
          // The lookup keeps its own budget; this bounds anything it still waits on.
          return [host, await withinDeadline(lookup(url, left), lookupUntil)] as const
        } catch (error) {
          req.payload.logger.warn(`Stack: no icon for ${host}: ${String(error)}`)
          return [host, null] as const
        }
      }),
    )
    const saved = new Map<string, number | string | null>()
    const storeUntil = Date.now() + budgets.storeMs
    for (const [host, favicon] of found) {
      if (!favicon) continue
      if (Date.now() >= storeUntil) {
        req.payload.logger.warn(
          `Stack: out of time, the icon for ${host} is stored on a later save`,
        )
        continue
      }
      try {
        // An upload still running at the deadline is left to finish on its
        // own: it only adds `favicon-<host>.png` to Media, which the next save
        // finds and reuses.
        const id = await withinDeadline(save(req, favicon), storeUntil)
        if (id === null) {
          req.payload.logger.warn(
            `Stack: out of time, the icon for ${host} is stored on a later save`,
          )
          continue
        }
        saved.set(host, id)
      } catch (error) {
        req.payload.logger.warn(`Stack: could not store the icon for ${host}: ${String(error)}`)
      }
    }

    const filled = groups.map((group, g) => ({
      ...group,
      items: (plan[g] ?? []).map(({ item, host, icon, fetch }) => ({
        ...item,
        icon: fetch && host ? (saved.get(host) ?? null) : icon,
      })),
    }))

    return { ...data, groups: filled }
  }
