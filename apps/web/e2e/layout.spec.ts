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
    for (const path of [
      '/notes',
      '/builds',
      '/search',
      '/ja/search?q=a',
      '/zh/notes',
      '/nope-404',
    ]) {
      for (const view of VIEWS) {
        await open(page, path, { view })
        expect(await overflowX(page), `${path} ${view}`).toBeLessThanOrEqual(0)
      }
    }
  })
})

test('TC-E-11 Japanese and Chinese pages take "…" from a CJK font, English does not', async ({
  page,
}) => {
  const mono = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font-mono'))
  for (const path of ['/ja', '/zh']) {
    await open(page, path)
    expect(await mono(), path).toMatch(/^\s*'?"?CJK Ellipsis/)
  }
  await open(page, '/')
  expect(await mono()).not.toContain('CJK Ellipsis')
  // Utilities read the variable (the theme is not inlined).
  const utility = await page.evaluate(
    () => getComputedStyle(document.querySelector('.font-mono') as Element).fontFamily,
  )
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
    const size = await page
      .locator('[data-search-input]')
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(Number.parseFloat(size)).toBeGreaterThanOrEqual(16)
  })
})

test('TC-E-46 CLI header: the language menu is a [xx] switch like [ade] and [dark]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const header = page.locator('header.cli-header')
  const style = (selector: string) =>
    header
      .locator(selector)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el)
        return `${s.fontFamily} ${s.fontSize} ${s.fontWeight} ${s.color}`
      })
  for (const [path, label] of [
    ['/', '[en]'],
    ['/ja', '[jp]'],
    ['/zh', '[zh]'],
  ] as const) {
    await open(page, path, { view: 'cli' })
    const summary = header.locator('[data-language-menu] summary')
    await expect(summary, path).toHaveText(label)
    await expect(header.locator('[data-view-set]')).toHaveText('[ade]')
    expect(await style('[data-language-menu] summary'), path).toBe(await style('[data-view-set]'))
    expect(await style('[data-language-menu] summary'), path).toBe(
      await style('[data-theme-toggle]'),
    )
    expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    // The menu items stay plain codes.
    await summary.click()
    await expect(header.locator('[data-language-menu] a')).toHaveText(['en', 'jp', 'zh'])
  }
})

test.describe('TC-E-61 CLI header on phones: the switches get a row of their own', () => {
  for (const [width, path] of [
    [320, '/'],
    [375, '/ja/notes'],
    [390, '/zh'],
  ] as const) {
    test(`${width}px ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await open(page, path, { view: 'cli', theme: width === 375 ? 'dark' : 'light' })
      const header = page.locator('header.cli-header')
      const top = async (selector: string) =>
        Promise.all(
          (await header.locator(selector).all()).map(async (el) =>
            Math.round((await el.boundingBox())?.y ?? -1),
          ),
        )
      const switches = await top(
        '[data-view-set], [data-language-menu] summary, [data-theme-toggle]',
      )
      const sections = await top('[data-section-nav] a')
      expect(switches, path).toHaveLength(3)
      // [ade] [xx] [dark] stay together on one row ...
      expect(new Set(switches).size, path).toBe(1)
      // ... below every section link, none of which shares that row.
      expect(sections.length, path).toBeGreaterThan(0)
      for (const y of sections) expect(y, path).toBeLessThan(switches[0] ?? 0)
      expect(await overflowX(page), path).toBeLessThanOrEqual(0)
    })
  }

  test('1280px: sections and switches share one row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await open(page, '/', { view: 'cli' })
    const header = page.locator('header.cli-header')
    expect((await header.boundingBox())?.height ?? 0).toBeLessThan(80)
  })
})

test.describe('TC-E-47 ADE below 1024px: light | dark tabs in the top bar', () => {
  for (const [width, path] of [
    [320, '/ja'],
    [375, '/'],
    [390, '/zh'],
    [1023, '/'],
  ] as const) {
    test(`${width}px ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await open(page, path, { view: 'modern', theme: 'light' })
      const tabs = page.locator('.modern-topbar .topbar-theme')
      const light = tabs.locator('[data-theme-set="light"]')
      const dark = tabs.locator('[data-theme-set="dark"]')
      await expect(tabs).toBeVisible()
      // One row: the tabs do not push the other controls onto a second line.
      expect((await page.locator('.modern-topbar').boundingBox())?.height ?? 0).toBeLessThan(70)
      expect(await overflowX(page)).toBeLessThanOrEqual(0)
      const bg = (tab: typeof light) => tab.evaluate((el) => getComputedStyle(el).backgroundColor)
      const selected = await bg(light)
      expect(await bg(dark)).not.toBe(selected)
      await dark.click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      expect(await page.evaluate(() => localStorage.getItem('payload-theme'))).toBe('dark')
      // Clicking the selected tab keeps the theme.
      await dark.click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await light.click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    })
  }

  test('1024px and up: the sidebar has the switch, the top bar does not', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await open(page, '/', { view: 'modern' })
    await expect(page.locator('.modern-topbar .topbar-theme')).toBeHidden()
    await expect(page.locator('.modern-sidebar [data-theme-toggle]')).toBeVisible()
  })
})

