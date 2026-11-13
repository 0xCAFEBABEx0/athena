import type { Payload } from 'payload'

import { LOCALES, type Locale } from '@athena/shared/constants'

import { embed, embeddingConfig, modelId } from './embeddings'
import { type ChunkHit, dbOf, ensureSchema, isEmptyFor, nearestChunks } from './store'

export const MAX_QUERY_CHARS = 300
const MAX_LIMIT = 24

export type SearchRequest = { q: string; locale: Locale; limit: number }

/** Validate a search request body; null when it is not usable. */
export const parseSearchRequest = (body: unknown): SearchRequest | null => {
  if (typeof body !== 'object' || body === null) return null
  const { q, locale, limit } = body as Record<string, unknown>
  if (typeof q !== 'string') return null
  const query = q.replace(/\s+/g, ' ').trim()
  if (!query || query.length > MAX_QUERY_CHARS) return null
  const lang = LOCALES.includes(locale as Locale) ? (locale as Locale) : 'en'
  const n = typeof limit === 'number' && Number.isInteger(limit) ? limit : 12
  return { q: query, locale: lang, limit: Math.min(Math.max(n, 1), MAX_LIMIT) }
}

export class SearchUnavailableError extends Error {}

export type SearchResult = {
  results: ChunkHit[]
  /** True when the index holds nothing for the current model yet: build it. */
  indexEmpty: boolean
}

/** The chunks nearest in meaning to `q`, best first. */
export const semanticSearch = async (payload: Payload, request: SearchRequest): Promise<SearchResult> => {
  const config = embeddingConfig()
  if (!config) throw new SearchUnavailableError('No embedding provider API key is set on the CMS deployment.')
  const db = dbOf(payload)
  await ensureSchema(db)
  const model = modelId(config)
  const [vector] = await embed(config, [request.q], 'query')
  const results = vector ? await nearestChunks(db, vector, request.locale, model, request.limit) : []
  return { results, indexEmpty: results.length === 0 && (await isEmptyFor(db, model)) }
}
