import config from '@/payload.config'
import { getPayload } from 'payload'

import { isServerCaller } from '@/ai/auth'
import { SearchUnavailableError, keepAnswer, parseAnswerRequest } from '@/ai/search'
import { isMissingTable } from '@/ai/store'

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/ai/answers  { q, locale, answerModel, sourceKey, answer }
 *
 * Keeps an answer the web app had Claude write, so the same question (or
 * one meaning nearly the same) asked again from the same excerpts is
 * answered without Claude, also after a deploy or an unrelated publish
 * (docs/AI_SEARCH.md). Only the web server may call it.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isServerCaller(request)) return json({ error: 'Unauthorized' }, 401)
  const answer = parseAnswerRequest(await request.json().catch(() => null))
  if (!answer) return json({ error: 'Invalid answer.' }, 400)
  const payload = await getPayload({ config })
  try {
    await keepAnswer(payload, answer)
    return json({ ok: true })
  } catch (error) {
    if (error instanceof SearchUnavailableError || isMissingTable(error)) {
      return json({ error: 'Answers cannot be kept on this deployment (docs/AI_SEARCH.md).' }, 503)
    }
    payload.logger.error({ err: error, msg: 'AI answer not kept' })
    return json({ error: 'Failed. See the CMS logs.' }, 502)
  }
}
