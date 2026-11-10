// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'

import { isrBypassToken } from './src/lib/isr-bypass.mjs'

// On-demand rendering everywhere: draft preview needs per-request cookie
// checks, and the CMS pushes cache invalidation through /api/invalidate.
// ISR caches the rendered HTML at Vercel; the bypass token lets the invalidate
// endpoint force a re-render, and /api/preview puts it in the
// `__prerender_bypass` cookie so draft requests skip the shared cache.
export default defineConfig({
  output: 'server',
  site: process.env.WEB_URL || 'http://localhost:4321',
  // Astro 7 defaults to JSX-style whitespace stripping ('jsx'), which drops the
  // spaces between inline elements. Keep the v6 HTML-aware behavior.
  compressHTML: true,
  // Media are plain <img> tags pointing at Vercel Blob; nothing uses
  // astro:assets. The passthrough service keeps sharp (about 20 MB of native
  // binaries) out of both server functions, which shortens the build's
  // function bundling, the deploy upload and cold starts.
  image: { service: passthroughImageService() },
  adapter: vercel({
    webAnalytics: { enabled: true },
    isr: {
      bypassToken: isrBypassToken(process.env.REVALIDATE_SECRET),
      // ISR keys the cache by path and drops the query string, so the search
      // page (?q=) must not use it; it is CDN-cached per URL instead. The
      // /ja and /zh copies are matched by [...slug], so list them as URLs.
      exclude: [/^\/api\/.+/, '/search', '/ja/search', '/zh/search'],
      // Content changes reach the cache through /api/invalidate (cache tag
      // plus the changed paths). This TTL is only a safety net for a missed
      // webhook, kept long so pages rarely re-render (and wake the CMS and
      // its database) when nothing changed.
      expiration: 60 * 60 * 24 * 7,
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
})
