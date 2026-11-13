import { describe, expect, test } from 'bun:test'

import type Anthropic from '@anthropic-ai/sdk'

import type { ChunkHit } from './ai'
import {
  type AnswerClient,
  type AnswerEvent,
  type StoredAnswer,
  buildMessages,
  compactParts,
  ndjson,
  numberSources,
  pacedReplay,
  replay,
  restoreAnswer,
  sourceKey,
  streamAnswer,
  streamPieces,
  systemPrompt,
} from './ai-answer'

const chunk = (slug: string, heading: string | null = null, content = `About ${slug}.`): ChunkHit => ({
  postId: slug,
  slug,
  title: slug.toUpperCase(),
  heading,
  content,
  hash: `h-${slug}-${heading ?? ''}`,
  score: 0.5,
})

type Event = Anthropic.Beta.BetaRawMessageStreamEvent

const textStart = (index: number) => ({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } }) as Event
const text = (index: number, value: string) => ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: value } }) as Event
const cite = (index: number, result: number) =>
  ({
    type: 'content_block_delta',
    index,
    delta: { type: 'citations_delta', citation: { type: 'search_result_location', search_result_index: result } },
  }) as unknown as Event
const stop = (index: number) => ({ type: 'content_block_stop', index }) as Event

const fakeClient = (events: Event[], stopReason = 'end_turn', seen: unknown[] = []): AnswerClient => ({
  stream: (params) => {
    seen.push(params)
    return {
      async *[Symbol.asyncIterator]() {
        yield* events
      },
      finalMessage: async () => ({ stop_reason: stopReason }) as Anthropic.Beta.BetaMessage,
    }
  },
})

