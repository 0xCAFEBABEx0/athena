import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { CACHE_TAGS, ROUTES } from '@athena/shared/constants'
import type { Post } from '../../../payload-types'
import { invalidateWeb } from '../../../utilities/invalidateWeb'

export const revalidatePost: CollectionAfterChangeHook<Post> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    const paths: string[] = []

    if (doc._status === 'published') {
      paths.push(`${ROUTES.posts}/${doc.slug}`, ROUTES.posts, '/')
    }

    // If the post was previously published, we need to invalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      paths.push(`${ROUTES.posts}/${previousDoc.slug}`, ROUTES.posts, '/')
    }

    if (paths.length) {
      payload.logger.info(`Invalidating post paths: ${paths.join(', ')}`)
      await invalidateWeb({
        paths: [...new Set(paths)],
        tags: [CACHE_TAGS.posts, CACHE_TAGS.sitemap],
        payload,
      })
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    await invalidateWeb({
      paths: [`${ROUTES.posts}/${doc?.slug}`, ROUTES.posts, '/'],
      tags: [CACHE_TAGS.posts, CACHE_TAGS.sitemap],
      payload,
    })
  }

  return doc
}
