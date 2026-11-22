import { describe, expect, test } from 'bun:test'

import { rerenderInLanes, rerenderLanes } from './rerender'

describe('TC-U-66 Invalidation re-renders', () => {
  const paths = [
    '/',
    '/builds',
    '/builds/athena',
    '/ja',
    '/ja/builds',
    '/zh',
    '/zh/builds',
    '/pages-sitemap.xml',
  ]

  test('one lane per language, in the order given; root-only paths go with English', () => {
    expect(rerenderLanes(paths)).toEqual([
      ['/', '/builds', '/builds/athena', '/pages-sitemap.xml'],
      ['/ja', '/ja/builds'],
      ['/zh', '/zh/builds'],
    ])
    expect(rerenderLanes([])).toEqual([])
  })

  test('a lane renders one path at a time while the languages run side by side', async () => {
    let running = 0
    let most = 0
    const perLane = new Map<string, number>()
    const order: string[] = []
    const failed = await rerenderInLanes(paths, async (path) => {
      const lang = path.match(/^\/(ja|zh)(\/|$)/)?.[1] ?? 'en'
      perLane.set(lang, (perLane.get(lang) ?? 0) + 1)
      expect(perLane.get(lang)).toBe(1)
      running++
      most = Math.max(most, running)
      order.push(path)
      await new Promise((resolve) => setTimeout(resolve, 2))
      running--
      perLane.set(lang, (perLane.get(lang) ?? 1) - 1)
      return true
    })
    expect(failed).toEqual([])
    expect(most).toBe(3)
    expect(order.filter((p) => !p.startsWith('/ja') && !p.startsWith('/zh'))).toEqual([
      '/',
      '/builds',
      '/builds/athena',
      '/pages-sitemap.xml',
    ])
  })

  test('a failed or throwing render is reported and the lane goes on', async () => {
    const seen: string[] = []
    const failed = await rerenderInLanes(['/', '/builds', '/notes'], async (path) => {
      seen.push(path)
      if (path === '/') throw new Error('timeout')
      return path !== '/builds'
    })
    expect(seen).toEqual(['/', '/builds', '/notes'])
    expect(failed).toEqual(['/', '/builds'])
  })

  test('paths not started within the budget are reported as failed without a request', async () => {
    let clock = 0
    const seen: string[] = []
    const failed = await rerenderInLanes(
      ['/', '/builds', '/notes'],
      async (path) => {
        seen.push(path)
        clock += 15_000
        return true
      },
      20_000,
      () => clock,
    )
    expect(seen).toEqual(['/', '/builds'])
    expect(failed).toEqual(['/notes'])
  })
})
