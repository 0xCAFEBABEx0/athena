/**
 * GitHub contribution graph on the home page, drawn from the calendar the CMS
 * stored (Site global → GitHub). Needs a GitHub username in the CMS; without
 * one, the section must be absent.
 */
import { expect, test } from '@playwright/test'

import { open, overflowX } from './helpers'

const visibleWeeks = (page: import('@playwright/test').Page) =>
  page
    .locator('.contrib-week')
    .evaluateAll(
      (weeks) => weeks.filter((week) => getComputedStyle(week).display !== 'none').length,
    )

test.describe('GitHub contributions', () => {
  test('TC-E-54 a year of days, shaded 0–4, with the total, and nothing loaded from GitHub', async ({
    page,
  }) => {
    const fromGitHub: string[] = []
    page.on('request', (request) => {
      if (/(^|\.)github(usercontent)?\.com$/.test(new URL(request.url()).hostname))
        fromGitHub.push(request.url())
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await open(page, '/', { view: 'cli' })
    const section = page.locator('[data-contributions]')
    if ((await section.count()) === 0) test.skip(true, 'No GitHub username in the CMS')

    const days = section.locator('.contrib-day:not(.contrib-pad)')
    expect(await days.count()).toBeGreaterThanOrEqual(365)
    expect(await days.count()).toBeLessThanOrEqual(371)
    for (const level of await days.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-level')),
    )) {
      expect(['0', '1', '2', '3', '4']).toContain(level)
    }
    await expect(days.last()).toHaveAttribute('title', /\d{4}-\d{2}-\d{2}/)
    // Every week is a column of at most 7 days; all 53 show on a wide screen.
    for (const n of await section
      .locator('.contrib-week')
      .evaluateAll((weeks) => weeks.map((w) => w.children.length))) {
      expect(n).toBeLessThanOrEqual(7)
    }
    expect(await visibleWeeks(page)).toBeGreaterThanOrEqual(52)
    await expect(section.locator('[data-contrib-total]')).toHaveText(/^[\d,]+ contributions$/)
    // The whole block is one link to the profile, named by the graph's label.
    const link = section.locator('a[href^="https://github.com/"]')
    await expect(link).toHaveCount(1)
    await expect(link).toHaveAttribute('aria-label', /contributions in the last year/)
    await expect(link.locator('.contrib-grid')).toHaveCount(1)
    await expect(link.locator('[data-contrib-total]')).toHaveCount(1)

    await open(page, '/ja', { view: 'modern' })
    await expect(page.locator('[data-contrib-total]')).toHaveText(
      /^[\d,]+ 件のコントリビューション$/,
    )
    expect(fromGitHub).toEqual([])
  })

  for (const [width, weeks, settings] of [
    [320, 17, { view: 'modern', theme: 'light' }],
    [390, 26, { view: 'cli', theme: 'dark' }],
    [768, 53, { view: 'modern', theme: 'dark' }],
  ] as const) {
    test(`TC-E-54 ${width}px shows the last ${weeks} weeks with no horizontal scroll (${settings.view}, ${settings.theme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await open(page, '/zh', settings)
      test.skip(
        (await page.locator('[data-contributions]').count()) === 0,
        'No GitHub username in the CMS',
      )
      expect(await overflowX(page)).toBeLessThanOrEqual(0)
      const total = await page.locator('.contrib-week').count()
      expect(await visibleWeeks(page)).toBe(Math.min(weeks, total))
      // The newest week is always shown, and the squares stay visible.
      await expect(page.locator('.contrib-week').last()).toBeVisible()
      const size = await page
        .locator('.contrib-week:last-child .contrib-day')
        .first()
        .evaluate((el) => el.getBoundingClientRect().width)
      expect(size).toBeGreaterThanOrEqual(6)
    })
  }
})
