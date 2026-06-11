import type { Payload } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import { CACHE_TAGS, type CacheTag } from '@athena/shared/constants'

type InvalidateArgs = {
  paths?: string[]
  tags?: CacheTag[]
  payload: Payload
}

/**
 * Map shared cache-tag names to the legacy next/cache tag names used by the
 * in-app Next frontend. Only needed during the bridge period — remove along
 * with the (frontend) route group at cutover.
 */
const LEGACY_TAG_MAP: Record<string, string[]> = {
  [CACHE_TAGS.sitemap]: ['pages-sitemap', 'posts-sitemap'],
  [CACHE_TAGS.header]: ['global_header'],
  [CACHE_TAGS.footer]: ['global_footer'],
  [CACHE_TAGS.redirects]: ['redirects'],
}

/**
 * Notify caches that content changed.
 *
 * 1. Bridge: revalidate the legacy in-app Next frontend (no-op once the
 *    (frontend) route group is removed).
 * 2. Webhook: POST `{ paths, tags }` to the Astro web app's /api/_invalidate
 *    endpoint, which bumps KV version stamps and purges edge-cached HTML.
 *    Skipped when WEB_URL is unset.
 *
 * Never throws — cache invalidation must not break a publish.
 */
export const invalidateWeb = async ({ paths = [], tags = [], payload }: InvalidateArgs) => {
  // 1. Legacy in-app frontend (bridge period only).
  try {
    for (const path of paths) revalidatePath(path)
    // Next 16 requires a cache-life profile; 'max' = expire immediately on
    // the next request, matching the pre-16 single-argument behavior.
    for (const tag of tags) for (const legacy of LEGACY_TAG_MAP[tag] ?? []) revalidateTag(legacy, 'max')
  } catch (err) {
    // next/cache is unavailable outside a Next request context (e.g. seeds).
    payload.logger.info(`Legacy revalidation skipped: ${String(err)}`)
  }

  // 2. Web app webhook.
  const webURL = process.env.WEB_URL
  if (!webURL || !process.env.REVALIDATE_SECRET) return

  try {
    const res = await fetch(`${webURL}/api/_invalidate`, {
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
