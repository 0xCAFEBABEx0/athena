import { currentRoute, ROUTES } from '@athena/shared/constants'
import type { Page, Post } from '@athena/shared/payload-types'

import { DEFAULT_LOCALE, type Locale, localizePath } from './i18n'
import { safeHref } from './safe-url'

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
 * paths get the locale prefix (`/notes` → `/ja/notes`); paths typed before
 * the 1.2.0 rename (`/posts`, `/work`, `/stack`) point at their new routes.
 */
export const linkHref = (
  link: CMSLinkData | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string | null => {
  if (!link) return null
  const { type, reference, url } = link

  if (type === 'reference' && typeof reference?.value === 'object' && reference.value.slug) {
    const path = `${reference.relationTo === 'posts' ? ROUTES.posts : ''}/${reference.value.slug}`
    return localizePath(locale, path)
  }
  // Custom URLs are typed by editors: never emit javascript: and the like.
  const href = safeHref(url)
  return href ? localizePath(locale, href.startsWith('/') ? currentRoute(href) : href) : null
}
