import type { APIRoute } from 'astro'

import { CACHE_TAGS, type CacheTag } from '@athena/shared/constants'

import { invalidateContent } from '@/lib/cache'
import { env, webURL } from '@/lib/env'
import { LOCALES, localizePath } from '@/lib/i18n'
import { isrBypassToken } from '@/lib/isr-bypass.mjs'

/**
 * Cache-invalidation webhook called by the CMS on publish/unpublish
 * (see apps/cms/src/utilities/invalidateWeb.ts):
 *
 *   POST /api/invalidate
 *   Authorization: Bearer ${REVALIDATE_SECRET}
 *   { "paths": ["/posts/foo"], "tags": ["posts", "sitemap"] }
 *
 * Vercel caches every rendered page, feed and sitemap (ISR) under one cache
 * tag (see lib/cache.ts). Any change first marks that tag stale, so every
 * cached response re-renders once, in the background, on its next request:
 * header, footer, site settings and redirects reach every page this way.
 * The paths that changed directly are then re-fetched with
 * `x-prerender-revalidate: <bypassToken>`, which re-renders and re-caches them
 * right away, so their first visitor already sees the new content.
 *
 * The response waits for those re-renders, so when the CMS logs
 * "Web invalidated" the changed pages are already fresh: answering earlier
 * would let a visitor get the stale copy in between. The CMS sends this call
 * after its response (Next `after()`) and allows it 25 s, so a bulk publish
 * (one call per document, up to ~15 localized paths each) does not slow down
 * the admin. On a deployment behind Vercel Authentication (Preview), the
 * re-render requests carry Vercel's own `VERCEL_AUTOMATION_BYPASS_SECRET`.
 */
const TAG_PATH_MAP: Partial<Record<CacheTag, string[]>> = {
  [CACHE_TAGS.sitemap]: ['/pages-sitemap.xml', '/posts-sitemap.xml'],
  [CACHE_TAGS.posts]: ['/', '/posts', '/rss.xml', '/search-index.json'],
  [CACHE_TAGS.pages]: ['/search-index.json'],
  [CACHE_TAGS.site]: ['/', '/posts', '/rss.xml'],
  // Site settings, header/footer and redirects also affect every other page;
  // the cache-tag invalidation covers those.
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
  const bypassToken = isrBypassToken(secret) ?? ''

  const paths = new Set<string>(
    (body.paths ?? []).filter((p) => typeof p === 'string' && p.startsWith('/')),
  )
  for (const tag of body.tags ?? []) {
    for (const path of TAG_PATH_MAP[tag] ?? []) paths.add(path)
  }
  // Every page exists once per language (/posts/x, /ja/posts/x, /zh/posts/x);
  // sitemaps live at the root only.
  for (const path of [...paths]) {
    if (path.endsWith('sitemap.xml')) continue
    for (const locale of LOCALES) paths.add(localizePath(locale, path))
  }

  // Before the re-renders below, so they are not marked stale again.
  const invalidated = await invalidateContent()

  const failed = await rerender([...paths], bypassToken)
  const revalidated = [...paths].filter((path) => !failed.includes(path))
  if (failed.length) console.warn(`[invalidate] re-render failed: ${failed.join(', ')}`)

  return Response.json({ invalidated, revalidated, failed, tags: body.tags ?? [] })
}

/** Re-render and re-cache `paths` now; returns the paths that failed. */
const rerender = async (paths: string[], bypassToken: string): Promise<string[]> => {
  const headers: Record<string, string> = { 'x-prerender-revalidate': bypassToken }
  const protectionBypass = env('VERCEL_AUTOMATION_BYPASS_SECRET')
  if (protectionBypass) headers['x-vercel-protection-bypass'] = protectionBypass
  const failed: string[] = []
  await Promise.all(
    paths.map(async (path) => {
      try {
        const res = await fetch(`${webURL()}${path}`, {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
        })
        // 404: the page is gone (an unpublished post), which is its new state.
        if (!res.ok && res.status !== 404) failed.push(path)
      } catch {
        failed.push(path)
      }
    }),
  )
  return failed
}
