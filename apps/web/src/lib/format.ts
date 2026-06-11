import type { Post } from '@athena/shared/payload-types'

/** MM/DD/YYYY, matching the cms frontend's formatDateTime. */
export const formatDateTime = (timestamp: string): string => {
  const date = timestamp ? new Date(timestamp) : new Date()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const DD = String(date.getDate()).padStart(2, '0')
  return `${MM}/${DD}/${date.getFullYear()}`
}

/** 'A', 'A and B', 'A, B and C' — matching the cms frontend's formatAuthors. */
export const formatAuthors = (
  authors: NonNullable<NonNullable<Post['populatedAuthors']>[number]>[],
): string => {
  const names = authors.map((author) => author.name).filter(Boolean) as string[]

  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
