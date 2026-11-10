import type { APIRoute } from 'astro'

import { searchPages, searchPosts } from '@/lib/cms'
import { categoryTitles } from '@/lib/format'
import { DEFAULT_LOCALE, isLocale, localizePath } from '@/lib/i18n'

export type SearchHit = { title: string; href: string; tag?: string }
export type SearchResponse = { posts: SearchHit[]; pages: SearchHit[] }

/**
 * Keyword search for the popup (⌘K or /): posts from the CMS search index
 * plus matching page titles. GET /api/search?q=vercel&locale=ja
 */
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 100)
  const param = url.searchParams.get('locale')
  const locale = isLocale(param) ? param : DEFAULT_LOCALE

  try {
    const [posts, pages] = await Promise.all([searchPosts(q, locale), searchPages(q, locale)])
    const body: SearchResponse = {
      posts: posts.docs
        .filter((doc) => doc.slug)
        .slice(0, 8)
        .map((doc) => ({
          title: doc.title || doc.meta?.title || doc.slug || '',
          href: localizePath(locale, `/posts/${doc.slug}`),
          tag: categoryTitles(doc.categories)[0],
        })),
      pages: pages
        .filter((page) => page.slug)
        .map((page) => ({ title: page.title, href: localizePath(locale, `/${page.slug}`) })),
    }
    return Response.json(body, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('[api/search]', error)
    return Response.json(
      { error: 'CMS unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
