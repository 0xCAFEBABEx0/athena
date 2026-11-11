import type { Post } from '@athena/shared/payload-types'

/** YYYY-MM-DD in Japan time (the site's audience), e.g. 2026-11-10. */
export const formatDate = (timestamp: string | null | undefined): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** 'A', 'A, B' — author names joined for a metadata line. */
export const formatAuthors = (
  authors: NonNullable<NonNullable<Post['populatedAuthors']>[number]>[],
): string =>
  authors
    .map((author) => author.name)
    .filter(Boolean)
    .join(', ')

/** Category titles of a post or search doc, skipping unpopulated ids. */
export const categoryTitles = (categories: unknown): string[] =>
  Array.isArray(categories)
    ? categories
        .filter(
          (category): category is { title?: string | null } =>
            typeof category === 'object' && category !== null,
        )
        .map((category) => category.title || '')
        .filter(Boolean)
    : []

/** Rough reading time for Japanese/English text: ~500 chars or ~200 words a minute. */
export const readingMinutes = (text: string): number => {
  const cjk = (text.match(/[　-鿿＀-￯]/g) ?? []).length
  const words = text
    .replace(/[　-鿿＀-￯]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(cjk / 500 + words / 200))
}
