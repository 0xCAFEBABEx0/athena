// @ts-check
import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel'
import tailwindcss from '@tailwindcss/vite'

// On-demand rendering everywhere: draft preview needs per-request cookie
// checks, and the CMS pushes cache invalidation through /api/invalidate.
// ISR caches the rendered HTML at the edge; the bypass token lets the
// invalidate endpoint force a re-render (and keeps draft requests out of
// the shared cache).
export default defineConfig({
  output: 'server',
  site: process.env.WEB_URL || 'http://localhost:4321',
  adapter: vercel({
    webAnalytics: { enabled: true },
    isr: {
      bypassToken: process.env.REVALIDATE_SECRET,
      exclude: [/^\/api\/.+/],
      // Safety net for tag-level invalidations that cannot be mapped to
      // concrete paths (header/footer/redirects): stale HTML expires on
      // its own after 5 minutes.
      expiration: 300,
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
})
