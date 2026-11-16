import { ROUTES } from '@athena/shared/constants'
import type { APIRoute } from 'astro'

import { getSearchIndexDocs } from '@/lib/cms'
import { categoryTitles } from '@/lib/format'
import { localeOf, localizePath } from '@/lib/i18n'

export type SearchHit = { title: string; href: string; tag?: string; text?: string }
export type SearchIndex = { posts: SearchHit[]; pages: SearchHit[] }

/**
 * Everything the popup search (⌘K or /) filters, for one language:
 * /search-index.json, /ja/search-index.json, /zh/search-index.json.
 * The browser loads it once and filters locally, so typing never reaches the
 * server; Vercel caches it like a page until the next CMS change.
 */
export const GET: APIRoute = async ({ locals }) => {
  const locale = localeOf({ locals })
  try {
    const { posts, pages } = await getSearchIndexDocs(locale)
    const body: SearchIndex = {
      posts: posts
        .filter((post) => post.slug)
        .map((post) => ({
          title: post.title || post.meta?.title || post.slug || '',
          href: localizePath(locale, `${ROUTES.posts}/${post.slug}`),
          tag: categoryTitles(post.categories)[0],
          text: [post.slug, post.meta?.title, post.meta?.description, ...categoryTitles(post.categories)]
            .filter(Boolean)
            .join(' '),
        })),
      pages: pages
        .filter((page) => page.slug)
        .map((page) => ({
          title: page.title,
          href: localizePath(locale, `/${page.slug}`),
          text: page.slug ?? '',
        })),
    }
    return Response.json(body)
  } catch (error) {
    console.error('[search-index]', error)
    return Response.json(
      { error: 'CMS unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
