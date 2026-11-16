import type { APIRoute } from 'astro'

import {
  AiSearchError,
  aiModeEnabled,
  clientAddress,
  isCrossSite,
  parseAiRequest,
  rankHits,
  searchChunks,
  searchFailure,
} from '@/lib/ai'
import { allowToday, allowVisitor } from '@/lib/ai-limits'
import { readBody } from '@/lib/read-body'

/**
 * POST /api/ai/search  { "q": "deploying without downtime", "locale": "en" }
 *   → { "results": [{ kind, key, slug, href, title, heading, snippet, score }] }
 *
 * Notes and pages (about, builds, stacks, CMS pages) found by meaning, best
 * first. Repeated queries come from the Runtime Cache (lib/ai.ts
 * searchChunks) and skip the limits; a new one counts against the same
 * per-visitor and daily limits as questions.
 */

const MAX_BODY = 2_048
const CHUNKS = 24

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST: APIRoute = async ({ request }) => {
  if (isCrossSite(request)) return json({ error: { code: 'forbidden' } }, 403)
  if (!aiModeEnabled('meaning')) return json({ error: { code: 'disabled' } }, 503)

  const raw = await readBody(request, MAX_BODY)
  if (raw === null) return json({ error: { code: 'too_large' } }, 413)
  let body: unknown = null
  try {
    body = JSON.parse(raw)
  } catch {
    // handled below
  }
  const query = parseAiRequest(body)
  if (!query) return json({ error: { code: 'invalid' } }, 400)

  const visitor = clientAddress(request)
  try {
    const chunks = await searchChunks(query, CHUNKS, {
      beforeLoad: async () => {
        if (!allowVisitor(visitor)) throw new AiSearchError('Too many searches.', 429, 'busy')
        if (!(await allowToday())) throw new AiSearchError('Daily limit reached.', 429, 'daily')
      },
    })
    return json({ results: rankHits(chunks, query.locale) })
  } catch (cause) {
    const { status, code } = searchFailure(cause)
    if (status !== 429 && code !== 'building') {
      console.error('[ai/search]', cause instanceof Error ? cause.message : cause)
    }
    return json({ error: { code } }, status)
  }
}
