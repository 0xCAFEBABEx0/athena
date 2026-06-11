import type { Media } from '@athena/shared/payload-types'

import { cmsURL } from './env'

/** Absolute URL for a media file (pre-Blob rows store relative /api/media paths). */
export const mediaUrl = (url: string | null | undefined, cacheTag?: string | null): string => {
  if (!url) return ''
  const absolute = url.startsWith('http://') || url.startsWith('https://') ? url : `${cmsURL()}${url}`
  return cacheTag ? `${absolute}?${encodeURIComponent(cacheTag)}` : absolute
}

export type ImgAttrs = {
  src: string
  srcset: string | undefined
  width: number | undefined
  height: number | undefined
  alt: string
}

/** <img> attributes for a media resource, with srcset built from its renditions. */
export const imgAttrs = (resource: Media): ImgAttrs => {
  const srcset = resource.sizes
    ? Object.values(resource.sizes)
        .filter((size) => size?.url && size.width)
        .map((size) => `${mediaUrl(size.url, resource.updatedAt)} ${size.width}w`)
        .join(', ') || undefined
    : undefined

  return {
    src: mediaUrl(resource.url, resource.updatedAt),
    srcset,
    width: resource.width ?? undefined,
    height: resource.height ?? undefined,
    alt: resource.alt || '',
  }
}
