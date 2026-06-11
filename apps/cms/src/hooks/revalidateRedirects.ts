import type { CollectionAfterChangeHook } from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import { invalidateWeb } from '../utilities/invalidateWeb'

export const revalidateRedirects: CollectionAfterChangeHook = async ({
  doc,
  req: { payload },
}) => {
  payload.logger.info(`Invalidating redirects`)

  await invalidateWeb({ tags: [CACHE_TAGS.redirects], payload })

  return doc
}
