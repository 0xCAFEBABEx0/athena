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
  replay,
  streamAnswer,
  systemPrompt,
} from './ai-answer'

const chunk = (slug: string, heading: string | null = null, content = `About ${slug}.`): ChunkHit => ({
  postId: slug,
  slug,
  title: slug.toUpperCase(),
  heading,
  content,
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

describe('TC-U-59 AI answers', () => {
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
    expect(seen[0]).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 4096, output_config: { effort: 'low' } })
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
      { type: 'done', cached: false },
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

  test('stored answers replay as the same events, marked cached; parts are merged and repeated citations dropped', async () => {
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
      { type: 'done', cached: true },
    ])
    const body = await new Response(ndjson(replay(answer))).text()
    expect(body.split('\n').filter(Boolean).map((line) => JSON.parse(line).type)).toEqual(['sources', 'text', 'cite', 'done'])
  })
})
