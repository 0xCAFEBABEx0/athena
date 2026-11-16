// Small formatting helpers for the CMS's own admin components.

const STEPS: [number, string][] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [30, 'day'],
  [12, 'month'],
]

/** "3 minutes ago" for an ISO date, English like the rest of the admin. */
export const timeAgo = (iso: string | null | undefined, now: number = Date.now()): string => {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  let value = Math.max(1, Math.round((now - then) / 1000))
  for (const [size, unit] of STEPS) {
    if (value < size) return `${value} ${unit}${value === 1 ? '' : 's'} ago`
    value = Math.round(value / size)
  }
  return `${value} year${value === 1 ? '' : 's'} ago`
}

type ImageVariant = { url?: string | null } | null | undefined
type MediaLike = {
  url?: string | null
  // Payload 3 names generated image sizes `sizes`; Payload 4 renames them
  // `variants`. Reading both keeps the admin thumbnails working across 4.0.
  sizes?: Record<string, ImageVariant> | null
  variants?: Record<string, ImageVariant> | null
}

/** The smallest useful image URL for a media document, or undefined. */
export const thumbnailURL = (media: unknown): string | undefined => {
  if (!media || typeof media !== 'object') return undefined
  const m = media as MediaLike
  return m.variants?.thumbnail?.url || m.sizes?.thumbnail?.url || m.url || undefined
}

/** Draft or Published, from a document's _status (missing means published: no drafts). */
export const publishState = (status: unknown): 'draft' | 'published' =>
  status === 'draft' ? 'draft' : 'published'
