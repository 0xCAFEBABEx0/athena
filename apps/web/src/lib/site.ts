import type { Site } from '@athena/shared/payload-types'

import { getGlobal } from './cms'

/** Used when the CMS `site` global is empty or unreachable. */
export const DEFAULT_SITE_NAME = 'whoa.me'

export type SiteData = {
  siteName: string
  authorName: string
  welcome: string
  intro: string
  description: string | undefined
  socialLinks: { label: string; url: string }[]
  projects: { name: string; url: string | null; description: string }[]
}

const normalize = (site: Partial<Site> | null | undefined): SiteData => ({
  siteName: site?.siteName?.trim() || DEFAULT_SITE_NAME,
  authorName: site?.authorName?.trim() || '',
  welcome: site?.welcome?.trim() || '',
  intro: site?.intro?.trim() || '',
  description: site?.description?.trim() || undefined,
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
})

// One fetch per request: Layout, Header, Footer and the page all ask for it.
const perRequest = new WeakMap<Request, Promise<SiteData>>()

/**
 * Site-wide settings from the CMS `site` global. Never throws: a CMS outage
 * (or a database without the `site` table yet) falls back to defaults.
 */
export const getSite = (request: Request): Promise<SiteData> => {
  let pending = perRequest.get(request)
  if (!pending) {
    pending = getGlobal<Site>('site')
      .then(normalize)
      .catch((error: unknown) => {
        console.error('[site] failed to load site settings', error)
        return normalize(null)
      })
    perRequest.set(request, pending)
  }
  return pending
}
