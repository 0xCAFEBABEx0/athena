import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'

export const GET: APIRoute = async () => {
  const base = webURL()
  const now = new Date().toISOString()

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
}
