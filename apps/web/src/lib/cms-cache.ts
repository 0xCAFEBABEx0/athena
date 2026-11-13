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
 * the new content. A read that started before the change can finish after
 * that and write old data back, so every entry records when its CMS read
 * started and /api/invalidate records when it expired the cache
 * (EXPIRED_AT_KEY): an entry read before the last expiry is a miss.
 * TTL_SECONDS is only a safety net for a missed webhook; it stays below the
 * ISR expiration so an ISR re-render after a missed webhook still picks up
 * changes within a day.
 *
 * Only on Vercel: in local dev (no webhook) every request reads the CMS.
 */
export const CMS_DATA_TAG = 'cms-data'

const TTL_SECONDS = 60 * 60 * 24

/** Untagged, so expiring CMS_DATA_TAG keeps it. */
const EXPIRED_AT_KEY = 'cms-data:expired-at'

type Entry = { value: unknown; readAt: number }

const isEntry = (hit: unknown): hit is Entry =>
  typeof hit === 'object' && hit !== null && 'readAt' in hit && typeof hit.readAt === 'number'

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

/** A cached entry that is still fresh (read after the last expiry), or null. */
const readFresh = async (store: CmsCacheStore, key: string): Promise<Entry | null> => {
  const [hit, expiredAt] = await Promise.all([store.get(key), store.get(EXPIRED_AT_KEY)])
  const fresh = typeof expiredAt !== 'number' || (isEntry(hit) && hit.readAt > expiredAt)
  return isEntry(hit) && fresh ? hit : null
}

const writeEntry = (store: CmsCacheStore, key: string, entry: Entry) =>
  later(
    store.set(key, entry, { tags: [CMS_DATA_TAG], ttl: TTL_SECONDS }).catch((error: unknown) => {
      console.error('[cms-cache] write failed', error)
    }),
  )

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

  const readAt = Date.now()
  if (!freshReads.getStore()) {
    try {
      const hit = await readFresh(store, key)
      if (hit) return hit.value as T
    } catch (error) {
      console.error('[cms-cache] read failed', error)
    }
  }

  const value = await load()
  writeEntry(store, key, { value, readAt })
  return value
}

/**
 * Something derived from CMS content and computed elsewhere (an AI answer
 * streamed to the reader): read it with `peekCms`, then `storeCms` the result
 * with the time its CMS read started. Same freshness rules as `cachedCms`, so
 * the next CMS change expires it.
 */
export const peekCms = async <T>(
  key: string,
  store: CmsCacheStore | null = runtimeCache(),
): Promise<T | null> => {
  if (!store) return null
  try {
    const hit = await readFresh(store, key)
    return hit ? (hit.value as T) : null
  } catch (error) {
    console.error('[cms-cache] read failed', error)
    return null
  }
}

export const storeCms = (
  key: string,
  value: unknown,
  readAt: number,
  store: CmsCacheStore | null = runtimeCache(),
): void => {
  if (store) writeEntry(store, key, { value, readAt })
}

const localCounters = new Map<string, { value: number; expires: number }>()

/**
 * Add `by` to a counter kept for `ttlSeconds` (untagged, so CMS changes keep
 * it) and return the new total. Approximate: the Runtime Cache has no atomic
 * increment, so two requests at the same moment can count once. Without the
 * shared cache it counts per instance.
 */
export const bumpCounter = async (
  key: string,
  ttlSeconds: number,
  by = 1,
  store: CmsCacheStore | null = runtimeCache(),
): Promise<number> => {
  if (!store) {
    const now = Date.now()
    const current = localCounters.get(key)
    const value = (current && current.expires > now ? current.value : 0) + by
    localCounters.set(key, { value, expires: now + ttlSeconds * 1000 })
    return value
  }
  try {
    const current = await store.get(key)
    const value = (typeof current === 'number' ? current : 0) + by
    await store.set(key, value, { ttl: ttlSeconds })
    return value
  } catch (error) {
    console.error('[cms-cache] counter failed', error)
    return by
  }
}

/** Expire every cached CMS response. Returns false when it could not. */
export const expireCmsData = async (
  store: CmsCacheStore | null = runtimeCache(),
): Promise<boolean> => {
  if (!store) return true
  try {
    // First, so entries read before now stop counting even before the tag expiry lands.
    await store.set(EXPIRED_AT_KEY, Date.now(), { ttl: TTL_SECONDS })
    await store.expireTag(CMS_DATA_TAG)
    return true
  } catch (error) {
    console.error('[cms-cache] expireTag failed', error)
    return false
  }
}
