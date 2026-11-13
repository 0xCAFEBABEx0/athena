import type { APIRoute } from 'astro'

import {
  AiSearchError,
  aiSearchEnabled,
  clientAddress,
  isCrossSite,
  parseAiRequest,
  rankPosts,
  searchChunks,
} from '@/lib/ai'
import { allowToday, allowVisitor } from '@/lib/ai-limits'

/**
 * POST /api/ai/search  { "q": "deploying without downtime", "locale": "en" }
 *   → { "posts": [{ slug, href, title, heading, snippet, score }] }
 *
 * Posts found by meaning, best first. Repeated queries come from the Runtime
 * Cache (lib/ai.ts searchChunks) and skip the limits; a new one counts
 * against the same per-visitor and daily limits as questions.
 */

const MAX_BODY = 2_048
const CHUNKS = 24

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export const POST: APIRoute = async ({ request }) => {
  if (isCrossSite(request)) return json({ error: { code: 'forbidden' } }, 403)
  if (!aiSearchEnabled()) return json({ error: { code: 'disabled' } }, 503)

  const raw = await request.text()
  if (raw.length > MAX_BODY) return json({ error: { code: 'too_large' } }, 413)
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
        if (!allowVisitor(visitor)) throw new AiSearchError('busy', 429)
        if (!(await allowToday())) throw new AiSearchError('daily', 429)
      },
    })
    return json({ posts: rankPosts(chunks, query.locale) })
  } catch (cause) {
    if (cause instanceof AiSearchError && cause.status === 429) {
      return json({ error: { code: cause.message } }, 429)
    }
    console.error('[ai/search]', cause instanceof Error ? cause.message : cause)
    const status = cause instanceof AiSearchError && cause.status === 503 ? 503 : 502
    return json({ error: { code: 'search' } }, status)
  }
}
