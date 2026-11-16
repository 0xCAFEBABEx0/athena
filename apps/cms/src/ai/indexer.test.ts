import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import type { Payload } from 'payload'
import { Pool } from 'pg'

import { EMBEDDING_DIMENSIONS } from './embeddings'
import { indexDoc, reindexAll, removeDoc } from './indexer'
import { SCHEMA_SQL, nearestChunks, saveAnswer, storedAnswers } from './store'

/**
 * Runs against a real Postgres with pgvector, given as AI_TEST_POSTGRES_URL
 * (a throwaway database: the test empties ai.chunks and ai.answers). Skipped without it.
 */
const url = process.env.AI_TEST_POSTGRES_URL
const suite = url ? describe : describe.skip

type Doc = {
  id: number
  slug: string
  title: string
  content?: unknown
  meta?: { description?: string }
  _status?: string
  [field: string]: unknown
}

const paragraph = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] })
const body = (...texts: string[]) => ({ root: { type: 'root', children: texts.map(paragraph) } })

/** Published posts per language, as the Local API would return them to a visitor. */
let published: Record<string, Doc[]> = {}
/** Other collections and the globals, per language (same for every language when not split). */
let others: {
  pages?: Doc[]
  projects?: Doc[]
  about?: Record<string, unknown>
  stack?: Record<string, unknown>
} = {}
let embedded: string[] = []
let pool: Pool

type Where = { id?: { equals?: unknown }; _status?: { equals?: unknown }; and?: Where[] }
const conditions = (where?: Where): Where[] =>
  where ? [where, ...(where.and ?? []).flatMap(conditions)] : []

/**
 * The Local API, applying `where` on id and `_status`. Docs without
 * `_status` are published; a draft is returned unless `where` asks for
 * published ones, as for a request whose user can read drafts.
 */
const fakePayload = () =>
  ({
    db: { pool },
    find: async ({
      collection,
      locale,
      where,
    }: {
      collection: string
      locale: string
      where?: Where
    }) => {
      const all = conditions(where)
      const source =
        collection === 'posts'
          ? (published[locale] ?? [])
          : collection === 'pages'
            ? (others.pages ?? [])
            : (others.projects ?? [])
      const docs = source.filter((doc) =>
        all.every(
          (c) =>
            (c.id?.equals === undefined || String(doc.id) === String(c.id.equals)) &&
            (c._status?.equals === undefined || (doc._status ?? 'published') === c._status.equals),
        ),
      )
      return { docs }
    },
    findGlobal: async ({ slug }: { slug: 'about' | 'stack' }) => others[slug] ?? {},
  }) as unknown as Payload

/** One-hot-ish vectors: the first letter of a text picks the dimension. */
const vectorFor = (text: string) => {
  const v = new Array(EMBEDDING_DIMENSIONS).fill(0)
  v[(text.split('\n\n').at(-1) ?? '').charCodeAt(0) % EMBEDDING_DIMENSIONS] = 1
  return v
}

const realFetch = globalThis.fetch

