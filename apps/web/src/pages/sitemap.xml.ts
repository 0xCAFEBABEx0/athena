import type { APIRoute } from 'astro'

import { webURL } from '@/lib/env'
import { sitemapResponse } from '@/lib/sitemap'

export const GET: APIRoute = () => {
  const base = webURL()
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <sitemap><loc>${base}/pages-sitemap.xml</loc></sitemap>\n` +
    `  <sitemap><loc>${base}/posts-sitemap.xml</loc></sitemap>\n` +
    `</sitemapindex>\n`

  return sitemapResponse(xml)
}
