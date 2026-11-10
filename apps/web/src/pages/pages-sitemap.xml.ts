import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import { localizedEntries, sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'
import { getWork } from '@/lib/work'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()
  const now = new Date().toISOString()

  try {
    // getWork never throws (a CMS outage just leaves /work out).
    const [docs, work] = await Promise.all([getAllSlugs('pages'), getWork({}, DEFAULT_LOCALE)])

    const entries: SitemapEntry[] = [
      ...docs.flatMap((doc) =>
        localizedEntries(base, doc.slug === 'home' ? '/' : `/${doc.slug}`, doc.updatedAt),
      ),
      ...localizedEntries(base, '/search', now),
      ...localizedEntries(base, '/posts', now),
      ...(work.length > 0 ? localizedEntries(base, '/work', now) : []),
      ...work.flatMap((item) =>
        localizedEntries(base, `/work/${item.slug}`, item.pushedAt || undefined),
      ),
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
