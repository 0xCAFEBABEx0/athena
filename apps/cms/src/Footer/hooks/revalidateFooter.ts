import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS } from '@athena/shared/constants'

import { invalidateWeb } from '../../utilities/invalidateWeb'

export const revalidateFooter: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating footer`)

    await invalidateWeb({ tags: [CACHE_TAGS.footer], payload })
  }

  return doc
}
