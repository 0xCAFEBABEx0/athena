import { describe, expect, test } from 'bun:test'

import { rerenderInLanes, rerenderLanes } from './rerender'

describe('TC-U-66 Invalidation re-renders', () => {
  // Made-up paths: these cases are about scheduling, not the site's sections.
  const paths = ['/', '/a', '/a/b', '/ja', '/ja/a', '/zh', '/zh/a', '/pages-sitemap.xml']

  test('one lane per language, in the order given; root-only paths go with English', () => {
    expect(rerenderLanes(paths)).toEqual([
      ['/', '/a', '/a/b', '/pages-sitemap.xml'],
      ['/ja', '/ja/a'],
      ['/zh', '/zh/a'],
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
      '/a',
      '/a/b',
      '/pages-sitemap.xml',
    ])
  })

  test('a failed or throwing render is reported and the lane goes on', async () => {
    const seen: string[] = []
    const failed = await rerenderInLanes(['/', '/a', '/c'], async (path) => {
      seen.push(path)
      if (path === '/') throw new Error('timeout')
      return path !== '/a'
    })
    expect(seen).toEqual(['/', '/a', '/c'])
    expect(failed).toEqual(['/', '/a'])
  })

  test('each render gets only the time left; paths not started within the budget fail without a request', async () => {
    let clock = 0
    const seen: [string, number][] = []
    const failed = await rerenderInLanes(
      ['/', '/a', '/c'],
      async (path, timeLeftMs) => {
        seen.push([path, timeLeftMs])
        clock += 15_000
        return true
      },
      20_000,
      () => clock,
    )
    expect(seen).toEqual([
      ['/', 20_000],
      ['/a', 5_000],
    ])
    expect(failed).toEqual(['/c'])
  })

  test('with no time left (the cache expiry used it up) nothing is requested', async () => {
    const seen: string[] = []
    const failed = await rerenderInLanes(
      ['/', '/a', '/ja'],
      async (path) => {
        seen.push(path)
        return true
      },
      -50,
    )
    expect(seen).toEqual([])
    expect(failed.sort()).toEqual(['/', '/a', '/ja'])
  })
})
