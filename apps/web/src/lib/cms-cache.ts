import { AsyncLocalStorage } from 'node:async_hooks'

import { getCache, waitUntil } from '@vercel/functions'

/**
 * Vercel Runtime Cache in front of the CMS REST API (published content only).
 *
 * A page render that misses the ISR cache (a URL never seen before, the first
 * visit after a publish or a deploy) used to call the CMS up to seven times:
 * site settings, header, footer, recent posts, work and redirects for the
 * layout, then the page itself. Every call is a CMS function invocation and
 * wakes the Neon database for at least five minutes, so a crawler requesting
 * a new URL every few minutes kept the database awake around the clock (see
 * the free-tier survey of 2026-11-11). Responses are now kept here, so those
 * renders read the CMS data without calling the CMS at all.
 *
 * Freshness: /api/invalidate expires CMS_DATA_TAG on every CMS change before
 * it re-renders the changed paths, and those re-renders (requests carrying
 * the ISR bypass token, see middleware.ts) skip the reads, so they always see
 * the new content. TTL_SECONDS is only a safety net for a missed webhook; it
 * stays below the ISR expiration so an ISR re-render after a missed webhook
 * still picks up changes within a day.
 *
 * Only on Vercel: in local dev (no webhook) every request reads the CMS.
 */
export const CMS_DATA_TAG = 'cms-data'

const TTL_SECONDS = 60 * 60 * 24

/** The subset of Vercel's RuntimeCache used here (a fake in tests). */
export type CmsCacheStore = {
  get: (key: string) => Promise<unknown | null>
  set: (key: string, value: unknown, options?: { tags?: string[]; ttl?: number }) => Promise<void>
  expireTag: (tag: string | string[]) => Promise<void>
}

/**
 * True when this request can reach Vercel's shared Runtime Cache. Without it
 * `getCache()` quietly falls back to a per-instance in-memory cache, which an
 * `expireTag` from /api/invalidate (another instance) would not clear, so
 * pages could show old content for a day: read the CMS instead.
 */
const hasSharedCache = (): boolean => {
  const store = globalThis as { [key: symbol]: { get?: () => { cache?: unknown } } | undefined }
  const context = store[Symbol.for('@vercel/request-context')]?.get?.()
  if (context?.cache) return true
  return Boolean(process.env.RUNTIME_CACHE_ENDPOINT && process.env.RUNTIME_CACHE_HEADERS)
}

let warnedUnavailable = false

const runtimeCache = (): CmsCacheStore | null => {
  if (!process.env.VERCEL) return null
  if (!hasSharedCache()) {
    if (!warnedUnavailable) {
      console.warn('[cms-cache] Runtime Cache unavailable; reading the CMS directly')
      warnedUnavailable = true
    }
    return null
  }
  try {
    // Per deployment: a release that changes what the web app reads from
    // the CMS starts from live data, like the ISR cache does.
    return getCache({ namespace: `cms-${process.env.VERCEL_DEPLOYMENT_ID ?? 'local'}` })
  } catch (error) {
    console.error('[cms-cache] runtime cache unavailable', error)
    return null
  }
}

const freshReads = new AsyncLocalStorage<true>()

/** Run `fn` (and everything it awaits) with cache reads skipped; writes still happen. */
export const withFreshCmsReads = <T>(fn: () => T): T => freshReads.run(true, fn)

const later = (promise: Promise<unknown>) => {
  try {
    waitUntil(promise)
  } catch {
    // Outside a Vercel request: nothing keeps the function alive anyway.
  }
}

/**
 * Return the cached value for `key`, or `load()` it and cache the result.
 * A failed `load()` is never cached; a cache that errors is skipped.
 */
export const cachedCms = async <T>(
  key: string,
  load: () => Promise<T>,
  store: CmsCacheStore | null = runtimeCache(),
): Promise<T> => {
  if (!store) return load()

  if (!freshReads.getStore()) {
    try {
      const hit = await store.get(key)
      if (hit !== null && hit !== undefined) return hit as T
    } catch (error) {
      console.error('[cms-cache] read failed', error)
    }
  }

  const value = await load()
  later(
    store.set(key, value, { tags: [CMS_DATA_TAG], ttl: TTL_SECONDS }).catch((error: unknown) => {
      console.error('[cms-cache] write failed', error)
    }),
  )
  return value
}

/** Expire every cached CMS response. Returns false when it could not. */
export const expireCmsData = async (
  store: CmsCacheStore | null = runtimeCache(),
): Promise<boolean> => {
  if (!store) return true
  try {
    await store.expireTag(CMS_DATA_TAG)
    return true
  } catch (error) {
    console.error('[cms-cache] expireTag failed', error)
    return false
  }
}
