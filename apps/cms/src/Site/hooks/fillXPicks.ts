import type { GlobalBeforeChangeHook } from 'payload'

import { APIError } from 'payload'

import { fetchXPost, normalizeXUrl, type XPost } from '../../x/oembed'

type Pick = {
  id?: string | null
  url?: string | null
  text?: string | null
  authorName?: string | null
  authorHandle?: string | null
  postedAt?: string | null
  lang?: string | null
  [key: string]: unknown
}

/**
 * Fills the X picks from X's oEmbed endpoint when a pick is new, its link
 * changed or its text was cleared. Text the editor wrote stays as it is, so a
 * post X no longer serves can be kept by typing it in.
 */
export const fillXPicks =
  (
    lookup: (url: string) => Promise<XPost | null> = (url) => fetchXPost(url),
  ): GlobalBeforeChangeHook =>
  async ({ data, originalDoc }) => {
    const picks = (data as { picks?: Pick[] | null }).picks
    if (!Array.isArray(picks) || picks.length === 0) return data

    const before = new Map<string, string>()
    for (const old of ((originalDoc as { picks?: Pick[] | null } | undefined)?.picks ??
      []) as Pick[]) {
      if (old.id && old.url) before.set(old.id, normalizeXUrl(old.url) ?? old.url)
    }

    const filled = await Promise.all(
      picks.map(async (pick) => {
        const url = normalizeXUrl(pick.url)
        if (!url) return pick
        const moved = Boolean(pick.id && before.has(pick.id) && before.get(pick.id) !== url)
        const next: Pick = { ...pick, url }
        if (!moved && next.text?.trim()) return next

        const post = await lookup(url)
        if (!post) {
          if (moved) next.text = ''
          if (next.text?.trim()) return next
          throw new APIError(
            `Could not read ${url} from X. Check that the post is public, or fill in Text and Author yourself.`,
            400,
            undefined,
            true,
          )
        }
        return {
          ...next,
          text: post.text,
          authorName: moved || !next.authorName ? post.authorName : next.authorName,
          authorHandle: moved || !next.authorHandle ? post.authorHandle : next.authorHandle,
          postedAt: moved || !next.postedAt ? post.postedAt : next.postedAt,
          lang: moved || !next.lang ? post.lang : next.lang,
        }
      }),
    )

    return { ...data, picks: filled }
  }
