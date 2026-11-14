import config from '@/payload.config'
import { after } from 'next/server'
import { getPayload } from 'payload'

import { isServerCaller } from '@/ai/auth'
import { reindexAll } from '@/ai/indexer'
import { SearchUnavailableError, parseSearchRequest, semanticSearch } from '@/ai/search'
import { isMissingTable } from '@/ai/store'

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/ai/search  { "q": "…", "locale": "en" | "ja" | "zh", "limit"?: 12, "answerModel"?: "claude-…" }
 *   → { results, building, answers? }
 *
 * With `answerModel` (Ask AI), `answers` lists the answers that model wrote
 * before for this question or one meaning nearly the same (ai.answers).
 *
 * Semantic search over published posts: embeds the query and returns the
 * nearest post excerpts, best first. Called server-side by the web app
 * (Authorization: Bearer REVALIDATE_SECRET, the secret both deployments
 * already share) or by a logged-in editor; every call costs an embedding
 * request, so it is not open to the public.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  if (!isServerCaller(request)) {
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return json({ error: 'Unauthorized' }, 401)
  }
  const query = parseSearchRequest(await request.json().catch(() => null))
  if (!query) return json({ error: 'q must be 1-300 characters.' }, 400)

  try {
    const { results, indexEmpty, answers } = await semanticSearch(payload, query)
    if (indexEmpty) {
      // First search after the table was created or the embedding model
      // changed: build the index in the background, so the next search finds
      // posts without anyone calling /api/ai/reindex.
      after(async () => {
        try {
          payload.logger.info({ msg: 'AI index: built on first search', result: await reindexAll(payload) })
        } catch (error) {
          payload.logger.error({ err: error, msg: 'AI index: first build failed' })
        }
      })
    }
    return json({ results, building: indexEmpty, ...(answers ? { answers } : {}) })
  } catch (error) {
    if (error instanceof SearchUnavailableError) return json({ error: error.message }, 503)
    if (isMissingTable(error)) {
      return json({ error: 'The AI search table does not exist yet (docs/AI_SEARCH.md).' }, 503)
    }
    payload.logger.error({ err: error, msg: 'AI search failed' })
    return json({ error: 'Search failed. See the CMS logs.' }, 502)
  }
}
