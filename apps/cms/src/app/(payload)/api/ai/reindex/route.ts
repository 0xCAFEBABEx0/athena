import config from '@/payload.config'
import { getPayload } from 'payload'

import { reindexAll } from '@/ai/indexer'
import { isMissingTable } from '@/ai/store'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/ai/reindex
 *
 * Rebuild the AI search index from every published post. Needed once after
 * the table is created, and after changing the embedding provider or model.
 * Unchanged excerpts are skipped, so running it again is cheap. Any logged-in
 * user (an editor's session cookie, or an API key such as the web-frontend
 * service account's); it reads only what the public can read.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return json({ error: 'Log in to rebuild the AI search index.' }, 401)

  try {
    const result = await reindexAll(payload)
    if (!result) return json({ error: 'No embedding provider API key is set on the CMS deployment.' }, 503)
    return json({ ok: true, ...result })
  } catch (error) {
    if (isMissingTable(error)) {
      return json({ error: 'The AI search table does not exist yet (docs/AI_SEARCH.md).' }, 503)
    }
    payload.logger.error({ err: error, msg: 'AI reindex failed' })
    return json({ error: 'Reindex failed. See the CMS logs.' }, 502)
  }
}
