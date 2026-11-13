import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  AiSearchError,
  type ChunkHit,
  clientAddress,
  isCrossSite,
  normalizeQuery,
  parseAiRequest,
  queryKey,
  rankPosts,
  relevantChunks,
  searchChunks,
  searchFailure,
  snippetOf,
} from './ai'
import { allowToday, allowVisitor, dailyLimit, resetVisitorLimits } from './ai-limits'
import { bumpCounter, peekCms, storeCms, type CmsCacheStore } from './cms-cache'

/** Set environment variables for one test and put the old values back after it. */
const envKeys = ['REVALIDATE_SECRET', 'CMS_URL', 'CMS_PROTECTION_BYPASS', 'AI_DAILY_LIMIT'] as const
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const restoreEnv = () => {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
}

const hit = (slug: string, score: number, content = `About ${slug}.`, heading: string | null = null): ChunkHit => ({
  postId: slug,
  slug,
  title: slug.toUpperCase(),
  heading,
  content,
  score,
})

describe('TC-U-57 AI search (web): queries and ranking', () => {
  test('queries are trimmed to one line of 1–300 characters; unknown languages are English', () => {
    expect(normalizeQuery('  how   do\nyou deploy? ')).toBe('how do you deploy?')
    expect(normalizeQuery('')).toBeNull()
    expect(normalizeQuery('   ')).toBeNull()
    expect(normalizeQuery('a'.repeat(301))).toBeNull()
    expect(normalizeQuery(42)).toBeNull()
    expect(parseAiRequest({ q: ' hi ', locale: 'zh' })).toEqual({ q: 'hi', locale: 'zh' })
    expect(parseAiRequest({ q: 'hi', locale: 'fr' })).toEqual({ q: 'hi', locale: 'en' })
    expect(parseAiRequest({ locale: 'ja' })).toBeNull()
    expect(parseAiRequest(null)).toBeNull()
  })

  test('the cache key ignores case but not the language', () => {
    expect(queryKey('en', 'Deploy')).toBe(queryKey('en', 'deploy'))
    expect(queryKey('en', 'deploy')).not.toBe(queryKey('ja', 'deploy'))
    expect(queryKey('en', 'deploy')).toMatch(/^en:[0-9a-f]{32}$/)
  })

  test('one result per post (its best excerpt), best first, only posts near the best one', () => {
    const posts = rankPosts(
      [
        hit('a', 0.5, 'weaker excerpt of a'),
        hit('b', 0.62, 'best of b', 'Setup'),
        hit('a', 0.6, 'best of a'),
        hit('c', 0.4), // more than 0.15 below the best
      ],
      'ja',
    )
    expect(posts.map((post) => [post.slug, post.snippet, post.score])).toEqual([
      ['b', 'best of b', 0.62],
      ['a', 'best of a', 0.6],
    ])
    expect(posts[0]).toMatchObject({ href: '/ja/notes/b', title: 'B', heading: 'Setup' })
    // Nothing similar enough at all: no results.
    expect(rankPosts([hit('a', 0.18)], 'en')).toEqual([])
    expect(rankPosts([], 'en')).toEqual([])
  })

  test('snippets drop code blocks and are cut at 140 characters', () => {
    expect(snippetOf('Run\n\n```sh\nbun run build\n```\n\nthen   wait.')).toBe('Run then wait.')
    const long = snippetOf('word '.repeat(60))
    expect(long.length).toBeLessThanOrEqual(140)
    expect(long.endsWith('…')).toBe(true)
  })

  test('Claude gets only the excerpts that are near the question', () => {
    const chunks = [hit('a', 0.55), hit('b', 0.4), hit('c', 0.25), hit('d', 0.1)]
    expect(relevantChunks(chunks).map((chunk) => chunk.slug)).toEqual(['a', 'b'])
    expect(relevantChunks([hit('a', 0.12)])).toEqual([])
  })

  test('requests from another site are refused; the visitor is read from Vercel headers', () => {
    const request = (headers: Record<string, string>) => new Request('https://whoa.me/api/ai/ask', { method: 'POST', headers })
    expect(isCrossSite(request({ origin: 'https://whoa.me' }))).toBe(false)
    expect(isCrossSite(request({ origin: 'https://evil.example' }))).toBe(true)
    expect(isCrossSite(request({ origin: 'null' }))).toBe(true)
    expect(isCrossSite(request({ 'sec-fetch-site': 'cross-site' }))).toBe(true)
    expect(isCrossSite(request({}))).toBe(false)
    expect(clientAddress(request({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientAddress(request({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1' }))).toBe('2.2.2.2')
    expect(clientAddress(request({}))).toBe('unknown')
  })
})

describe('TC-U-58 AI search (web): asking the CMS', () => {
  beforeEach(() => {
    process.env.REVALIDATE_SECRET = 's3cret'
    process.env.CMS_URL = 'https://cms.example/'
    process.env.CMS_PROTECTION_BYPASS = 'bypass'
  })
  afterEach(restoreEnv)

  type Call = { url: string; init: RequestInit }
  const fakeFetch = (calls: Call[], respond: () => Response) =>
    (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return respond()
    }) as unknown as typeof fetch

  test('posts the query with the shared secret and the bypass, without following redirects', async () => {
    const calls: Call[] = []
    const results = await searchChunks(
      { q: 'deploy', locale: 'ja' },
      8,
      { fetchImpl: fakeFetch(calls, () => Response.json({ results: [hit('a', 0.5)] })) },
    )
    expect(results.map((r) => r.slug)).toEqual(['a'])
    expect(calls[0]?.url).toBe('https://cms.example/api/ai/search')
    const headers = new Headers(calls[0]?.init.headers)
    expect(headers.get('authorization')).toBe('Bearer s3cret')
    expect(headers.get('x-vercel-protection-bypass')).toBe('bypass')
    expect(calls[0]?.init.redirect).toBe('manual')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ q: 'deploy', locale: 'ja', limit: 8 })
  })

  test('a CMS without AI search set up is a 503; other failures are 502; nothing is sent without the secret', async () => {
    const run = (respond: () => Response) =>
      searchChunks({ q: 'x', locale: 'en' }, 8, { fetchImpl: fakeFetch([], respond) }).catch((error: unknown) => error)

    const unavailable = await run(() => Response.json({ error: 'not configured' }, { status: 503 }))
    expect(unavailable).toBeInstanceOf(AiSearchError)
    expect((unavailable as AiSearchError).status).toBe(503)

    const login = await run(() => new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso' } }))
    expect((login as AiSearchError).status).toBe(502)

    const down = (await searchChunks({ q: 'x', locale: 'en' }, 8, {
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED')
      }) as unknown as typeof fetch,
    }).catch((error: unknown) => error)) as AiSearchError
    expect(down.status).toBe(502)

    delete process.env.REVALIDATE_SECRET
    const calls: Call[] = []
    const noSecret = (await searchChunks({ q: 'x', locale: 'en' }, 8, {
      fetchImpl: fakeFetch(calls, () => Response.json({})),
    }).catch((error: unknown) => error)) as AiSearchError
    expect(noSecret.status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  test('an index still being built is an error with its own code, so the empty answer is not cached', async () => {
    const building = (await searchChunks({ q: 'x', locale: 'en' }, 8, {
      fetchImpl: fakeFetch([], () => Response.json({ results: [], building: true })),
    }).catch((error: unknown) => error)) as AiSearchError
    expect(searchFailure(building)).toEqual({ status: 503, code: 'building' })
    expect(searchFailure(new AiSearchError('limit', 429, 'busy'))).toEqual({ status: 429, code: 'busy' })
    expect(searchFailure(new AiSearchError('x', 401))).toEqual({ status: 502, code: 'search' })
    expect(searchFailure(new Error('x'))).toEqual({ status: 502, code: 'search' })
  })

  test('the spending check runs before the CMS is asked and can stop it', async () => {
    const calls: Call[] = []
    const refused = await searchChunks({ q: 'x', locale: 'en' }, 8, {
      beforeLoad: async () => {
        throw new AiSearchError('limit', 429)
      },
      fetchImpl: fakeFetch(calls, () => Response.json({ results: [] })),
    }).catch((error: unknown) => error)
    expect((refused as AiSearchError).status).toBe(429)
    expect(calls).toHaveLength(0)
  })
})

describe('TC-U-59 AI search (web): limits and stored answers', () => {
  afterEach(() => {
    restoreEnv()
    resetVisitorLimits()
  })

  test('10 questions per visitor in 10 minutes, counted per visitor', () => {
    const t = 1_000_000
    for (let i = 0; i < 10; i++) expect(allowVisitor('a', t + i)).toBe(true)
    expect(allowVisitor('a', t + 10)).toBe(false)
    expect(allowVisitor('b', t + 10)).toBe(true)
    expect(allowVisitor('a', t + 10 * 60 * 1000 + 1)).toBe(true)
  })

  test('the daily cap defaults to 200; AI_DAILY_LIMIT sets it (0 turns uncached questions off)', async () => {
    delete process.env.AI_DAILY_LIMIT
    expect(dailyLimit()).toBe(200)
    process.env.AI_DAILY_LIMIT = ''
    expect(dailyLimit()).toBe(200)
    process.env.AI_DAILY_LIMIT = 'lots'
    expect(dailyLimit()).toBe(200)
    process.env.AI_DAILY_LIMIT = '2'
    const day = new Date('2030-01-01T12:00:00Z')
    expect(await allowToday(day)).toBe(true)
    expect(await allowToday(day)).toBe(true)
    expect(await allowToday(day)).toBe(false)
    expect(await allowToday(new Date('2030-01-02T00:00:00Z'))).toBe(true)
    process.env.AI_DAILY_LIMIT = '0'
    expect(await allowToday(new Date('2030-01-03T00:00:00Z'))).toBe(false)
  })

  const memoryStore = () => {
    const data = new Map<string, unknown>()
    const store: CmsCacheStore = {
      get: async (key) => data.get(key) ?? null,
      set: async (key, value) => {
        data.set(key, value)
      },
      expireTag: async () => {
        data.clear()
      },
    }
    return store
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  test('a stored answer is read back until the next CMS change; counters add up', async () => {
    const store = memoryStore()
    expect(await peekCms('ai:answer:k', store)).toBeNull()
    storeCms('ai:answer:k', { parts: [] }, Date.now(), store)
    await settle()
    expect(await peekCms('ai:answer:k', store)).toEqual({ parts: [] })
    // A publish marks everything read before it as stale.
    await store.set('cms-data:expired-at', Date.now() + 1, {})
    await store.expireTag('cms-data')
    expect(await peekCms('ai:answer:k', store)).toBeNull()

    expect(await bumpCounter('c', 60, 1, store)).toBe(1)
    expect(await bumpCounter('c', 60, 2, store)).toBe(3)
    expect(await peekCms('k', null)).toBeNull()
  })
})