test.describe('TC-E-48 switches in one order in both views: view, language, theme', () => {
  test('CLI header and ADE top bar', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    const order = (selectors: string[]) =>
      page.evaluate(
        (list) => list.map((s) => document.querySelector(s)?.getBoundingClientRect().left ?? -1),
        selectors,
      )
    await open(page, '/', { view: 'cli' })
    const cli = await order([
      '.cli-header [data-view-set]',
      '.cli-header [data-language-menu]',
      '.cli-header [data-theme-toggle]',
    ])
    expect(cli).toEqual([...cli].sort((a, b) => a - b))
    await open(page, '/', { view: 'modern' })
    const ade = await order([
      '.modern-topbar .view-tab-cli',
      '.modern-topbar [hreflang="en"]',
      '.modern-topbar .topbar-theme',
    ])
    expect(ade).toEqual([...ade].sort((a, b) => a - b))
    // The status panel's config rows follow the same order.
    const rows = await page
      .locator('[data-config]')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.config))
    expect(rows.slice(0, 3)).toEqual(['view', 'language', 'theme'])
  })

  for (const width of [320, 340, 390, 768]) {
    test(`CLI language menu stays on screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      for (const path of ['/', '/ja', '/zh']) {
        await open(page, path, { view: 'cli' })
        await page.locator('.cli-header [data-language-menu] summary').click()
        const box = await page.locator('.cli-header [data-language-menu] ul').boundingBox()
        expect(box?.x ?? -1, path).toBeGreaterThanOrEqual(0)
        expect((box?.x ?? 0) + (box?.width ?? 0), path).toBeLessThanOrEqual(width)
        expect(await overflowX(page), path).toBeLessThanOrEqual(0)
      }
    })
  }
})

test('TC-E-58 h/l go to the previous / next header section, in both views and languages', async ({
  page,
}) => {
  for (const [view, start] of [
    ['cli', '/'],
    ['modern', '/ja/notes'],
  ] as const) {
    await open(page, start, { view })
    const hrefs = await page
      .locator('[data-section-nav] a[href^="/"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname))
    test.skip(hrefs.length < 2, 'Fewer than two header links')
    let at = hrefs.findIndex((href) => href === new URL(page.url()).pathname)
    if (at === -1) {
      // A start page outside the nav (no home link in the header): l goes to the first section.
      await Promise.all([
        page.waitForURL((url) => url.pathname === hrefs[0]),
        page.keyboard.press('l'),
      ])
      at = 0
    }
    const next = hrefs[at + 1]
    if (!next) continue
    await Promise.all([page.waitForURL((url) => url.pathname === next), page.keyboard.press('l')])
    await Promise.all([
      page.waitForURL((url) => url.pathname === hrefs[at]),
      page.keyboard.press('h'),
    ])
  }
})

test('TC-E-60 g then h goes to the home page of the current language, in both views', async ({
  page,
}) => {
  for (const [view, start, home] of [
    ['cli', '/builds', '/'],
    ['modern', '/ja/stacks', '/ja'],
  ] as const) {
    await open(page, start, { view })
    await page.keyboard.press('g')
    await Promise.all([
      page.waitForURL((url) => url.pathname.replace(/\/$/, '') === home.replace(/\/$/, '')),
      page.keyboard.press('h'),
    ])
  }
})
