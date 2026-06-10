import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import { invalidateWeb } from '../../utilities/invalidateWeb'

export const revalidateHeader: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating header`)

    await invalidateWeb({ tags: [CACHE_TAGS.header], payload })
  }

  return doc
}
