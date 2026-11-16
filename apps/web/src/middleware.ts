import { defineMiddleware } from 'astro:middleware'
import type { APIContext, MiddlewareNext } from 'astro'

import { currentRoute } from '@athena/shared/constants'
import type { Redirect } from '@athena/shared/payload-types'

import { tagAsContent } from '@/lib/cache'
import { getRedirects } from '@/lib/cms'
import { withFreshCmsReads } from '@/lib/cms-cache'
import { env } from '@/lib/env'
import { withFramePolicy } from '@/lib/frame-policy'
import { DEFAULT_LOCALE, localizePath, splitLocale, type Locale } from '@/lib/i18n'
import { linkHref, type CMSLinkData } from '@/lib/links'
import { isrBypassToken } from '@/lib/isr-bypass.mjs'
import { getFooterNav, getHeaderNav, getRecentPosts } from '@/lib/nav'
import { getSite } from '@/lib/site'
import { getWork } from '@/lib/work'

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

// Routes whose path has a dot. Any other dotted path that reaches the
// function (static files never do) is a scanner probing for /wp-login.php,
// /.env and the like: answer 404 at once, without the CMS requests a page
// render makes, and let the CDN keep the answer for a day.
const DOTTED_ROUTES = new Set([
  '/rss.xml',
  '/sitemap.xml',
  '/pages-sitemap.xml',
  '/posts-sitemap.xml',
  '/robots.txt',
  '/llms.txt',
  '/search-index.json',
])

// /builds/<repo> pages keep the repository name, which may contain dots
// (`owner/my.app` -> /builds/my.app; see the CMS Projects collection's slugOf).
const WORK_DETAIL = /^\/builds\/[a-z0-9._-]+\/?$/

const isDotted = (pathname: string): boolean =>
  pathname.includes('.') && !WORK_DETAIL.test(pathname)

/**
 * Permanent redirect for a section renamed in 1.2.0 (`/posts/x` → `/notes/x`,
 * `/ja/work` → `/ja/builds`, `/stack` → `/stacks`), kept at the CDN for a day
 * so old links rarely reach a function.
 */
const movedPermanently = (location: string) =>
  new Response(null, {
    status: 308,
    headers: {
      Location: location,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Vercel-CDN-Cache-Control': 'public, max-age=86400',
    },
  })

const notFound = () =>
  new Response('Not found\n', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Vercel-CDN-Cache-Control': 'public, max-age=86400',
    },
  })

/**
 * The CMS Redirects entry for this path, as a 301, or null. An entry written
 * for an old section path (`/posts/old-slug`) also answers its renamed path
 * (`/notes/old-slug`), because CMS links typed with the old path are rewritten
 * to the new one before anyone clicks them; an exact entry wins.
 */
const cmsRedirect = (
  redirects: Redirect[],
  pathname: string,
  locale: Locale,
  context: APIContext,
): Response | null => {
  const match =
    redirects.find((redirect) => redirect.from === pathname) ??
    redirects.find(
      (redirect) =>
        typeof redirect.from === 'string' &&
        redirect.from !== pathname &&
        currentRoute(redirect.from) === pathname,
    )
  if (!match?.to) return null
  const dest =
    match.to.type === 'reference'
      ? linkHref({ type: 'reference', reference: match.to.reference } as CMSLinkData)
      : match.to.url
  return dest ? context.redirect(localizePath(locale, dest), 301) : null
}

const handle = async (context: APIContext, next: MiddlewareNext): Promise<Response> => {
  // `/ja/…` and `/zh/…` render the same routes as the English paths: strip
  // the prefix, remember the locale, and rewrite. ISR still caches by the
  // original (prefixed) URL.
  const { locale, path: pathname } = splitLocale(context.url.pathname)
  // A page that rewrites to /404 runs this again with the unprefixed URL:
  // keep the locale of the original request (/zh/nope shows the Chinese 404).
  if (!context.locals.locale || locale !== DEFAULT_LOCALE) context.locals.locale = locale
  const render = () =>
    locale === DEFAULT_LOCALE ? next() : next(`${pathname}${context.url.search}`)

  if (pathname.startsWith('/api/')) return render()

  const moved = currentRoute(pathname)
  if (moved !== pathname) {
    // A Redirects entry written for an old path (`/posts/old-slug`) still
    // wins over the section rename, as it did before 1.2.0.
    const own = await loadRedirects()
      .then((redirects) => cmsRedirect(redirects, pathname, locale, context))
      .catch(() => null)
    return own ?? movedPermanently(`${localizePath(locale, moved)}${context.url.search}`)
  }

  // Everything else (pages, feeds, sitemaps, the search index) is cached at
  // Vercel until /api/invalidate marks this tag stale.
  await tagAsContent()

  if (isDotted(pathname) && !pathname.startsWith('/_') && !DOTTED_ROUTES.has(pathname)) {
    return notFound()
  }

  // Only content routes can be redirected.
  if (pathname.startsWith('/_') || isDotted(pathname)) {
    return render()
  }

  // Every page's layout needs the same CMS data (site settings, header and
  // footer nav, recent posts and work for the sidebar). Start those requests
  // now, alongside the redirect lookup, instead of one after another as the
  // components render; the per-request memos hand the same promises to the
  // page. None of them throws, so an unused one costs nothing but a fetch.
  void Promise.all([
    getSite(context.locals, locale),
    getHeaderNav(context.locals, locale),
    getFooterNav(context.locals, locale),
    getRecentPosts(context.locals, locale),
    getWork(context.locals, locale),
  ])

  let redirects: Redirect[] = []
  try {
    redirects = await loadRedirects()
  } catch {
    // CMS unreachable: serve the page rather than failing the request.
    return render()
  }

  return cmsRedirect(redirects, pathname, locale, context) ?? render()
}

/**
 * True for the re-renders /api/invalidate requests right after a CMS change
 * (and Vercel's own ISR revalidation with the same token): they must read the
 * CMS itself, not the Runtime Cache copy from before the change.
 */
const isRevalidation = (request: Request): boolean => {
  const token = request.headers.get('x-prerender-revalidate')
  return Boolean(token) && token === isrBypassToken(env('REVALIDATE_SECRET'))
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isRevalidation(context.request)) return withFramePolicy(await handle(context, next))
  console.info(`[cms-cache] fresh CMS reads for ${context.url.pathname}`)
  return withFramePolicy(await withFreshCmsReads(() => handle(context, next)))
})
