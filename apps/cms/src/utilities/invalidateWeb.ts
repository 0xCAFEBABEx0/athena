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
 * which re-renders the affected ISR-cached paths. Skipped (with a warning)
 * when WEB_URL or REVALIDATE_SECRET is unset. WEB_PROTECTION_BYPASS (the
 * athena-web Protection Bypass for Automation secret) gets the request past
 * Vercel Authentication on a protected deployment; a redirect (e.g. to the
 * Vercel login) is reported as a failure instead of being followed.
 *
 * Never throws — cache invalidation must not break a publish.
 */
export const invalidateWeb = async ({ paths = [], tags = [], payload }: InvalidateArgs) => {
  const webURL = process.env.WEB_URL
  if (!webURL || !process.env.REVALIDATE_SECRET) {
    payload.logger.warn(
      `Web invalidation skipped: ${webURL ? 'REVALIDATE_SECRET' : 'WEB_URL'} is not set in this deployment`,
    )
    return
  }
  const bypass = process.env.WEB_PROTECTION_BYPASS

  try {
    const res = await fetch(`${webURL}/api/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.REVALIDATE_SECRET}`,
        ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
      },
      redirect: 'manual',
      body: JSON.stringify({ paths, tags }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      const where = res.headers.get('location')
      payload.logger.error(
        `Web invalidation failed: ${res.status} ${where ? `redirect to ${where}` : (await res.text()).slice(0, 300)}`,
      )
    } else {
      payload.logger.info(`Web invalidated: paths=[${paths.join(', ')}] tags=[${tags.join(', ')}]`)
    }
  } catch (err) {
    payload.logger.error(`Web invalidation unreachable: ${String(err)}`)
  }
}
