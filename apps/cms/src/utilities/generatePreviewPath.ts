import type { PayloadRequest, CollectionSlug } from 'payload'

import { DEFAULT_LOCALE, LOCALES } from '@athena/shared/constants'

const collectionPrefixMap: Partial<Record<CollectionSlug, string>> = {
  posts: '/posts',
  pages: '',
}

type Props = {
  collection: keyof typeof collectionPrefixMap
  slug: string
  req: Pick<PayloadRequest, 'locale'>
}

export const generatePreviewPath = ({ collection, slug, req }: Props) => {
  // Preview the locale being edited: the web app reads it from the path
  // (/ja/…, /zh/…); English stays unprefixed.
  const locale = req.locale
  const localePrefix =
    typeof locale === 'string' &&
    locale !== DEFAULT_LOCALE &&
    (LOCALES as readonly string[]).includes(locale)
      ? `/${locale}`
      : ''

  const encodedParams = new URLSearchParams({
    slug,
    collection,
    path: `${localePrefix}${collectionPrefixMap[collection]}/${slug}`,
    previewSecret: process.env.PREVIEW_SECRET || '',
  })

  // Preview always happens on the Astro web app's origin. Without WEB_URL
  // (local dev), assume the Astro dev server.
  const webURL = process.env.WEB_URL || 'http://localhost:4321'

  return `${webURL}/api/preview?${encodedParams.toString()}`
}
