import { describe, expect, test } from 'bun:test'

import { buildActivity } from './activity'

const href = (path: string) => `/ja${path}`
const work = (over: Partial<Parameters<typeof buildActivity>[1][number]> = {}) => ({
  slug: 'athena',
  title: 'athena',
  pushedAt: '2026-11-10T10:00:00Z',
  release: null,
  ...over,
})

describe('buildActivity (banner "Recent activity")', () => {
  test('TC-U-01 mixes posts and projects, newest first, three at most', () => {
    const items = buildActivity(
      [
        { slug: 'a', title: 'A', publishedAt: '2026-11-01T00:00:00Z' },
        { slug: 'b', title: 'B', publishedAt: '2026-11-09T00:00:00Z' },
      ],
      [work({ slug: 'x', title: 'x', pushedAt: '2026-11-10T00:00:00Z' }), work({ slug: 'y', title: 'y', pushedAt: '2026-10-01T00:00:00Z' })],
      href,
    )
    expect(items.map((item) => item.label)).toEqual(['x', 'B', 'A'])
    expect(items[0]).toEqual({ date: '2026-11-10T00:00:00Z', kind: 'push', label: 'x', href: '/ja/builds/x' })
    expect(items[1]?.href).toBe('/ja/notes/b')
  })

  test('TC-U-02 a release at (or within an hour before) the last push wins', () => {
    const [item] = buildActivity(
      [],
      [work({ pushedAt: '2026-11-10T10:30:00Z', release: { tag: 'v1.0.0', date: '2026-11-10T10:00:00Z', url: '' } })],
      href,
    )
    expect(item).toMatchObject({ kind: 'release', label: 'athena v1.0.0', date: '2026-11-10T10:00:00Z' })
  })

  test('TC-U-03 an old release loses to a newer push', () => {
    const [item] = buildActivity(
      [],
      [work({ pushedAt: '2026-11-10T10:00:00Z', release: { tag: 'v0.1', date: '2026-01-01T00:00:00Z', url: '' } })],
      href,
    )
    expect(item?.kind).toBe('push')
  })

  test('TC-U-04 skips entries without a usable date or slug', () => {
    const items = buildActivity(
      [{ slug: null, title: 'no slug', publishedAt: '2026-11-01T00:00:00Z' }, { slug: 'c', title: 'C', publishedAt: null }],
      [work({ pushedAt: '' })],
      href,
    )
    expect(items).toEqual([])
  })

  test('TC-U-05 falls back to the slug when a post has no title', () => {
    const [item] = buildActivity([{ slug: 'untitled', title: '', publishedAt: '2026-11-01T00:00:00Z' }], [], href)
    expect(item?.label).toBe('untitled')
  })
})
