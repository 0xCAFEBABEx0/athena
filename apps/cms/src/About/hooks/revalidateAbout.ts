import type { GlobalAfterChangeHook } from 'payload'

import { CACHE_TAGS, ROUTES } from '@athena/shared/constants'
import { invalidateWeb } from '@/utilities/invalidateWeb'

/** /about (and /ja, /zh), plus the sitemap, which lists /about only while it has content. */
export const revalidateAbout: GlobalAfterChangeHook = async ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Invalidating about`)

    await invalidateWeb({
      paths: [ROUTES.about],
      tags: [CACHE_TAGS.about, CACHE_TAGS.sitemap],
      payload,
    })
  }

  return doc
}
