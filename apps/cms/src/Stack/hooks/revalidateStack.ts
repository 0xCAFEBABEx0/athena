import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import { invalidateWeb } from '../../utilities/invalidateWeb'

/** /stack (and /ja, /zh), plus the sitemap, which lists /stack only while it has items. */
export const revalidateStack: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating stack`)

    await invalidateWeb({
      paths: ['/stack'],
      tags: [CACHE_TAGS.stack, CACHE_TAGS.sitemap],
      payload,
    })
  }

  return doc
}
