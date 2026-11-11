import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync } from 'node:zlib'

import { expect, test } from '@playwright/test'

// Checks on the production build (bun run build:web), skipped without one.
const ASSETS = join(import.meta.dirname, '..', '.vercel', 'output', 'static', '_astro')
const built = existsSync(ASSETS)
const files = built ? readdirSync(ASSETS) : []

test.describe('TC-E-23 production build', () => {
  test.skip(!built, 'no production build (run bun run build:web)')

  test('one stylesheet, under 30 KB with brotli, no inlined fonts', () => {
    const css = files.filter((file) => file.endsWith('.css'))
    expect(css).toHaveLength(1)
    const body = readFileSync(join(ASSETS, css[0] as string))
    expect(body.toString()).not.toContain('data:font')
    expect(brotliCompressSync(body).length).toBeLessThan(30 * 1024)
  })

  test('no Cyrillic font subsets', () => {
    expect(files.filter((file) => /cyrillic|vietnamese|symbols/.test(file))).toEqual([])
  })
})
