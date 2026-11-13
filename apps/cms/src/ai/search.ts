import type { Payload } from 'payload'

import { LOCALES, type Locale } from '@athena/shared/constants'

import { embed, embeddingConfig, modelId } from './embeddings'
import {
  type ChunkHit,
  type StoredAnswerRow,
  dbOf,
  ensureSchema,
  isEmptyFor,
  isMissingTable,
  nearestChunks,
  saveAnswer,
  storedAnswers,
} from './store'

export const MAX_QUERY_CHARS = 300
const MAX_LIMIT = 24

export type SearchRequest = {
  q: string
  locale: Locale
  limit: number
  /** Also return answers kept for this question by this Claude model. */
  answerModel?: string
}

/** The question as stored in ai.answers: case and spacing do not make another question. */
export const questionKey = (q: string): string => q.replace(/\s+/g, ' ').trim().toLowerCase()

/** Validate a search request body; null when it is not usable. */
export const parseSearchRequest = (body: unknown): SearchRequest | null => {
  if (typeof body !== 'object' || body === null) return null
  const { q, locale, limit, answerModel } = body as Record<string, unknown>
  if (typeof q !== 'string') return null
  const query = q.replace(/\s+/g, ' ').trim()
  if (!query || query.length > MAX_QUERY_CHARS) return null
  const lang = LOCALES.includes(locale as Locale) ? (locale as Locale) : 'en'
  const n = typeof limit === 'number' && Number.isInteger(limit) ? limit : 12
  const request: SearchRequest = { q: query, locale: lang, limit: Math.min(Math.max(n, 1), MAX_LIMIT) }
  if (typeof answerModel === 'string' && /^[\w.:-]{1,100}$/.test(answerModel)) request.answerModel = answerModel
  return request
}

export class SearchUnavailableError extends Error {}

export type SearchResult = {
  results: ChunkHit[]
  /** True when the index holds nothing for the current model yet: build it. */
  indexEmpty: boolean
  /** With `answerModel`: kept answers to this question or one meaning nearly the same. */
  answers?: StoredAnswerRow[]
}

const MAX_ANSWER_BYTES = 32_000
const SOURCE_KEY = /^[0-9a-f]{64}$/

export type AnswerRequest = { q: string; locale: Locale; answerModel: string; sourceKey: string; answer: unknown }

/** Validate an answer the web app wants kept; null when it is not usable. */
export const parseAnswerRequest = (body: unknown): AnswerRequest | null => {
  const search = parseSearchRequest(body)
  if (!search?.answerModel) return null
  const { sourceKey, answer } = body as Record<string, unknown>
  if (typeof sourceKey !== 'string' || !SOURCE_KEY.test(sourceKey)) return null
  if (typeof answer !== 'object' || answer === null) return null
  const { sources, parts } = answer as Record<string, unknown>
  if (!Array.isArray(sources) || !Array.isArray(parts)) return null
  if (JSON.stringify(answer).length > MAX_ANSWER_BYTES) return null
  return { q: search.q, locale: search.locale, answerModel: search.answerModel, sourceKey, answer }
}

/** Keep an answer for its question (embedded again here, so paraphrases find it). */
export const keepAnswer = async (payload: Payload, request: AnswerRequest): Promise<void> => {
  const config = embeddingConfig()
  if (!config) throw new SearchUnavailableError('No embedding provider API key is set on the CMS deployment.')
  const db = dbOf(payload)
  await ensureSchema(db)
  const [vector] = await embed(config, [request.q], 'query')
  if (!vector) return
  await saveAnswer(db, {
    locale: request.locale,
    question: questionKey(request.q),
    answerModel: request.answerModel,
    model: modelId(config),
    vector,
    sourceKey: request.sourceKey,
    answer: request.answer,
  })
}

/** The chunks nearest in meaning to `q`, best first. */
export const semanticSearch = async (payload: Payload, request: SearchRequest): Promise<SearchResult> => {
  const config = embeddingConfig()
  if (!config) throw new SearchUnavailableError('No embedding provider API key is set on the CMS deployment.')
  const db = dbOf(payload)
  await ensureSchema(db)
  const model = modelId(config)
  const [vector] = await embed(config, [request.q], 'query')
  if (!vector) return { results: [], indexEmpty: false }
  const [results, answers] = await Promise.all([
    nearestChunks(db, vector, request.locale, model, request.limit),
    request.answerModel
      ? storedAnswers(db, {
          vector,
          locale: request.locale,
          question: questionKey(request.q),
          answerModel: request.answerModel,
          model,
        }).catch((error: unknown) => {
          // ai.answers is newer than ai.post_chunks: search still works without it.
          if (isMissingTable(error)) return []
          throw error
        })
      : undefined,
  ])
  return {
    results,
    indexEmpty: results.length === 0 && (await isEmptyFor(db, model)),
    ...(answers ? { answers } : {}),
  }
}
