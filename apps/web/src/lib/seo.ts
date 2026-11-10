import type { Media, Page, Post } from '@athena/shared/payload-types'

import { mediaUrl } from './media'
import { webURL } from './env'

export type PageMeta = {
  title: string
  description: string | undefined
  ogImage: string
  url: string
}

export const DEFAULT_OG_IMAGE = '/website-template-OG.webp'

const ogImageURL = (image: unknown): string => {
  if (image && typeof image === 'object' && 'url' in image) {
    const media = image as Media
    return mediaUrl(media.sizes?.og?.url || media.url)
  }
  return `${webURL()}${DEFAULT_OG_IMAGE}`
}

/** `Title | Site name`, or just the site name when there is no title. */
export const pageTitle = (title: string | null | undefined, siteName: string): string =>
  title ? `${title} | ${siteName}` : siteName

/** Head metadata for a non-CMS route (post list, search, 404). */
export const routeMeta = (
  title: string | null,
  path: string,
  { siteName, description }: { siteName: string; description?: string },
): PageMeta => ({
  title: pageTitle(title, siteName),
  description,
  ogImage: `${webURL()}${DEFAULT_OG_IMAGE}`,
  url: `${webURL()}${path}`,
})

/** Port of apps/cms generateMeta.ts: SEO-plugin fields -> head metadata. */
export const buildMeta = (
  doc: Partial<Page> | Partial<Post> | null,
  path: string,
  { siteName, description }: { siteName: string; description?: string },
): PageMeta => ({
  title: pageTitle(doc?.meta?.title || doc?.title, siteName),
  description: doc?.meta?.description ?? description,
  ogImage: ogImageURL(doc?.meta?.image),
  url: `${webURL()}${path}`,
})
