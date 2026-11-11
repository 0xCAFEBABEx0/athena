import { expect, test } from '@playwright/test'

import { open, overflowX } from './helpers'

const WIDTHS = [320, 390, 768, 1280]
const VIEWS = ['cli', 'modern'] as const

test.describe('TC-E-09 no horizontal scroll', () => {
  for (const width of WIDTHS) {
    for (const view of VIEWS) {
      test(`home in every language at ${width}px, ${view}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        for (const path of ['/', '/ja', '/zh']) {
          await open(page, path, { view, theme: width === 390 ? 'dark' : 'light' })
          expect(await overflowX(page), path).toBeLessThanOrEqual(0)
        }
      })
    }
  }

  test('other pages at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    for (const path of ['/posts', '/work', '/search', '/ja/search?q=a', '/zh/posts', '/nope-404']) {
      for (const view of VIEWS) {
        await open(page, path, { view })
        expect(await overflowX(page), `${path} ${view}`).toBeLessThanOrEqual(0)
      }
    }
  })
})

test('TC-E-11 Japanese and Chinese pages take "…" from a CJK font, English does not', async ({ page }) => {
  const mono = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-mono'))
  for (const path of ['/ja', '/zh']) {
    await open(page, path)
    expect(await mono(), path).toMatch(/^\s*'?"?CJK Ellipsis/)
  }
  await open(page, '/')
  expect(await mono()).not.toContain('CJK Ellipsis')
  // Utilities read the variable (the theme is not inlined).
  const utility = await page.evaluate(() => getComputedStyle(document.querySelector('.font-mono') as Element).fontFamily)
  expect(utility).toContain('Geist Mono')
})

test.describe('TC-E-29 tap targets on phones', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true })

  test('ADE top bar controls are at least 36px tall', async ({ page }) => {
    await open(page, '/', { view: 'modern' })
    const search = await page.locator('.topbar-search').boundingBox()
    expect(search?.height ?? 0).toBeGreaterThanOrEqual(40)
    expect(search?.width ?? 0).toBeGreaterThanOrEqual(40)
    for (const tab of await page.locator('.modern-topbar .tab').all()) {
      expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(36)
    }
  })

  test('search inputs are 16px so iOS does not zoom', async ({ page }) => {
    await open(page, '/', { view: 'cli' })
    const size = await page.locator('[data-search-input]').evaluate((el) => getComputedStyle(el).fontSize)
    expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(16)
  })
})
