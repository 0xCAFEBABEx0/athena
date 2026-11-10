import type { Media, Page, Post } from '@athena/shared/payload-types'

import { mediaUrl } from './media'
import { webURL } from './env'

export type PageMeta = {
  title: string
  description: string | undefined
  ogImage: string
  url: string
}

/** Built-in share image (Hoo); the Site global's `ogImage` replaces it. */
export const DEFAULT_OG_IMAGE = '/og.png'

type SiteMeta = { siteName: string; description?: string; ogImage?: string | null }

const defaultOgImage = (site: SiteMeta): string => site.ogImage || `${webURL()}${DEFAULT_OG_IMAGE}`

const ogImageURL = (image: unknown, site: SiteMeta): string => {
  if (image && typeof image === 'object' && 'url' in image) {
    const media = image as Media
    return mediaUrl(media.sizes?.og?.url || media.url)
  }
  return defaultOgImage(site)
}

/** `Title | Site name`, or just the site name when there is no title. */
export const pageTitle = (title: string | null | undefined, siteName: string): string =>
  title ? `${title} | ${siteName}` : siteName

/** Head metadata for a non-CMS route (post list, search, 404). */
export const routeMeta = (
  title: string | null,
  path: string,
  site: SiteMeta,
): PageMeta => ({
  title: pageTitle(title, site.siteName),
  description: site.description,
  ogImage: defaultOgImage(site),
  url: `${webURL()}${path}`,
})

/** Port of apps/cms generateMeta.ts: SEO-plugin fields -> head metadata. */
export const buildMeta = (
  doc: Partial<Page> | Partial<Post> | null,
  path: string,
  site: SiteMeta,
): PageMeta => ({
  title: pageTitle(doc?.meta?.title || doc?.title, site.siteName),
  description: doc?.meta?.description ?? site.description,
  ogImage: ogImageURL(doc?.meta?.image, site),
  url: `${webURL()}${path}`,
})
