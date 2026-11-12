import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS, ROUTES } from '@athena/shared/constants'
import { invalidateWeb } from '../../utilities/invalidateWeb'

/** /stacks (and /ja, /zh), plus the sitemap, which lists /stacks only while it has items. */
export const revalidateStack: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating stack`)

    await invalidateWeb({
      paths: [ROUTES.stack],
      tags: [CACHE_TAGS.stack, CACHE_TAGS.sitemap],
      payload,
    })
  }

  return doc
}
