import { ROUTES } from '@athena/shared/constants'
import type { APIRoute } from 'astro'

import { aboutHasContent, getAbout } from '@/lib/about'
import { getAllSlugs } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import { localizedEntries, sitemapResponse, sitemapXML, type SitemapEntry } from '@/lib/sitemap'
import { getStack } from '@/lib/stack'
import { getWork } from '@/lib/work'

export const GET: APIRoute = async ({ url }) => {
  const base = url.origin || webURL()

  try {
    // getWork, getStack and getAbout never throw (a CMS outage just leaves
    // /builds, /stacks or /about out).
    const [docs, work, stack, about] = await Promise.all([
      getAllSlugs('pages'),
      getWork({}, DEFAULT_LOCALE),
      getStack(DEFAULT_LOCALE),
      getAbout(DEFAULT_LOCALE),
    ])

    // Fixed routes carry no <lastmod>: Google uses it only when it is
    // accurate, and "now" on every request is not. /search is left out (its
    // pages are noindex), and the CMS "home" page redirects to "/".
    const entries: SitemapEntry[] = [
      ...localizedEntries(base, '/'),
      // A CMS page with the slug "about" is shadowed by the /about route.
      ...docs
        .filter((doc) => doc.slug && doc.slug !== 'home' && `/${doc.slug}` !== ROUTES.about)
        .flatMap((doc) => localizedEntries(base, `/${doc.slug}`, doc.updatedAt)),
      ...localizedEntries(base, ROUTES.posts),
      ...(work.length > 0 ? localizedEntries(base, ROUTES.work) : []),
      ...work.flatMap((item) =>
        localizedEntries(base, `${ROUTES.work}/${item.slug}`, item.pushedAt || undefined),
      ),
      ...(stack && stack.groups.length + stack.former.length > 0
        ? localizedEntries(base, ROUTES.stack)
        : []),
      ...(about && aboutHasContent(about) ? localizedEntries(base, ROUTES.about) : []),
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
