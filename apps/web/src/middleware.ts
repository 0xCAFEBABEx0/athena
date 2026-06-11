import { defineMiddleware } from 'astro:middleware'

import type { Redirect } from '@athena/shared/payload-types'

import { getRedirects } from '@/lib/cms'
import { linkHref, type CMSLinkData } from '@/lib/links'

// Per-instance cache; redirects rarely change and a publish re-renders pages
// anyway (the CMS pushes a 'redirects' tag through /api/invalidate, bounded
// by the ISR expiration TTL).
const TTL_MS = 60_000
let cache: { redirects: Redirect[]; expires: number } | null = null

const loadRedirects = async (): Promise<Redirect[]> => {
  if (cache && cache.expires > Date.now()) return cache.redirects
  const redirects = await getRedirects()
  cache = { redirects, expires: Date.now() + TTL_MS }
  return redirects
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // Only content routes can be redirected.
  if (pathname.startsWith('/api/') || pathname.startsWith('/_') || pathname.includes('.')) {
    return next()
  }

  let redirects: Redirect[] = []
  try {
    redirects = await loadRedirects()
  } catch {
    // CMS unreachable: serve the page rather than failing the request.
    return next()
  }

  const match = redirects.find((redirect) => redirect.from === pathname)
  if (match?.to) {
    const dest =
      match.to.type === 'reference'
        ? linkHref({ type: 'reference', reference: match.to.reference } as CMSLinkData)
        : match.to.url

    if (dest) return context.redirect(dest, 301)
  }

  return next()
})
