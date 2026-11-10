import { addCacheTag, invalidateByTag } from '@vercel/functions'

/**
 * Vercel cache tag carried by every rendered page, feed, sitemap and the
 * popup search index (the middleware adds it). /api/invalidate marks the tag
 * stale after any CMS change, so cached responses are served until content
 * actually changes and are then re-rendered once, in the background, on their
 * next request.
 *
 * One tag is enough: the sidebar lists recent posts and the header/footer come
 * from the CMS on every page, so almost any change touches every page anyway.
 * Outside Vercel (local dev, tests) both calls are no-ops.
 */
export const CONTENT_CACHE_TAG = 'content'

export const tagAsContent = async (): Promise<void> => {
  try {
    await addCacheTag(CONTENT_CACHE_TAG)
  } catch (error) {
    console.error('[cache] addCacheTag failed', error)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Mark every tagged response stale. Purge calls are rate limited per team
 * (Hobby: 50/s averaged over 30 s; a 429 leaves the cache unchanged), so a
 * rejected call is retried twice with a short delay.
 */
export const invalidateContent = async (): Promise<boolean> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await invalidateByTag(CONTENT_CACHE_TAG)
      return true
    } catch (error) {
      const rateLimited = String(error).includes('429')
      if (!rateLimited || attempt >= 2) {
        console.error('[cache] invalidateByTag failed', error)
        return false
      }
      await sleep(1_000 * (attempt + 1))
    }
  }
}
