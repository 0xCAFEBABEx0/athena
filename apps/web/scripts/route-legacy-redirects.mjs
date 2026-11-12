// Runs after `astro build`. The old section paths (/posts, /work, /stack,
// with or without /ja, /zh and a subpath) answer 308 from middleware.ts,
// keeping the query string. They match the catch-all page, so the adapter
// routes them to the ISR function, which Vercel calls without the query
// (only its own `x_astro_path` parameters are allowed) and caches by path:
// the redirect would lose `?utm_…`, or hand one visitor's query to the next.
// Send them to the plain function instead. Its response carries
// `Vercel-CDN-Cache-Control`, and the CDN keys that cache by the whole URL,
// query included.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { LEGACY_ROUTES, LOCALES, DEFAULT_LOCALE } from '@athena/shared/constants'

const configFile = new URL('../.vercel/output/config.json', import.meta.url)

/** `^/(?:(?:ja|zh)/)?(?:posts|work|stack)(?:/.*)?$`: never `/posts-sitemap.xml` or `/postscript`. */
export const legacyRouteSource = () => {
  const prefixes = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).join('|')
  const sections = Object.keys(LEGACY_ROUTES)
    .map((path) => path.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return `^/(?:(?:${prefixes})/)?(?:${sections})(?:/.*)?$`
}

if (import.meta.main && existsSync(configFile)) {
  const config = JSON.parse(readFileSync(configFile, 'utf8'))
  const routes = config.routes ?? []
  const src = legacyRouteSource()
  const firstIsr = routes.findIndex((route) => typeof route.dest === 'string' && route.dest.startsWith('/_isr'))
  if (firstIsr === -1) {
    throw new Error('[route-legacy-redirects] no ISR route in .vercel/output/config.json')
  }
  if (!routes.some((route) => route.src === src)) {
    routes.splice(firstIsr, 0, { src, dest: '_render' })
    config.routes = routes
    writeFileSync(configFile, `${JSON.stringify(config, null, '\t')}\n`)
  }
  console.log(`[route-legacy-redirects] ${src} -> _render`)
}
