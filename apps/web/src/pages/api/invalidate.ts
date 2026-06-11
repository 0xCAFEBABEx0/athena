import type { APIRoute } from 'astro'

import { CACHE_TAGS, type CacheTag } from '@athena/shared/constants'

import { env, webURL } from '@/lib/env'

/**
 * Cache-invalidation webhook called by the CMS on publish/unpublish
 * (see apps/cms/src/utilities/invalidateWeb.ts):
 *
 *   POST /api/invalidate
 *   Authorization: Bearer ${REVALIDATE_SECRET}
 *   { "paths": ["/posts/foo"], "tags": ["posts", "sitemap"] }
 *
 * Vercel's ISR layer caches our rendered HTML. Re-fetching a path with the
 * `x-prerender-revalidate: <bypassToken>` header makes Vercel re-render and
 * re-cache it. Tags that cannot be enumerated to concrete paths fall back to
 * the adapter-level `expiration` TTL.
 */
const TAG_PATH_MAP: Partial<Record<CacheTag, string[]>> = {
  [CACHE_TAGS.sitemap]: ['/pages-sitemap.xml', '/posts-sitemap.xml'],
  [CACHE_TAGS.posts]: ['/posts'],
  // header/footer/redirects affect every page; covered by ISR expiration.
}

export const POST: APIRoute = async ({ request }) => {
  const secret = env('REVALIDATE_SECRET')
  const auth = request.headers.get('authorization')

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { paths?: string[]; tags?: CacheTag[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const paths = new Set<string>(
    (body.paths ?? []).filter((p) => typeof p === 'string' && p.startsWith('/')),
  )
  for (const tag of body.tags ?? []) {
    for (const path of TAG_PATH_MAP[tag] ?? []) paths.add(path)
  }

  const revalidated: string[] = []
  const failed: string[] = []

  await Promise.all(
    [...paths].map(async (path) => {
      try {
        const res = await fetch(`${webURL()}${path}`, {
          headers: { 'x-prerender-revalidate': secret },
          signal: AbortSignal.timeout(10_000),
        })
        ;(res.ok ? revalidated : failed).push(path)
      } catch {
        failed.push(path)
      }
    }),
  )

  return Response.json({ revalidated, failed, tags: body.tags ?? [] })
}
