import { after } from 'next/server'
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
 *
 * Inside a request (admin saves, REST) the call is deferred with Next's
 * `after()` until the response has been sent. Hooks run before Payload
 * commits the transaction, so a web re-render started from the hook could
 * read the old data and cache it again: a bulk unpublish on 2026-11-11 left
 * the posts listed on /posts that way. Outside a request (scripts, jobs,
 * tests) `after()` throws and the call runs right away.
 */
export const invalidateWeb = async (args: InvalidateArgs): Promise<void> => {
  try {
    after(() => sendInvalidation(args))
    return
  } catch {
    await sendInvalidation(args)
  }
}

const sendInvalidation = async ({ paths = [], tags = [], payload }: InvalidateArgs) => {
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
      // The web app answers once the changed pages are re-rendered (up to
      // ~15 localized paths); this runs after the admin's response, so a
      // generous limit costs the editor nothing.
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      const where = res.headers.get('location')
      payload.logger.error(
        `Web invalidation failed: ${res.status} ${where ? `redirect to ${where}` : (await res.text()).slice(0, 300)}`,
      )
    } else {
      // The web app answers 200 even when a re-render failed; those pages
      // stay stale until their next visit, so say so instead of "invalidated".
      const result = (await res.json().catch(() => ({}))) as { failed?: unknown }
      const failed = Array.isArray(result.failed) ? result.failed.map(String) : []
      if (failed.length) {
        payload.logger.warn(`Web invalidated, but re-render failed: ${failed.join(', ')}`)
      } else {
        payload.logger.info(`Web invalidated: paths=[${paths.join(', ')}] tags=[${tags.join(', ')}]`)
      }
    }
  } catch (err) {
    payload.logger.error(`Web invalidation unreachable: ${String(err)}`)
  }
}
