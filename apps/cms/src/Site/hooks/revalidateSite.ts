import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS, ROUTES } from '@athena/shared/constants'
import { invalidateWeb } from '../../utilities/invalidateWeb'

export const revalidateSite: GlobalAfterChangeHook = async ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating site settings`)

    await invalidateWeb({ paths: ['/', ROUTES.posts], tags: [CACHE_TAGS.site], payload })
  }

  return doc
}
