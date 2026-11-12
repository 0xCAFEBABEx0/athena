import type { GlobalBeforeChangeHook, PayloadRequest } from 'payload'

import sharp from 'sharp'

import { fetchFavicon, ICON_SIZE, publicHost, type Favicon } from '../favicon'

type Item = {
  id?: string | null
  name?: string | null
  url?: string | null
  icon?: number | string | { id: number | string } | null
  [key: string]: unknown
}
type Group = { id?: string | null; items?: Item[] | null; [key: string]: unknown }

const iconId = (icon: Item['icon']): number | string | null =>
  icon && typeof icon === 'object' ? icon.id : (icon ?? null)

/** Any image sharp can read, as a transparent 64×64 PNG. */
export const toPng = async (image: Uint8Array): Promise<Buffer | null> => {
  try {
    return await sharp(image, { density: 192, failOn: 'error' })
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
    lookup: (url: string) => Promise<Favicon | null> = (url) => fetchFavicon(url, toPng),
    save: (req: PayloadRequest, icon: Favicon) => Promise<number | string> = saveFavicon,
  ): GlobalBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const groups = (data as { groups?: Group[] | null }).groups
    if (!Array.isArray(groups) || groups.length === 0) return data

    const before = new Map<string, { host: string | null; icon: number | string | null }>()
    for (const group of ((originalDoc as { groups?: Group[] | null } | undefined)?.groups ??
      []) as Group[]) {
      for (const old of group.items ?? []) {
        if (old.id) before.set(old.id, { host: publicHost(old.url), icon: iconId(old.icon) })
      }
    }

    // Decide which items need an icon, then look each site up once (in
    // parallel) and store the icons one at a time.
    const plan = groups.map((group) =>
      (group.items ?? []).map((item) => {
        const host = publicHost(item.url)
        const old = item.id ? before.get(item.id) : undefined
        let icon = iconId(item.icon)
        // The link moved to another site and the icon is still the one fetched for the old site.
        if (icon && old && old.host !== host && old.icon === icon) icon = null
        return { item, host, icon, fetch: !icon && Boolean(host) }
      }),
    )
    const wanted = new Map<string, string>()
    for (const entry of plan.flat()) {
      if (entry.fetch && entry.host && !wanted.has(entry.host))
        wanted.set(entry.host, entry.item.url ?? '')
    }
    const found = new Map<string, Favicon | null>(
      await Promise.all(
        [...wanted].map(async ([host, url]) => {
          try {
            return [host, await lookup(url)] as const
          } catch (error) {
            req.payload.logger.warn(`Stack: no icon for ${host}: ${String(error)}`)
            return [host, null] as const
          }
        }),
      ),
    )
    const saved = new Map<string, number | string | null>()
    for (const [host, favicon] of found) {
      if (!favicon) continue
      try {
        saved.set(host, await save(req, favicon))
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
