import config from '@/payload.config'
import { getPayload } from 'payload'

import {
  TARGET_LOCALES,
  TRANSLATABLE,
  type Translatable,
  TranslationError,
  translateDocument,
} from '@/translation/translate'

// A long post takes a while to translate; vercel.json gives this route a
// longer limit than the rest of the API.
export const maxDuration = 300

const json = (body: unknown, status = 200) => Response.json(body, { status })

/**
 * POST /api/translate  { "collection": "posts" | "pages" | "projects", "id": 1, "locales"?: ["ja"] }
 *
 * Called by the admin "Translate" button with the editor's session cookie.
 * Saves the Japanese and Chinese translations as drafts.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return json({ error: 'Log in to translate.' }, 401)
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY is not set on the CMS deployment.' }, 503)
  }

  const body = (await request.json().catch(() => null)) as {
    collection?: unknown
    id?: unknown
    locales?: unknown
  } | null
  const collection = body?.collection
  const id = body?.id
  if (!TRANSLATABLE.includes(collection as Translatable)) {
    return json({ error: 'collection must be posts, pages or projects.' }, 400)
  }
  if (typeof id !== 'string' && typeof id !== 'number') return json({ error: 'Missing id.' }, 400)
  const requested = body?.locales
  const locales = Array.isArray(requested)
    ? TARGET_LOCALES.filter((locale) => requested.includes(locale))
    : TARGET_LOCALES
  if (!locales.length) return json({ error: 'No target locale.' }, 400)

  try {
    const result = await translateDocument({
      payload,
      collection: collection as Translatable,
      id,
      locales,
    })
    return json({ ok: true, ...result })
  } catch (error) {
    payload.logger.error({ err: error, msg: `translate ${String(collection)}/${id} failed` })
    if (error instanceof TranslationError) return json({ error: error.message }, 422)
    return json({ error: 'Translation failed. See the CMS logs.' }, 502)
  }
}