suite('TC-U-56 AI index: Postgres', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: url })
    await pool.query(SCHEMA_SQL)
    process.env.VOYAGE_API_KEY = 'test'
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(String(init.body)) as { input: string[] }
      embedded.push(...input)
      return Response.json({
        data: input.map((text, index) => ({ index, embedding: vectorFor(text) })),
      })
    }) as unknown as typeof fetch
  })

  afterAll(async () => {
    globalThis.fetch = realFetch
    delete process.env.VOYAGE_API_KEY
    await pool.end()
  })

  beforeEach(async () => {
    await pool.query('TRUNCATE ai.chunks, ai.answers')
    embedded = []
    published = {}
    others = {}
  })

  const rows = async () =>
    (
      await pool.query(
        'SELECT kind, doc_id, locale, chunk, slug, title, content FROM ai.chunks ORDER BY kind, doc_id, locale, chunk',
      )
    ).rows

  test('indexes every language, embeds a text once, and re-embeds only what changed', async () => {
    const en: Doc = {
      id: 1,
      slug: 'deploy',
      title: 'Deploy',
      content: body('Alpha text.'),
      meta: { description: 'Zulu summary.' },
    }
    // ja not translated: Payload falls back to the English text.
    published = {
      en: [en],
      ja: [en],
      zh: [{ ...en, title: '部署', content: body('Bravo 文本。') }],
    }

    const first = await indexDoc(fakePayload(), 'post', 1)
    expect(first?.locales).toEqual({
      en: { chunks: 2, embedded: 2 },
      ja: { chunks: 2, embedded: 0 },
      zh: { chunks: 2, embedded: 2 },
    })
    expect(await rows()).toHaveLength(6)

    // Republish unchanged: nothing embedded.
    expect((await indexDoc(fakePayload(), 'post', 1))?.locales.en).toEqual({
      chunks: 2,
      embedded: 0,
    })

    // One paragraph edited in English (ja follows it); the description chunk stays.
    const edited = { ...en, content: body('Charlie text.') }
    published = { ...published, en: [edited], ja: [edited] }
    embedded = []
    await indexDoc(fakePayload(), 'post', 1)
    expect(embedded).toEqual(['Deploy\n\nCharlie text.'])
  })

  test('a language that stops being public, a removed chunk, a renamed slug and a deleted post are reflected', async () => {
    const en: Doc = { id: 2, slug: 'old', title: 'Old', content: body('Alpha.', 'Bravo.') }
    published = { en: [en], ja: [en], zh: [en] }
    await indexDoc(fakePayload(), 'post', 2)

    published = { en: [{ ...en, slug: 'new', content: body('Alpha.') }], ja: [], zh: [] }
    await indexDoc(fakePayload(), 'post', 2)
    expect((await rows()).map((r) => [r.locale, r.slug, r.content])).toEqual([
      ['en', 'new', 'Alpha.'],
    ])

    await removeDoc(fakePayload(), 'post', 2)
    expect(await rows()).toEqual([])
  })

  test('only published posts are indexed, even when the read could see drafts (a script saving with a user)', async () => {
    const draft: Doc = {
      id: 5,
      slug: 'secret',
      title: 'Secret',
      content: body('Delta.'),
      _status: 'draft',
    }
    published = { en: [draft], ja: [draft], zh: [draft] }
    await indexDoc(fakePayload(), 'post', 5)
    expect(await rows()).toEqual([])
    await reindexAll(fakePayload())
    expect(await rows()).toEqual([])
  })

  test('reindexAll indexes every public post and drops posts that are gone; search returns the nearest first', async () => {
    const a: Doc = { id: 3, slug: 'a', title: 'A', content: body('Alpha.') }
    const b: Doc = { id: 4, slug: 'b', title: 'B', content: body('Bravo.') }
    published = { en: [a, b], ja: [a, b], zh: [a, b] }
    expect(await reindexAll(fakePayload())).toEqual({ docs: 2, embedded: 2, removed: 0 })

    published = { en: [b], ja: [b], zh: [b] }
    expect(await reindexAll(fakePayload())).toEqual({ docs: 1, embedded: 0, removed: 3 })

    const hits = await nearestChunks(pool, vectorFor('Bravo'), 'ja', 'voyage:voyage-4-lite:1024', 5)
    expect(hits.map((hit) => [hit.kind, hit.slug, Math.round(hit.score)])).toEqual([
      ['post', 'b', 1],
    ])
    expect(hits[0]?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('pages, builds, /about and /stacks are indexed as visitors see them; search tells them apart by kind', async () => {
    const hero = { richText: body('Echo hero.') }
    const layout = [
      { blockType: 'content', columns: [{ richText: body('Foxtrot column.') }] },
      { blockType: 'mediaBlock', media: 3 },
    ]
    others = {
      pages: [
        { id: 10, slug: 'contact', title: 'Contact', hero, layout },
        // Not routed by the web app.
        { id: 11, slug: 'home', title: 'Home', hero: { richText: body('Golf.') } },
        {
          id: 12,
          slug: 'draft',
          title: 'Draft',
          hero: { richText: body('Hotel.') },
          _status: 'draft',
        },
      ],
      projects: [
        {
          id: 20,
          slug: 'athena',
          title: 'Athena',
          repo: 'me/athena',
          github: {},
          description: 'India site.',
          brief: 'Juliet brief.',
        },
        // Shown only with a live URL.
        {
          id: 21,
          slug: 'secret',
          title: 'Secret',
          repo: '',
          privateRepo: true,
          description: 'Kilo.',
        },
        // GitHub never answered: not on /builds.
        { id: 22, slug: 'typo', title: 'Typo', repo: 'me/typo', description: 'Lima.' },
      ],
      about: { heading: 'About me', lead: 'Mike lead.', body: body('November story.') },
      stack: {
        intro: 'Oscar intro.',
        groups: [
          { title: 'Editors', items: [{ name: 'Papa', note: 'daily' }, { name: '' }] },
          { title: 'Empty', items: [] },
        ],
      },
    }
    expect(await reindexAll(fakePayload())).toMatchObject({ docs: 4 })
    const en = (await rows()).filter((row) => row.locale === 'en')
    expect(en.map((row) => [row.kind, row.doc_id, row.slug, row.title, row.content])).toEqual([
      ['about', 'about', '', 'About me', 'Mike lead.'],
      ['about', 'about', '', 'About me', 'November story.'],
      ['page', '10', 'contact', 'Contact', 'Echo hero.\n\nFoxtrot column.'],
      ['project', '20', 'athena', 'Athena', 'India site.\n\nJuliet brief.'],
      ['stack', 'stack', '', 'Stacks', 'Oscar intro.'],
      ['stack', 'stack', '', 'Stacks', '- Papa: daily'],
    ])
    const hits = await nearestChunks(pool, vectorFor('Echo'), 'en', 'voyage:voyage-4-lite:1024', 1)
    expect(hits.map((hit) => [hit.kind, hit.docId, hit.slug])).toEqual([['page', '10', 'contact']])

    // An emptied /about drops out; a hidden build (no longer returned) is removed by the reindex.
    others = { ...others, about: { heading: 'About me', lead: '', body: body() }, projects: [] }
    await indexDoc(fakePayload(), 'about', 'about')
    expect((await reindexAll(fakePayload()))?.removed).toBe(3)
    expect((await rows()).some((row) => row.kind === 'about' || row.kind === 'project')).toBe(false)
  })

  test('saves wait for the first build, report what changed, and a failed first build leaves the index empty', async () => {
    const a: Doc = { id: 6, slug: 'a', title: 'A', content: body('Alpha.') }
    const b: Doc = { id: 7, slug: 'b', title: 'B', content: body('Bravo.') }
    published = { en: [a, b], ja: [a, b], zh: [a, b] }

    // A save before the first search writes nothing: a few rows would make the index look built.
    expect(await indexDoc(fakePayload(), 'post', 6, undefined, { untilBuilt: true })).toMatchObject({
      waiting: true,
      changed: 0,
    })
    expect(await rows()).toEqual([])

    // The first build fails half way (the embedding call for B): nothing is kept.
    const working = globalThis.fetch
    globalThis.fetch = (async (url: string, init: RequestInit) =>
      String(init.body).includes('Bravo')
        ? new Response('boom', { status: 500 })
        : working(url, init)) as unknown as typeof fetch
    await expect(reindexAll(fakePayload(), { atomic: true })).rejects.toThrow()
    globalThis.fetch = working
    expect(await rows()).toEqual([])

    // While a first build holds the lock, another one starts nothing.
    const holder = await pool.connect()
    await holder.query('BEGIN')
    await holder.query("SELECT pg_advisory_xact_lock(hashtext('ai.chunks first build'))")
    expect(await reindexAll(fakePayload(), { atomic: true })).toBeNull()
    await holder.query('ROLLBACK')
    holder.release()

    expect(await reindexAll(fakePayload(), { atomic: true })).toEqual({ docs: 2, embedded: 2, removed: 0 })

    // Once built, saves index; an unchanged republish changes nothing (no cache expiry), an unpublish does.
    expect((await indexDoc(fakePayload(), 'post', 6, undefined, { untilBuilt: true }))?.changed).toBe(0)
    published = { en: [b], ja: [b], zh: [b] }
    expect((await indexDoc(fakePayload(), 'post', 6, undefined, { untilBuilt: true }))?.changed).toBe(3)
    expect(await removeDoc(fakePayload(), 'post', 7)).toBe(3)
    expect(await rows()).toEqual([])
  })

  test('kept answers: found by the same wording or a question meaning nearly the same, per language and model', async () => {
    const v = (dim: number, tilt = 0) => {
      const x = new Array(EMBEDDING_DIMENSIONS).fill(0)
      x[dim] = 1
      x[dim + 1] = tilt
      return x
    }
    const base = {
      locale: 'en',
      answerModel: 'claude-opus-5-5',
      model: 'voyage:voyage-4-lite:1024',
      sourceKey: 'k1',
    }
    await saveAnswer(pool, {
      ...base,
      question: 'how do you deploy?',
      vector: v(10),
      answer: { parts: ['a'] },
    })
    await saveAnswer(pool, {
      ...base,
      question: 'how do you deploy?',
      vector: v(10),
      sourceKey: 'k2',
      answer: { parts: ['b'] },
    })
    await saveAnswer(pool, {
      ...base,
      question: 'what is the stack?',
      vector: v(20),
      answer: { parts: ['c'] },
    })

    const ask = (question: string, vector: number[], extra: Partial<typeof base> = {}) =>
      storedAnswers(pool, { ...base, ...extra, question, vector })
    // Same wording: replaced, not duplicated.
    expect((await ask('how do you deploy?', v(30))).map((r) => [r.question, r.sourceKey])).toEqual([
      ['how do you deploy?', 'k2'],
    ])
    // Nearly the same meaning (cosine ~0.995) is found; a different one is not.
    expect((await ask('how are deploys done?', v(10, 0.1))).map((r) => r.question)).toEqual([
      'how do you deploy?',
    ])
    expect(await ask('who are you?', v(10, 1))).toEqual([])
    // Other language or model: nothing.
    expect(await ask('how do you deploy?', v(10), { locale: 'ja' })).toEqual([])
    expect(await ask('how do you deploy?', v(10), { answerModel: 'claude-haiku-5-5' })).toEqual([])
  })
})
