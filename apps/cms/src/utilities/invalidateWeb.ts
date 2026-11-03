import type { Payload } from 'payload'

import type { CacheTag } from '@athena/shared/constants'

type InvalidateArgs = {
  paths?: string[]
  tags?: CacheTag[]
  payload: Payload
}

/**
 * Notify the web app that content changed.
 *
 * POSTs `{ paths, tags }` to the Astro web app's /api/invalidate endpoint,
 * which re-renders the affected ISR-cached paths. Skipped when WEB_URL or
 * REVALIDATE_SECRET is unset.
 *
 * Never throws — cache invalidation must not break a publish.
 */
export const invalidateWeb = async ({ paths = [], tags = [], payload }: InvalidateArgs) => {
  const webURL = process.env.WEB_URL
  if (!webURL || !process.env.REVALIDATE_SECRET) return

  try {
    const res = await fetch(`${webURL}/api/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.REVALIDATE_SECRET}`,
      },
      body: JSON.stringify({ paths, tags }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      payload.logger.error(`Web invalidation failed: ${res.status} ${await res.text()}`)
    } else {
      payload.logger.info(`Web invalidated: paths=[${paths.join(', ')}] tags=[${tags.join(', ')}]`)
    }
  } catch (err) {
    payload.logger.error(`Web invalidation unreachable: ${String(err)}`)
  }
}
