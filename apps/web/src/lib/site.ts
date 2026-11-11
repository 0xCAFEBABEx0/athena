import type { Site } from '@athena/shared/payload-types'

import type { Locale } from '@athena/shared/constants'

import { getGlobal } from './cms'
import { formatDate } from './format'
import { mediaUrl } from './media'
import { safeHref } from './safe-url'

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
  /** Home page title after the site name; empty = the site name alone. */
  tagline: string
  description: string | undefined
  /** Default share image (absolute URL), or null for the built-in one. */
  ogImage: string | null
  socialLinks: { label: string; url: string }[]
  projects: { name: string; url: string | null; description: string }[]
  /** Posts on X picked for the home page, read from X when the CMS saved them. */
  picks: SitePick[]
  /** CLI-view welcome box: Hoo the owl beside the intro, or the plain box. */
  banner: {
    style: 'fetch' | 'off'
    mascot: boolean
    /** What Hoo says, in order; empty = the built-in lines (lib/i18n.ts). */
    tips: string[]
  }
}

export type SitePick = {
  url: string
  text: string
  authorName: string
  authorHandle: string
  /** `YYYY-MM-DD` (Japan time), or null when unknown. */
  postedAt: string | null
  lang: string | null
  note: string
}

// Only links to a post on x.com reach the page (the CMS stores them in this form).
const X_POST = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/\d{1,25}$/

const picksOf = (picks: Site['picks'] | undefined): SitePick[] =>
  (picks ?? []).flatMap((pick) => {
    const url = pick.url?.trim() ?? ''
    const handle = url.match(X_POST)?.[1]
    const text = pick.text?.trim() ?? ''
    if (!handle || !text) return []
    return [
      {
        url,
        text,
        authorName: pick.authorName?.trim() || pick.authorHandle?.trim() || handle,
        authorHandle: pick.authorHandle?.trim().replace(/^@/, '') || handle,
        // The day in Japan time, like post dates (the admin date picker saves local midnight).
        postedAt: formatDate(pick.postedAt) || null,
        lang: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(pick.lang?.trim() ?? '')
          ? (pick.lang?.trim() ?? null)
          : null,
        note: pick.note?.trim() ?? '',
      },
    ]
  })

const ogImageOf = (image: Site['ogImage'] | undefined): string | null => {
  if (!image || typeof image !== 'object') return null
  const url = image.sizes?.og?.url || image.url
  return url ? mediaUrl(url) : null
}

/** Exported for tests. */
export const normalizeSite = (site: Partial<Site> | null | undefined): SiteData => ({
  defaultView: site?.defaultView === 'modern' ? 'modern' : 'cli',
  siteName: site?.siteName?.trim() || DEFAULT_SITE_NAME,
  authorName: site?.authorName?.trim() || '',
  welcome: site?.welcome?.trim() || '',
  intro: site?.intro?.trim() || '',
  tagline: site?.tagline?.trim() || '',
  description: site?.description?.trim() || undefined,
  ogImage: ogImageOf(site?.ogImage),
  socialLinks: (site?.socialLinks ?? [])
    .flatMap(({ label, url }) => {
      // Only http(s), mailto, tel or a path on this site becomes a link.
      const href = safeHref(url)
      return label && href ? [{ label, url: href }] : []
    }),
  projects: (site?.projects ?? [])
    .filter((project) => project.name)
    .map(({ name, url, description }) => ({
      name,
      url: safeHref(url),
      description: description ?? '',
    })),
  picks: picksOf(site?.picks),
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
      .then(normalizeSite)
      .catch((error: unknown) => {
        console.error('[site] failed to load site settings', error)
        return normalizeSite(null)
      })
    byLocale.set(locale, pending)
  }
  return pending
}
