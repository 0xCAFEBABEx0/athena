import { describe, expect, test } from 'bun:test'

import { isServerCaller } from './auth'
import { EMBEDDING_DIMENSIONS, EmbeddingError, embed, embeddingConfig, modelId } from './embeddings'
import { parseAnswerRequest, parseSearchRequest, questionKey } from './search'

const configured = (env: NodeJS.ProcessEnv) => {
  const config = embeddingConfig(env)
  if (!config) throw new Error('not configured')
  return config
}

const vector = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === seed ? 1 : 0))

type Call = { url: string; body: Record<string, unknown>; auth: string | null }

const fakeFetch = (calls: Call[], respond?: (body: Record<string, unknown>) => Response) =>
  (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    calls.push({ url, body, auth: new Headers(init.headers).get('authorization') })
    if (respond) return respond(body)
    const input = body.input as string[]
    // Out of order on purpose: results are matched by index.
    return Response.json({ data: input.map((_, index) => ({ index, embedding: vector(index) })).reverse() })
  }) as unknown as typeof fetch

describe('TC-U-54 AI index: embeddings', () => {
  test('Voyage is the default: voyage-4-lite, input_type and 1024 dimensions; no key means not configured', () => {
    expect(embeddingConfig({})).toBeNull()
    const config = configured({ VOYAGE_API_KEY: 'k' })
    expect(config).toEqual({ provider: 'voyage', model: 'voyage-4-lite', apiKey: 'k', baseURL: 'https://api.voyageai.com/v1' })
    expect(modelId(config)).toBe('voyage:voyage-4-lite:1024')
    const openai = embeddingConfig({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'o', EMBEDDING_BASE_URL: 'https://gw.example/v1/' })
    expect(openai).toMatchObject({ provider: 'openai', model: 'text-embedding-3-small', baseURL: 'https://gw.example/v1' })
  })

  test('sends the bearer key and the provider-specific body, batches 64 inputs, and returns vectors in input order', async () => {
    const calls: Call[] = []
    const config = configured({ VOYAGE_API_KEY: 'k' })
    const texts = Array.from({ length: 70 }, (_, i) => `t${i}`)
    const vectors = await embed(config, texts, 'document', fakeFetch(calls))
    expect(calls.map((c) => (c.body.input as string[]).length)).toEqual([64, 6])
    expect(calls[0]).toMatchObject({
      url: 'https://api.voyageai.com/v1/embeddings',
      auth: 'Bearer k',
      body: { model: 'voyage-4-lite', input_type: 'document', output_dimension: 1024 },
    })
    expect(vectors).toHaveLength(70)
    expect(vectors[1]?.[1]).toBe(1)

    const openai = configured({ EMBEDDING_PROVIDER: 'openai', OPENAI_API_KEY: 'o' })
    const openaiCalls: Call[] = []
    await embed(openai, ['q'], 'query', fakeFetch(openaiCalls))
    expect(openaiCalls[0]?.body).toEqual({ model: 'text-embedding-3-small', input: ['q'], dimensions: 1024 })
  })

  test('an error status, a short answer or a wrong-sized vector throws EmbeddingError', async () => {
    const config = configured({ VOYAGE_API_KEY: 'k' })
    await expect(embed(config, ['a'], 'query', fakeFetch([], () => new Response('nope', { status: 429 })))).rejects.toThrow(
      EmbeddingError,
    )
    await expect(embed(config, ['a', 'b'], 'query', fakeFetch([], () => Response.json({ data: [{ index: 0, embedding: vector(0) }] })))).rejects.toThrow(
      /1 embeddings for 2 inputs/,
    )
    await expect(embed(config, ['a'], 'query', fakeFetch([], () => Response.json({ data: [{ index: 0, embedding: [1, 2] }] })))).rejects.toThrow(
      /not 1024 numbers/,
    )
  })
})

describe('TC-U-55 AI search: request checks', () => {
  test('search requests: query trimmed, 1–300 characters, unknown language is English, limit clamped', () => {
    expect(parseSearchRequest({ q: '  hello   world ', locale: 'ja' })).toEqual({ q: 'hello world', locale: 'ja', limit: 12 })
    expect(parseSearchRequest({ q: 'x', locale: 'fr', limit: 500 })).toEqual({ q: 'x', locale: 'en', limit: 24 })
    expect(parseSearchRequest({ q: '' })).toBeNull()
    expect(parseSearchRequest({ q: 'a'.repeat(301) })).toBeNull()
    expect(parseSearchRequest(null)).toBeNull()
    expect(parseSearchRequest({ q: 'x', answerModel: 'claude-opus-5-5' })?.answerModel).toBe('claude-opus-5-5')
    expect(parseSearchRequest({ q: 'x', answerModel: 'bad model; drop' })?.answerModel).toBeUndefined()
    expect(questionKey('  How   DO you deploy? ')).toBe('how do you deploy?')
  })

  test('answers to keep: a model, a 64-hex source key, sources and parts, under 32 KB', () => {
    const ok = {
      q: 'How?',
      locale: 'ja',
      answerModel: 'claude-opus-5-5',
      sourceKey: 'a'.repeat(64),
      answer: { sources: [], parts: [{ text: 'Hi.' }] },
    }
    expect(parseAnswerRequest(ok)).toEqual({ ...ok, locale: 'ja' })
    expect(parseAnswerRequest({ ...ok, answerModel: undefined })).toBeNull()
    expect(parseAnswerRequest({ ...ok, sourceKey: 'xyz' })).toBeNull()
    expect(parseAnswerRequest({ ...ok, answer: { parts: [] } })).toBeNull()
    expect(parseAnswerRequest({ ...ok, answer: { sources: [], parts: [{ text: 'x'.repeat(40_000) }] } })).toBeNull()
  })

  test('only the shared REVALIDATE_SECRET as a bearer token counts as the web server', () => {
    const request = (auth?: string) => new Request('https://cms.example/api/ai/search', { headers: auth ? { authorization: auth } : {} })
    expect(isServerCaller(request('Bearer s3cret'), 's3cret')).toBe(true)
    expect(isServerCaller(request('Bearer wrong'), 's3cret')).toBe(false)
    expect(isServerCaller(request('s3cret'), 's3cret')).toBe(false)
    expect(isServerCaller(request(), 's3cret')).toBe(false)
    expect(isServerCaller(request('Bearer '), undefined)).toBe(false)
  })
})
