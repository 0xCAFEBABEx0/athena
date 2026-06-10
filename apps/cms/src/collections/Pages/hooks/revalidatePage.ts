import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import type { Page } from '../../../payload-types'
import { invalidateWeb } from '../../../utilities/invalidateWeb'

export const revalidatePage: CollectionAfterChangeHook<Page> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const paths: string[] = []

    if (doc._status === 'published') {
      paths.push(doc.slug === 'home' ? '/' : `/${doc.slug}`)
    }

    // If the page was previously published, we need to invalidate the old path
    if (previousDoc?._status === 'published' && doc._status !== 'published') {
      paths.push(previousDoc.slug === 'home' ? '/' : `/${previousDoc.slug}`)
    }

    if (paths.length) {
      payload.logger.info(`Invalidating page paths: ${paths.join(', ')}`)
      await invalidateWeb({ paths, tags: [CACHE_TAGS.pages, CACHE_TAGS.sitemap], payload })
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Page> = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const path = doc?.slug === 'home' ? '/' : `/${doc?.slug}`
    await invalidateWeb({ paths: [path], tags: [CACHE_TAGS.pages, CACHE_TAGS.sitemap], payload })
  }

  return doc
}
