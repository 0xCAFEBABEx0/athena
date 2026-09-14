import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { sitemapResponse, sitemapXML } from '@/lib/sitemap'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()

  try {
    const docs = await getAllSlugs('posts')

    const entries = docs
      .filter((doc) => Boolean(doc.slug))
      .map((doc) => ({
        loc: `${base}/posts/${doc.slug}`,
        lastmod: doc.updatedAt,
      }))

    return sitemapResponse(sitemapXML(entries))
  } catch (error) {
    console.error('[sitemap:posts]', error)
    return new Response('CMS unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
