import type { Media, Page, Post } from '@athena/shared/payload-types'

import { mediaUrl } from './media'
import { webURL } from './env'

export const SITE_NAME = 'Payload Website Template'

export type PageMeta = {
  title: string
  description: string | undefined
  ogImage: string
  url: string
}

const ogImageURL = (image: unknown): string => {
  if (image && typeof image === 'object' && 'url' in image) {
    const media = image as Media
    return mediaUrl(media.sizes?.og?.url || media.url)
  }
  return `${webURL()}/website-template-OG.webp`
}

/** Port of apps/cms generateMeta.ts: SEO-plugin fields -> head metadata. */
export const buildMeta = (doc: Partial<Page> | Partial<Post> | null, path = '/'): PageMeta => {
  const title = doc?.meta?.title ? `${doc.meta.title} | ${SITE_NAME}` : SITE_NAME

  return {
    title,
    description: doc?.meta?.description ?? undefined,
    ogImage: ogImageURL(doc?.meta?.image),
    url: `${webURL()}${path}`,
  }
}
