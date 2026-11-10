import type { APIRoute } from 'astro'

import { getPosts } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { DEFAULT_LOCALE } from '@/lib/i18n'
import { buildLlmsTxt } from '@/lib/llms'
import { getSite } from '@/lib/site'
import { getWork } from '@/lib/work'

/**
 * /llms.txt, built from the CMS (lib/llms.ts) instead of a static file.
 * English only; the other languages are listed with their prefixes.
 */
export const GET: APIRoute = async ({ locals }) => {
  const [site, posts, work] = await Promise.all([
    getSite(locals, DEFAULT_LOCALE),
    getPosts({ page: 1, limit: 10 }, { locale: DEFAULT_LOCALE }).catch(() => null),
    getWork(locals, DEFAULT_LOCALE),
  ])
  return new Response(buildLlmsTxt({ origin: webURL(), site, posts: posts?.docs ?? [], work }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
