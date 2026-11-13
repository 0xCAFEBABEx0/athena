import type { APIRoute } from 'astro'

import {
  aiSearchEnabled,
  clientAddress,
  isCrossSite,
  parseAiRequest,
  queryKey,
  relevantChunks,
  searchChunks,
  searchFailure,
} from '@/lib/ai'
import { ANSWER_CHUNKS, type StoredAnswer, ndjson, replay, streamAnswer } from '@/lib/ai-answer'
import { allowToday, allowVisitor } from '@/lib/ai-limits'
import { peekCms, storeCms } from '@/lib/cms-cache'

/**
 * POST /api/ai/ask  { "q": "How do you deploy?", "locale": "ja" }
 *
 * Answers a reader's question from the blog's posts. The body is NDJSON
 * (lib/ai-answer.ts AnswerEvent): the posts used, then the answer text with
 * citation markers as Claude writes it. An answer already given for the same
 * question since the last CMS change is replayed from the Runtime Cache
 * without asking the CMS or Claude, and does not count against the limits.
 */

const MAX_BODY = 2_048

const error = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })

const streamHeaders = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export const POST: APIRoute = async ({ request }) => {
  if (isCrossSite(request)) return error(403, 'forbidden', 'Cross-site request.')
  if (!aiSearchEnabled()) return error(503, 'disabled', 'AI search is not set up.')

  const raw = await request.text()
  if (raw.length > MAX_BODY) return error(413, 'too_large', 'Question is too long.')
  const ask = parseAiRequest((() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })())
  if (!ask) return error(400, 'invalid', 'Ask a question of 1–300 characters.')

  const key = `ai:answer:${queryKey(ask.locale, ask.q)}`
  const cached = await peekCms<StoredAnswer>(key)
  if (cached) return new Response(ndjson(replay(cached)), { headers: streamHeaders })

  if (!allowVisitor(clientAddress(request))) return error(429, 'busy', 'Too many questions. Try again in a few minutes.')
  if (!(await allowToday())) return error(429, 'daily', 'The daily limit for AI answers is used up. Try again tomorrow.')

  const readAt = Date.now()
  let chunks: Awaited<ReturnType<typeof searchChunks>>
  try {
    chunks = relevantChunks(await searchChunks(ask, ANSWER_CHUNKS))
  } catch (cause) {
    const { status, code } = searchFailure(cause)
    if (code !== 'building') console.error('[ai/ask]', cause instanceof Error ? cause.message : cause)
    return error(status, code, code === 'building' ? 'The index is being built.' : 'Search is not available right now.')
  }

  const events = streamAnswer(ask.q, chunks, ask.locale, {
    onDone: (answer) => storeCms(key, answer, readAt),
  })
  return new Response(ndjson(events), { headers: streamHeaders })
}
