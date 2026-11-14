import { waitUntil } from '@vercel/functions'
import type { APIRoute } from 'astro'

import {
  aiModeEnabled,
  clientAddress,
  isCrossSite,
  parseAiRequest,
  queryKey,
  relevantChunks,
  saveAnswer,
  searchCms,
  searchFailure,
} from '@/lib/ai'
import {
  ANSWER_CHUNKS,
  SEARCH_CHUNKS,
  type StoredAnswer,
  answerModel,
  mayReuse,
  ndjson,
  pacedReplay,
  restoreAnswer,
  sourceKey,
  streamAnswer,
} from '@/lib/ai-answer'
import { allowToday, allowVisitor } from '@/lib/ai-limits'
import { peekCms, storeCms } from '@/lib/cms-cache'
import { getSite } from '@/lib/site'

/**
 * POST /api/ai/ask  { "q": "How do you deploy?", "locale": "ja" }
 *
 * Answers a reader's question from the blog's posts. The body is NDJSON
 * (lib/ai-answer.ts AnswerEvent): the posts used, then the answer text with
 * citation markers as Claude writes it.
 *
 * Claude is asked only when no answer is kept for the question (docs/AI_SEARCH.md):
 * 1. Runtime Cache: the same question since the last CMS change (no CMS call,
 *    not counted against the limits).
 * 2. ai.answers on the CMS: the same question, or one meaning nearly the same,
 *    answered before from exactly the same excerpts (survives deploys and
 *    unrelated publishes).
 * Kept answers are replayed at the pace of a new one, with the same events.
 */

const MAX_BODY = 2_048

const error = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })

const streamHeaders = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

const keepInBackground = (promise: Promise<unknown>) => {
  try {
    waitUntil(promise)
  } catch {
    // Outside Vercel: the promise still runs.
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (isCrossSite(request)) return error(403, 'forbidden', 'Cross-site request.')
  if (!aiModeEnabled('ask')) return error(503, 'disabled', 'AI search is not set up.')

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

  // Chosen in the CMS (Site global): a change takes effect without a deploy.
  const site = await getSite(locals, ask.locale)
  const model = answerModel(site.aiModel)
  const key = `ai:answer:${model}:${queryKey(ask.locale, ask.q)}`
  const cached = restoreAnswer(await peekCms<StoredAnswer>(key), ask.locale)
  if (cached) return new Response(ndjson(pacedReplay(cached)), { headers: streamHeaders })

  if (!allowVisitor(clientAddress(request))) return error(429, 'busy', 'Too many questions. Try again in a few minutes.')
  if (!(await allowToday())) return error(429, 'daily', 'The daily limit for AI answers is used up. Try again tomorrow.')

  const readAt = Date.now()
  let search: Awaited<ReturnType<typeof searchCms>>
  try {
    search = await searchCms(ask, SEARCH_CHUNKS, { answerModel: model })
  } catch (cause) {
    const { status, code } = searchFailure(cause)
    if (code !== 'building') console.error('[ai/ask]', cause instanceof Error ? cause.message : cause)
    return error(status, code, code === 'building' ? 'The index is being built.' : 'Search is not available right now.')
  }
  const chunks = relevantChunks(search.results).slice(0, ANSWER_CHUNKS)
  const sources = sourceKey(chunks, model)

  for (const candidate of search.answers) {
    if (!mayReuse(candidate, ask.q, sources, site.aiPresets)) continue
    const kept = restoreAnswer(candidate.answer, ask.locale)
    if (!kept) continue
    storeCms(key, kept, readAt)
    return new Response(ndjson(pacedReplay(kept)), { headers: streamHeaders })
  }

  const events = streamAnswer(ask.q, chunks, ask.locale, {
    model,
    onDone: (answer) => {
      storeCms(key, answer, readAt)
      // Nothing to keep when no excerpt was close: that costs no Claude call.
      if (chunks.length) keepInBackground(saveAnswer({ ...ask, answerModel: model, sourceKey: sources, answer }))
    },
  })
  return new Response(ndjson(events), { headers: streamHeaders })
}
