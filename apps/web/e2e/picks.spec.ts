/**
 * "Picks from X" on the home page: the site's own cards, built from what the
 * CMS stored (Site global → picks). Needs at least one pick in the CMS;
 * without one, the section must be absent.
 */
import { expect, test } from '@playwright/test'

import { open, overflowX } from './helpers'

const X_HOSTS = /(^|\.)(x\.com|twitter\.com|twimg\.com|t\.co)$/

test.describe('X picks', () => {
  test('TC-E-41 cards link to the post on x.com and load nothing from X', async ({ page }) => {
    const fromX: string[] = []
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname
      if (X_HOSTS.test(host)) fromX.push(request.url())
    })
    await open(page, '/', { view: 'cli' })
    const cards = page.locator('.x-pick')
    const count = await cards.count()
    if (count === 0) {
      await expect(page.locator('section.x-picks')).toHaveCount(0)
      test.skip(true, 'No picks in the CMS')
    }
    expect(count).toBeLessThanOrEqual(6)
    await expect(page.locator('#picks')).toContainText(String(count))
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i)
      await expect(card.locator('.x-pick-text')).not.toBeEmpty()
      await expect(card.locator('header')).toContainText('@')
      const link = card.locator('a[data-x-pick]')
      await expect(link).toHaveAttribute(
        'href',
        /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/,
      )
      await expect(link).toHaveAttribute('aria-label', /x\.com/)
      const time = card.locator('time')
      if (await time.count()) await expect(time).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
    }
    // No widget script, avatars or media: the cards are plain HTML.
    await expect(
      page.locator('script[src*="platform.twitter.com"], iframe[src*="twitter"]'),
    ).toHaveCount(0)
    expect(fromX).toEqual([])
  })

  for (const settings of [
    { view: 'cli', theme: 'light' },
    { view: 'modern', theme: 'dark' },
  ] as const) {
    test(`TC-E-42 cards fit 320px and stack, two columns from 768px (${settings.view}, ${settings.theme})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 })
      await open(page, '/', settings)
      const cards = page.locator('.x-pick')
      test.skip((await cards.count()) === 0, 'No picks in the CMS')
      expect(await overflowX(page)).toBeLessThanOrEqual(0)
      for (const box of await cards.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().right),
      )) {
        expect(box).toBeLessThanOrEqual(320)
      }
      if ((await cards.count()) < 2) return
      const left = async () =>
        cards.evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().left))
      const [a, b] = await left()
      expect(a).toBe(b) // one column on phones
      await page.setViewportSize({ width: 1024, height: 800 })
      const [c, d] = await left()
      expect(d).toBeGreaterThan(c ?? 0) // side by side
    })
  }

  test('TC-E-43 Japanese home translates the section and keeps the post language', async ({
    page,
  }) => {
    await open(page, '/ja', { view: 'modern' })
    const cards = page.locator('.x-pick')
    test.skip((await cards.count()) === 0, 'No picks in the CMS')
    await expect(page.locator('#picks')).toContainText('X からのピックアップ')
    await expect(cards.first().locator('a[data-x-pick]')).toContainText('x.com で開く')
    const langs = await page
      .locator('.x-pick-text[lang]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('lang')))
    for (const lang of langs) expect(lang).toMatch(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  })
})
