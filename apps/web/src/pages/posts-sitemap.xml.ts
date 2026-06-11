import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { sitemapResponse, sitemapXML } from '@/lib/sitemap'

export const GET: APIRoute = async () => {
  const base = webURL()

  const docs = await getAllSlugs('posts')

  const entries = docs
    .filter((doc) => Boolean(doc.slug))
    .map((doc) => ({
      loc: `${base}/posts/${doc.slug}`,
      lastmod: doc.updatedAt,
    }))

  return sitemapResponse(sitemapXML(entries))
}
