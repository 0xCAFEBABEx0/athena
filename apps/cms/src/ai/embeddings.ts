/**
 * Text embeddings for the AI search index.
 *
 * Anthropic has no embedding model, so this calls another provider over its
 * HTTP API (no SDK, so nothing here depends on Payload or Next). Pick one with
 * EMBEDDING_PROVIDER on the CMS deployment:
 *
 * - `voyage` (default): Voyage AI, VOYAGE_API_KEY, model voyage-4-lite.
 * - `openai`: OpenAI or any OpenAI-compatible embeddings endpoint
 *   (EMBEDDING_BASE_URL), OPENAI_API_KEY, model text-embedding-3-small.
 *
 * EMBEDDING_MODEL overrides the model. Every vector has EMBEDDING_DIMENSIONS
 * numbers, the size of the ai.post_chunks column: changing the provider or
 * model needs a full reindex (POST /api/ai/reindex), and rows written by
 * another model are ignored until then.
 */

export const EMBEDDING_DIMENSIONS = 1024

export type EmbeddingKind = 'document' | 'query'

type Provider = 'voyage' | 'openai'

export type EmbeddingConfig = {
  provider: Provider
  model: string
  apiKey: string
  baseURL: string
}

const DEFAULTS: Record<Provider, { model: string; baseURL: string; keyVar: string }> = {
  voyage: { model: 'voyage-4-lite', baseURL: 'https://api.voyageai.com/v1', keyVar: 'VOYAGE_API_KEY' },
  openai: { model: 'text-embedding-3-small', baseURL: 'https://api.openai.com/v1', keyVar: 'OPENAI_API_KEY' },
}

export class EmbeddingError extends Error {}

/** The configured provider, or null when its API key is not set. */
export const embeddingConfig = (env: NodeJS.ProcessEnv = process.env): EmbeddingConfig | null => {
  const provider: Provider = env.EMBEDDING_PROVIDER === 'openai' ? 'openai' : 'voyage'
  const defaults = DEFAULTS[provider]
  const apiKey = env[defaults.keyVar]
  if (!apiKey) return null
  return {
    provider,
    model: env.EMBEDDING_MODEL || defaults.model,
    apiKey,
    baseURL: (env.EMBEDDING_BASE_URL || defaults.baseURL).replace(/\/$/, ''),
  }
}

/** Stored with every row, so vectors from different models never mix. */
export const modelId = (config: EmbeddingConfig): string =>
  `${config.provider}:${config.model}:${EMBEDDING_DIMENSIONS}`

/** Inputs per request; well inside both providers' limits. */
const BATCH = 64

type EmbeddingResponse = { data?: { embedding?: unknown; index?: number }[] }

const requestBody = (config: EmbeddingConfig, input: string[], kind: EmbeddingKind) =>
  config.provider === 'voyage'
    ? { model: config.model, input, input_type: kind, output_dimension: EMBEDDING_DIMENSIONS }
    : { model: config.model, input, dimensions: EMBEDDING_DIMENSIONS }

/** Embed `texts` in order. Throws EmbeddingError on any provider failure. */
export const embed = async (
  config: EmbeddingConfig,
  texts: string[],
  kind: EmbeddingKind,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][]> => {
  const vectors: number[][] = []
  for (let start = 0; start < texts.length; start += BATCH) {
    const input = texts.slice(start, start + BATCH)
    const res = await fetchImpl(`${config.baseURL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(requestBody(config, input, kind)),
      signal: AbortSignal.timeout(20_000),
    }).catch((error: unknown) => {
      throw new EmbeddingError(`${config.provider} embeddings unreachable: ${String(error)}`)
    })
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      throw new EmbeddingError(`${config.provider} embeddings failed: ${res.status} ${detail}`)
    }
    const body = (await res.json().catch(() => ({}))) as EmbeddingResponse
    const rows = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    if (rows.length !== input.length) {
      throw new EmbeddingError(`${config.provider} returned ${rows.length} embeddings for ${input.length} inputs`)
    }
    for (const row of rows) {
      const vector = row.embedding
      if (
        !Array.isArray(vector) ||
        vector.length !== EMBEDDING_DIMENSIONS ||
        !vector.every((n) => typeof n === 'number' && Number.isFinite(n))
      ) {
        throw new EmbeddingError(`${config.provider} returned a vector that is not ${EMBEDDING_DIMENSIONS} numbers`)
      }
      vectors.push(vector as number[])
    }
  }
  return vectors
}
