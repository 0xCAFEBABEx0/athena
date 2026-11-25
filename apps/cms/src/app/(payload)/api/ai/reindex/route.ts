import config from '@/payload.config'
import { getPayload } from 'payload'

import { isEditorUser } from '@/access/isEditor'
import { reindexAll } from '@/ai/indexer'
import { isMissingTable } from '@/ai/store'
import { invalidateWebAiResults } from '@/utilities/invalidateWeb'

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/ai/reindex
 *
 * Rebuild the AI search index from everything visitors can read. Needed once after
 * the table is created, and after changing the embedding provider or model.
 * Unchanged excerpts are skipped, so running it again is cheap. Editors only
 * (session cookie or an editor's API key; not the read-only web-frontend
 * service account); it reads only what the public can read.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!isEditorUser(user))
    return json({ error: 'Log in as an editor to rebuild the AI search index.' }, 401)

  try {
    const result = await reindexAll(payload)
    if (!result)
      return json({ error: 'No embedding provider API key is set on the CMS deployment.' }, 503)
    await invalidateWebAiResults(payload)
    return json({ ok: true, ...result })
  } catch (error) {
    // Documents before the failure may already be rewritten.
    await invalidateWebAiResults(payload)
    if (isMissingTable(error)) {
      return json({ error: 'The AI search table does not exist yet (docs/AI_SEARCH.md).' }, 503)
    }
    payload.logger.error({ err: error, msg: 'AI reindex failed' })
    return json({ error: 'Reindex failed. See the CMS logs.' }, 502)
  }
}
