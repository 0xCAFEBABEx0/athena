import type { Page, Post } from '@athena/shared/payload-types'

import { DEFAULT_LOCALE, type Locale, localizePath } from './i18n'

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

/**
 * Resolve a CMS link field (reference or custom URL) to an href. Internal
 * paths get the locale prefix (`/posts` → `/ja/posts`).
 */
export const linkHref = (
  link: CMSLinkData | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null => {
  if (!link) return null
  const { type, reference, url } = link

  if (type === 'reference' && typeof reference?.value === 'object' && reference.value.slug) {
    const path = `${reference.relationTo !== 'pages' ? `/${reference.relationTo}` : ''}/${reference.value.slug}`
    return localizePath(locale, path)
  }
  return url ? localizePath(locale, url) : null
}
