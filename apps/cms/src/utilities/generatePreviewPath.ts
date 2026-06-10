import { PayloadRequest, CollectionSlug } from 'payload'

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

  // When the Astro web app exists, preview happens on its origin.
  // Until then (bridge period), use the legacy in-app Next preview route.
  const webURL = process.env.WEB_URL

  return webURL
    ? `${webURL}/api/preview?${encodedParams.toString()}`
    : `/next/preview?${encodedParams.toString()}`
}
