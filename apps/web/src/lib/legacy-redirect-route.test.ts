/** TC-U-50: the Vercel route that keeps old section paths off the ISR function. */
import { describe, expect, test } from 'bun:test'
import { legacyRouteSource } from '../../scripts/route-legacy-redirects.mjs'

describe('legacy redirect route (TC-U-50)', () => {
  const route = new RegExp(legacyRouteSource())

  test('matches every old section path, in every language, with subpaths', () => {
    for (const path of [
      '/posts',
      '/posts/',
      '/posts/page/2',
      '/ja/posts/hello',
      '/work',
      '/zh/work/my.app',
      '/stack',
      '/ja/stack',
    ]) {
      expect(route.test(path)).toBe(true)
    }
  })

  test('leaves current routes and look-alike paths on ISR', () => {
    for (const path of [
      '/notes',
      '/stacks',
      '/ja/stacks',
      '/builds/athena',
      '/posts-sitemap.xml',
      '/postscript',
      '/en/posts',
      '/ja',
      '/',
    ]) {
      expect(route.test(path)).toBe(false)
    }
  })
})
