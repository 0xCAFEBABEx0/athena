import type { Page, Post } from '@athena/shared/payload-types'

export type CMSLinkData = {
  type?: 'custom' | 'reference' | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
  url?: string | null
  label?: string | null
}

/** Resolve a CMS link field (reference or custom URL) to an href. */
export const linkHref = (link: CMSLinkData | null | undefined): string | null => {
  if (!link) return null
  const { type, reference, url } = link

  if (type === 'reference' && typeof reference?.value === 'object' && reference.value.slug) {
    return `${reference.relationTo !== 'pages' ? `/${reference.relationTo}` : ''}/${reference.value.slug}`
  }
  return url || null
}
