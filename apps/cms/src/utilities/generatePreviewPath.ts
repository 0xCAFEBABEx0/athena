import type { PayloadRequest, CollectionSlug } from 'payload'

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  posts: '/posts',
  pages: '',
}

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string
  req: PayloadRequest
}

export const generatePreviewPath = ({ collection, slug }: Props) => {
  const encodedParams = new URLSearchParams({
    slug,
    collection,
    path: `${collectionPrefixMap[collection]}/${slug}`,
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  // Preview always happens on the Astro web app's origin. Without WEB_URL
  // (local dev), assume the Astro dev server.
  const webURL = process.env.WEB_URL || 'http://localhost:4321'

  return `${webURL}/api/preview?${encodedParams.toString()}`
}