const collect = async (events: AsyncIterable<AnswerEvent>) => {
  const out: AnswerEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

describe('TC-U-60 AI answers', () => {
  test('posts are numbered in order of first appearance; excerpts of one post share its number', () => {
    const { sources, sourceOf } = numberSources([chunk('a', 'One'), chunk('b'), chunk('a', 'Two')], 'zh')
    expect(sources).toEqual([
      { n: 1, slug: 'a', title: 'A', href: '/zh/notes/a', heading: 'One' },
      { n: 2, slug: 'b', title: 'B', href: '/zh/notes/b', heading: null },
    ])
    expect(sourceOf).toEqual([1, 2, 1])
  })

  test('excerpts go to Claude as cited search results, followed by the question; the answer language is the page language', () => {
    const chunks = [chunk('a', 'Setup'), chunk('b')]
    const { sources, sourceOf } = numberSources(chunks, 'ja')
    const [message] = buildMessages('How?', chunks, sources, sourceOf)
    const content = message?.content as Anthropic.Beta.BetaContentBlockParam[]
    expect(content[0]).toEqual({
      type: 'search_result',
      source: '/ja/notes/a',
      title: 'A — Setup',
      content: [{ type: 'text', text: 'About a.' }],
      citations: { enabled: true },
    })
    expect(content.at(-1)).toEqual({ type: 'text', text: "Reader's question: How?" })
    expect(systemPrompt('ja')).toContain('Answer in Japanese')
    expect(systemPrompt('zh')).toContain('Simplified Chinese')
  })

  test('streams the sources, then the text, with each text block’s citations after it; the finished answer is handed over for the cache', async () => {
    const seen: unknown[] = []
    let stored: StoredAnswer | undefined
    const events = await collect(
      streamAnswer('How?', [chunk('a'), chunk('b'), chunk('a', 'More')], 'en', {
        client: fakeClient(
          [textStart(0), text(0, 'It is '), text(0, 'built.'), cite(0, 0), cite(0, 2), cite(0, 1), stop(0), textStart(1), text(1, ' Done.'), stop(1)],
          'end_turn',
          seen,
        ),
        onDone: (answer) => {
          stored = answer
        },
      }),
    )
    expect(events.map((event) => event.type)).toEqual(['sources', 'text', 'text', 'cite', 'cite', 'text', 'done'])
    expect(events.filter((event) => event.type === 'cite')).toEqual([
      { type: 'cite', n: 1 },
      { type: 'cite', n: 2 },
    ])
    expect(stored?.parts).toEqual([{ text: 'It is built.' }, { cite: 1 }, { cite: 2 }, { text: ' Done.' }])
    expect(seen[0]).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      fallbacks: 'default',
    })

    // The model chosen in the CMS is used; Haiku has no server-side fallback.
    const haiku: unknown[] = []
    await collect(streamAnswer('How?', [chunk('a')], 'en', { client: fakeClient([], 'end_turn', haiku), model: 'claude-haiku-5-5' }))
    expect(haiku[0]).toMatchObject({ model: 'claude-haiku-5-5' })
    expect(haiku[0]).not.toHaveProperty('fallbacks')
    expect(haiku[0]).not.toHaveProperty('betas')
  })

  test('no excerpts: no call to Claude; a refusal or a failure is reported and not cached', async () => {
    let calls = 0
    const never: AnswerClient = {
      stream: () => {
        calls++
        throw new Error('should not be called')
      },
    }
    let stored: StoredAnswer | undefined
    expect(await collect(streamAnswer('?', [], 'en', { client: never, onDone: (a) => (stored = a) }))).toEqual([
      { type: 'sources', sources: [] },
      { type: 'done' },
    ])
    expect(calls).toBe(0)
    expect(stored).toEqual({ sources: [], parts: [] })

    stored = undefined
    const refused = await collect(
      streamAnswer('?', [chunk('a')], 'en', { client: fakeClient([], 'refusal'), onDone: (a) => (stored = a) }),
    )
    expect(refused.at(-1)).toMatchObject({ type: 'error', code: 'refused' })
    expect(stored).toBeUndefined()

    const broken: AnswerClient = {
      stream: () => ({
        // biome-ignore lint/correctness/useYield: fails before the first event
        async *[Symbol.asyncIterator]() {
          throw new Error('network')
        },
        finalMessage: async () => ({}) as Anthropic.Beta.BetaMessage,
      }),
    }
    const originalError = console.error
    console.error = () => {}
    const failed = await collect(streamAnswer('?', [chunk('a')], 'en', { client: broken, onDone: (a) => (stored = a) }))
    console.error = originalError
    expect(failed.at(-1)).toMatchObject({ type: 'error', code: 'failed' })
    expect(stored).toBeUndefined()
  })

  test('kept answers replay as the same events as a new one (nothing marks them as kept); parts are merged and repeated citations dropped', async () => {
    expect(compactParts([{ text: 'a' }, { text: 'b' }, { cite: 1 }, { cite: 1 }, { cite: 2 }])).toEqual([
      { text: 'ab' },
      { cite: 1 },
      { cite: 2 },
    ])
    const answer: StoredAnswer = { sources: [], parts: [{ text: 'Hi.' }, { cite: 1 }] }
    expect([...replay(answer)]).toEqual([
      { type: 'sources', sources: [] },
      { type: 'text', text: 'Hi.' },
      { type: 'cite', n: 1 },
      { type: 'done' },
    ])
    const body = await new Response(ndjson(replay(answer))).text()
    expect(body.split('\n').filter(Boolean).map((line) => JSON.parse(line).type)).toEqual(['sources', 'text', 'cite', 'done'])
  })

  test('a kept answer replays at the pace of a written one: pauses to search and read, then a few words at a time', async () => {
    const answer: StoredAnswer = {
      sources: [{ n: 1, slug: 'a', title: 'A', href: '/notes/a', heading: null }],
      parts: [{ text: 'One two three four five six seven eight.' }, { cite: 1 }],
    }
    const waits: number[] = []
    const events = await collect(pacedReplay(answer, { wait: async (ms) => waits.push(ms), random: () => 0.5 }))
    expect(events[0]?.type).toBe('sources')
    expect(events.at(-1)).toEqual({ type: 'done' })
    const texts = events.filter((event) => event.type === 'text')
    expect(texts.length).toBeGreaterThan(2)
    expect(texts.map((event) => (event as { text: string }).text).join('')).toBe('One two three four five six seven eight.')
    expect(events.filter((event) => event.type === 'cite')).toEqual([{ type: 'cite', n: 1 }])
    // ~0.6 s before the sources, ~1.35 s before the text, then short uneven gaps.
    expect(waits[0]).toBeGreaterThan(300)
    expect(waits[1]).toBeGreaterThan(800)
    expect(Math.max(...waits.slice(2))).toBeLessThan(100)
    // A long answer still takes about 6 s of text at most.
    const long: StoredAnswer = { sources: [], parts: [{ text: 'word '.repeat(2000) }] }
    let total = 0
    await collect(pacedReplay(long, { wait: async (ms) => (total += ms), random: () => 0.5 }))
    expect(total).toBeLessThan(9_000)
  })

  test('text is cut into small pieces like the API streams it, CJK a few characters at a time', () => {
    expect(streamPieces('Hello there, reader.', () => 0).join('')).toBe('Hello there, reader.')
    const ja = streamPieces('記事の内容に基づいて答えます。', () => 0)
    expect(ja.join('')).toBe('記事の内容に基づいて答えます。')
    expect(Math.max(...ja.map((piece) => piece.length))).toBeLessThanOrEqual(3)
  })

  test('a kept answer is checked and its links are built again from the slugs for the page language', () => {
    const stored = {
      sources: [{ n: 1, slug: 'deploy', title: 'Deploy', href: 'https://evil.example', heading: 'Steps' }],
      parts: [{ text: 'Hi.' }, { cite: 1 }],
    }
    expect(restoreAnswer(stored, 'ja')?.sources[0]?.href).toBe('/ja/notes/deploy')
    expect(restoreAnswer({ ...stored, sources: [{ ...stored.sources[0], slug: '../x' }] }, 'en')).toBeNull()
    expect(restoreAnswer({ ...stored, parts: [{ cite: 9 }] }, 'en')).toBeNull()
    expect(restoreAnswer(null, 'en')).toBeNull()
    expect(restoreAnswer('nope', 'en')).toBeNull()
  })

  test('the key of what an answer depends on changes with the excerpts, their order, the post and the model only', () => {
    const a = chunk('a')
    const b = chunk('b')
    expect(sourceKey([a, b], 'm')).toBe(sourceKey([{ ...a, score: 0.9 }, b], 'm'))
    expect(sourceKey([a, b], 'm')).toMatch(/^[0-9a-f]{64}$/)
    expect(sourceKey([a, b], 'm')).not.toBe(sourceKey([b, a], 'm'))
    expect(sourceKey([a], 'm')).not.toBe(sourceKey([{ ...a, hash: 'edited' }], 'm'))
    expect(sourceKey([a], 'm')).not.toBe(sourceKey([{ ...a, slug: 'renamed' }], 'm'))
    expect(sourceKey([a], 'm')).not.toBe(sourceKey([a], 'other'))
  })
})
