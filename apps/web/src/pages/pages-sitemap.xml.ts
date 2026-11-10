import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { localizedEntries, sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()
  const now = new Date().toISOString()

  try {
    const docs = await getAllSlugs('pages')

    const entries: SitemapEntry[] = [
      ...docs.flatMap((doc) =>
        localizedEntries(base, doc.slug === 'home' ? '/' : `/${doc.slug}`, doc.updatedAt),
      ),
      ...localizedEntries(base, '/search', now),
      ...localizedEntries(base, '/posts', now),
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
