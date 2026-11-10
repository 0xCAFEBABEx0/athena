import { defineMiddleware } from 'astro:middleware'

import type { Redirect } from '@athena/shared/payload-types'

import { tagAsContent } from '@/lib/cache'
import { getRedirects } from '@/lib/cms'
import { DEFAULT_LOCALE, localizePath, splitLocale } from '@/lib/i18n'
import { linkHref, type CMSLinkData } from '@/lib/links'

// Per-instance cache, kept short: it only coalesces the burst of renders that
// follows a publish. Pages are cached at Vercel, so a render is rare, and a
// long TTL could bake a just-changed redirect list into freshly cached pages.
const TTL_MS = 5_000
let cache: { redirects: Redirect[]; expires: number } | null = null

const loadRedirects = async (): Promise<Redirect[]> => {
  if (cache && cache.expires > Date.now()) return cache.redirects
  const redirects = await getRedirects()
  cache = { redirects, expires: Date.now() + TTL_MS }
  return redirects
}

export const onRequest = defineMiddleware(async (context, next) => {
  // `/ja/…` and `/zh/…` render the same routes as the English paths: strip
  // the prefix, remember the locale, and rewrite. ISR still caches by the
  // original (prefixed) URL.
  const { locale, path: pathname } = splitLocale(context.url.pathname)
  context.locals.locale = locale
  const render = () =>
    locale === DEFAULT_LOCALE ? next() : next(`${pathname}${context.url.search}`)

  if (pathname.startsWith('/api/')) return render()

  // Everything else (pages, feeds, sitemaps, the search index) is cached at
  // Vercel until /api/invalidate marks this tag stale.
  await tagAsContent()

  // Only content routes can be redirected.
  if (pathname.startsWith('/_') || pathname.includes('.')) {
    return render()
  }

  let redirects: Redirect[] = []
  try {
    redirects = await loadRedirects()
  } catch {
    // CMS unreachable: serve the page rather than failing the request.
    return render()
  }

  const match = redirects.find((redirect) => redirect.from === pathname)
  if (match?.to) {
    const dest =
      match.to.type === 'reference'
        ? linkHref({ type: 'reference', reference: match.to.reference } as CMSLinkData)
        : match.to.url

    if (dest) return context.redirect(localizePath(locale, dest), 301)
  }

  return render()
})
