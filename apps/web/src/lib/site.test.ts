import { describe, expect, test } from 'bun:test'

import { contributionsOf, normalizeSite } from './site'

describe('normalizeSite', () => {
  test('TC-U-10 defaults when the CMS is empty or unreachable', () => {
    const site = normalizeSite(null)
    expect(site.siteName).toBe('whoa.me')
    expect(site.ogImage).toBeNull()
    expect(site.tagline).toBe('')
    expect(normalizeSite({ tagline: '  notes  ' }).tagline).toBe('notes')
    expect(site.banner).toEqual({ style: 'fetch', mascot: true, tips: [] })
  })

  test('TC-U-11 ogImage prefers the og rendition and makes it absolute', () => {
    process.env.CMS_URL = 'https://cms.example'
    const site = normalizeSite({
      ogImage: {
        id: 1,
        url: '/api/media/file/a.png',
        sizes: { og: { url: '/api/media/file/a-og.png' } },
      } as never,
    })
    expect(site.ogImage).toBe('https://cms.example/api/media/file/a-og.png')
    expect(
      normalizeSite({ ogImage: { id: 2, url: 'https://blob.example/b.png' } as never }).ogImage,
    ).toBe('https://blob.example/b.png')
    // An unpopulated id (depth 0) is not an image.
    expect(normalizeSite({ ogImage: 3 }).ogImage).toBeNull()
  })

  test('TC-U-12 banner settings: off, no owl, trimmed tips', () => {
    const site = normalizeSite({
      banner: { style: 'off', mascot: false, tips: [{ text: ' hi ' }, { text: '' }] },
    } as never)
    expect(site.banner).toEqual({ style: 'off', mascot: false, tips: ['hi'] })
  })

  test('TC-U-61 AI search settings: the answer model and trimmed suggested questions (6 at most)', () => {
    const site = normalizeSite({
      aiModel: 'claude-haiku-5-5',
      aiPresets: [
        { question: '  How   do you deploy? ' },
        { question: '   ' },
        ...Array.from({ length: 8 }, (_, i) => ({ question: `Q${i}` })),
      ],
    })
    expect(site.aiModel).toBe('claude-haiku-5-5')
    expect(site.aiPresets).toEqual(['How do you deploy?', 'Q0', 'Q1', 'Q2', 'Q3', 'Q4'])
    expect(normalizeSite({}).aiModel).toBeNull()
    expect(normalizeSite({}).aiPresets).toEqual([])
    expect(normalizeSite({ aiModel: 'gpt-x' as never }).aiModel).toBeNull()
  })

  test('TC-U-30 X picks: only x.com post links with text; trimmed fields and fallbacks', () => {
    const site = normalizeSite({
      picks: [
        {
          url: 'https://x.com/hoo_dev/status/12',
          text: '  hello\nworld ',
          authorName: ' Hoo ',
          authorHandle: '@hoo_dev',
          postedAt: '2026-11-02T15:00:00.000Z',
          lang: 'ja',
          note: ' why ',
        },
        { url: 'https://x.com/other/status/3', text: 'no author', lang: 'en"><script>' },
        { url: 'https://x.com/a/status/4', text: '   ' },
        { url: 'https://evil.example/a/status/5', text: 'not x' },
        { url: 'javascript:alert(1)', text: 'nope' },
      ],
    } as never)
    expect(site.picks).toEqual([
      {
        url: 'https://x.com/hoo_dev/status/12',
        text: 'hello\nworld',
        authorName: 'Hoo',
        authorHandle: 'hoo_dev',
        postedAt: '2026-11-03',
        lang: 'ja',
        note: 'why',
      },
      {
        url: 'https://x.com/other/status/3',
        text: 'no author',
        authorName: 'other',
        authorHandle: 'other',
        postedAt: null,
        lang: null,
        note: '',
      },
    ])
    expect(normalizeSite(null).picks).toEqual([])
  })
})

describe('contributionsOf', () => {
  const stored = (over: Record<string, unknown> = {}) => ({
    username: 'Octocat',
    contributions: {
      login: 'octocat',
      total: 12,
      // A Wednesday: the first week starts with 3 empty slots (Sun–Tue).
      start: '2025-11-12',
      counts: [1, 0, 3, 0, 0, 2, 4, 1, 1],
      levels: [1, 0, 2, 0, 0, 1, 4, 9, -1],
      ...over,
    },
  })

  test('TC-U-48 the stored calendar becomes Sunday-first weeks with dates', () => {
    const data = contributionsOf(stored())
    expect(data?.login).toBe('octocat')
    expect(data?.total).toBe(12)
    expect(data?.weeks.map((week) => week.length)).toEqual([7, 5])
    expect(data?.weeks[0]?.slice(0, 3)).toEqual([null, null, null])
    expect(data?.weeks[0]?.[3]).toEqual({ date: '2025-11-12', count: 1, level: 1 })
    expect(data?.weeks[1]?.[0]).toEqual({ date: '2025-11-16', count: 0, level: 0 })
    // Out-of-range shades fall back to none.
    expect(data?.weeks[1]?.slice(3).map((day) => day?.level)).toEqual([0, 0])
    expect(data?.weeks[1]?.[4]?.date).toBe('2025-11-20')
    expect(normalizeSite({ github: stored() }).contributions).toEqual(data)
  })

  test('TC-U-48 no graph without a username, for another user, or for malformed data', () => {
    expect(contributionsOf(undefined)).toBeNull()
    expect(contributionsOf({ username: '', contributions: stored().contributions })).toBeNull()
    expect(contributionsOf({ username: 'hubot', contributions: stored().contributions })).toBeNull()
    for (const bad of [
      { start: 'yesterday' },
      { counts: [1, 2], levels: [1] },
      { counts: [], levels: [] },
      { counts: 'many' },
      { login: '<script>' },
    ]) {
      expect(contributionsOf(stored(bad)), JSON.stringify(bad)).toBeNull()
    }
    expect(contributionsOf({ username: 'octocat', contributions: null })).toBeNull()
    expect(contributionsOf(stored({ total: -5 }))?.total).toBe(0)
    expect(normalizeSite(null).contributions).toBeNull()
  })
})
