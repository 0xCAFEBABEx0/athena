import type { APIRoute } from 'astro'

import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import { localizedEntries, sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'
import { getWork } from '@/lib/work'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()

  try {
    // getWork never throws (a CMS outage just leaves /work out).
    const [docs, work] = await Promise.all([getAllSlugs('pages'), getWork({}, DEFAULT_LOCALE)])

    // Fixed routes carry no <lastmod>: Google uses it only when it is
    // accurate, and "now" on every request is not. /search is left out (its
    // pages are noindex), and the CMS "home" page redirects to "/".
    const entries: SitemapEntry[] = [
      ...localizedEntries(base, '/'),
      ...docs
        .filter((doc) => doc.slug && doc.slug !== 'home')
        .flatMap((doc) => localizedEntries(base, `/${doc.slug}`, doc.updatedAt)),
      ...localizedEntries(base, '/posts'),
      ...(work.length > 0 ? localizedEntries(base, '/work') : []),
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
