import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import type { Payload } from 'payload'
import { Pool } from 'pg'

import { EMBEDDING_DIMENSIONS } from './embeddings'
import { indexPost, reindexAll, removePost } from './indexer'
import { SCHEMA_SQL, nearestChunks } from './store'

/**
 * Runs against a real Postgres with pgvector, given as AI_TEST_POSTGRES_URL
 * (a throwaway database: the test empties ai.post_chunks). Skipped without it.
 */
const url = process.env.AI_TEST_POSTGRES_URL
const suite = url ? describe : describe.skip

type Doc = { id: number; slug: string; title: string; content: unknown; meta?: { description?: string } }

const paragraph = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] })
const body = (...texts: string[]) => ({ root: { type: 'root', children: texts.map(paragraph) } })

/** Published posts per language, as the Local API would return them to a visitor. */
let published: Record<string, Doc[]> = {}
let embedded: string[] = []
let pool: Pool

const fakePayload = () =>
  ({
    db: { pool },
    find: async ({ locale, where }: { locale: string; where?: { id?: { equals?: string } } }) => {
      const docs = published[locale] ?? []
      const id = where?.id?.equals
      return { docs: id === undefined ? docs : docs.filter((doc) => String(doc.id) === String(id)) }
    },
  }) as unknown as Payload

/** One-hot-ish vectors: the first letter of a text picks the dimension. */
const vectorFor = (text: string) => {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0)
  v[(text.split('\n\n').at(-1) ?? '').charCodeAt(0) % EMBEDDING_DIMENSIONS] = 1
  return v
}

const realFetch = globalThis.fetch

suite('TC-U-55 AI index: Postgres', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url })
    await pool.query(SCHEMA_SQL)
    process.env.VOYAGE_API_KEY = 'test'
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(String(init.body)) as { input: string[] }
      embedded.push(...input)
      return Response.json({ data: input.map((text, index) => ({ index, embedding: vectorFor(text) })) })
    }) as unknown as typeof fetch
  })

  afterAll(async () => {
    globalThis.fetch = realFetch
    delete process.env.VOYAGE_API_KEY
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE ai.post_chunks')
    embedded = []
  })

  const rows = async () =>
    (
      await pool.query(
        'SELECT post_id, locale, chunk, slug, title, content FROM ai.post_chunks ORDER BY post_id, locale, chunk',
      )
    ).rows

  test('indexes every language, embeds a text once, and re-embeds only what changed', async () => {
    const en: Doc = { id: 1, slug: 'deploy', title: 'Deploy', content: body('Alpha text.'), meta: { description: 'Zulu summary.' } }
    // ja not translated: Payload falls back to the English text.
    published = { en: [en], ja: [en], zh: [{ ...en, title: '部署', content: body('Bravo 文本。') }] }

    const first = await indexPost(fakePayload(), 1)
    expect(first?.locales).toEqual({
      en: { chunks: 2, embedded: 2 },
      ja: { chunks: 2, embedded: 0 },
      zh: { chunks: 2, embedded: 2 },
    })
    expect(await rows()).toHaveLength(6)

    // Republish unchanged: nothing embedded.
    expect((await indexPost(fakePayload(), 1))?.locales.en).toEqual({ chunks: 2, embedded: 0 })

    // One paragraph edited in English (ja follows it); the description chunk stays.
    const edited = { ...en, content: body('Charlie text.') }
    published = { ...published, en: [edited], ja: [edited] }
    embedded = []
    await indexPost(fakePayload(), 1)
    expect(embedded).toEqual(['Deploy\n\nCharlie text.'])
  })

  test('a language that stops being public, a removed chunk, a renamed slug and a deleted post are reflected', async () => {
    const en: Doc = { id: 2, slug: 'old', title: 'Old', content: body('Alpha.', 'Bravo.') }
    published = { en: [en], ja: [en], zh: [en] }
    await indexPost(fakePayload(), 2)

    published = { en: [{ ...en, slug: 'new', content: body('Alpha.') }], ja: [], zh: [] }
    await indexPost(fakePayload(), 2)
    expect((await rows()).map((r) => [r.locale, r.slug, r.content])).toEqual([['en', 'new', 'Alpha.']])

    await removePost(fakePayload(), 2)
    expect(await rows()).toEqual([])
  })

  test('reindexAll indexes every public post and drops posts that are gone; search returns the nearest first', async () => {
    const a: Doc = { id: 3, slug: 'a', title: 'A', content: body('Alpha.') }
    const b: Doc = { id: 4, slug: 'b', title: 'B', content: body('Bravo.') }
    published = { en: [a, b], ja: [a, b], zh: [a, b] }
    expect(await reindexAll(fakePayload())).toEqual({ posts: 2, embedded: 2, removed: 0 })

    published = { en: [b], ja: [b], zh: [b] }
    expect(await reindexAll(fakePayload())).toEqual({ posts: 1, embedded: 0, removed: 3 })

    const hits = await nearestChunks(pool, vectorFor('Bravo'), 'ja', 'voyage:voyage-4-lite:1024', 5)
    expect(hits.map((hit) => [hit.slug, Math.round(hit.score)])).toEqual([['b', 1]])
  })
})
