import type { Site } from '@athena/shared/payload-types'

import type { Locale } from '@athena/shared/constants'

import { getGlobal } from './cms'
import { mediaUrl } from './media'

/** Used when the CMS `site` global is empty or unreachable. */
export const DEFAULT_SITE_NAME = 'whoa.me'

export type SiteView = 'cli' | 'modern'

export type SiteData = {
  /** Look shown until the visitor picks one (stored in localStorage). */
  defaultView: SiteView
  siteName: string
  authorName: string
  welcome: string
  intro: string
  description: string | undefined
  /** Default share image (absolute URL), or null for the built-in one. */
  ogImage: string | null
  socialLinks: { label: string; url: string }[]
  projects: { name: string; url: string | null; description: string }[]
  /** CLI-view welcome box: Hoo the owl beside the intro, or the plain box. */
  banner: {
    style: 'fetch' | 'off'
    mascot: boolean
    /** What Hoo says, in order; empty = the built-in lines (lib/i18n.ts). */
    tips: string[]
  }
}

const ogImageOf = (image: Site['ogImage'] | undefined): string | null => {
  if (!image || typeof image !== 'object') return null
  const url = image.sizes?.og?.url || image.url
  return url ? mediaUrl(url) : null
}

const normalize = (site: Partial<Site> | null | undefined): SiteData => ({
  defaultView: site?.defaultView === 'modern' ? 'modern' : 'cli',
  siteName: site?.siteName?.trim() || DEFAULT_SITE_NAME,
  authorName: site?.authorName?.trim() || '',
  welcome: site?.welcome?.trim() || '',
  intro: site?.intro?.trim() || '',
  description: site?.description?.trim() || undefined,
  ogImage: ogImageOf(site?.ogImage),
  socialLinks: (site?.socialLinks ?? [])
    .filter((link) => link.label && link.url)
    .map(({ label, url }) => ({ label, url })),
  projects: (site?.projects ?? [])
    .filter((project) => project.name)
    .map(({ name, url, description }) => ({
      name,
      url: url || null,
      description: description ?? '',
    })),
  banner: {
    style: site?.banner?.style === 'off' ? 'off' : 'fetch',
    mascot: site?.banner?.mascot !== false,
    tips: (site?.banner?.tips ?? []).map((tip) => tip.text?.trim() ?? '').filter(Boolean),
  },
})

// One fetch per request: Layout, Header, Footer and the page all ask for it.
// Keyed by `Astro.locals` (see lib/nav.ts).
const perRequest = new WeakMap<object, Map<Locale, Promise<SiteData>>>()

/**
 * Site-wide settings from the CMS `site` global. Never throws: a CMS outage
 * (or a database without the `site` table yet) falls back to defaults.
 */
export const getSite = (scope: object, locale: Locale): Promise<SiteData> => {
  let byLocale = perRequest.get(scope)
  if (!byLocale) {
    byLocale = new Map()
    perRequest.set(scope, byLocale)
  }
  let pending = byLocale.get(locale)
  if (!pending) {
    pending = getGlobal<Site>('site', { locale })
      .then(normalize)
      .catch((error: unknown) => {
        console.error('[site] failed to load site settings', error)
        return normalize(null)
      })
    byLocale.set(locale, pending)
  }
  return pending
}
