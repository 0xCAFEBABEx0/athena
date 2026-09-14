import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()
  const now = new Date().toISOString()

  try {
    const docs = await getAllSlugs('pages')

    const entries: SitemapEntry[] = [
      ...docs.map((doc) => ({
        loc: doc.slug === 'home' ? `${base}/` : `${base}/${doc.slug}`,
        lastmod: doc.updatedAt,
      })),
      { loc: `${base}/search`, lastmod: now },
      { loc: `${base}/posts`, lastmod: now },
    ]

    return sitemapResponse(sitemapXML(entries))
  } catch (error) {
    console.error('[sitemap:pages]', error)
    return new Response('CMS unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
