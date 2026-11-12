/**
 * /about: the profile from the CMS About global. Hidden (404) until the global
 * has a lead or a story; these cases skip then, after checking that it is hidden.
 */
import { expect, test, type Page } from '@playwright/test'

import { open, overflowX } from './helpers'

const hasAbout = async (page: Page, path = '/about', settings = {}) => {
  const response = await open(page, path, { view: 'cli', ...settings })
  // 404 = nothing written yet (cases skip); anything else but 200 is a failure.
  expect([200, 404], path).toContain(response?.status())
  return response?.status() === 200
}

test.describe('About', () => {
  test('TC-E-55 one h1, the lead or the story, the sitemap lists /about only while it exists', async ({
    page,
    request,
  }) => {
    const exists = await hasAbout(page)
    const sitemap = await (await request.get('/pages-sitemap.xml')).text()
    // Each language on its own: listed exactly when that page answers 200.
    for (const path of ['/about', '/ja/about', '/zh/about']) {
      const answers = (await request.get(path, { maxRedirects: 0 })).status() === 200
      expect(sitemap.includes(`${path}</loc>`), path).toBe(answers)
    }
    test.skip(!exists, 'Nothing in the CMS About global')

    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('[data-prompt-line]')).toHaveText('cat about.md')
    const text = (await page.locator('.about-lead, .about-body').allTextContents()).join('').trim()
    expect(text.length).toBeGreaterThan(0)
    await expect(page).toHaveTitle(/whoa\.me/)
    // The portrait, when there is one, comes from Media and has alt text.
    const portrait = page.locator('[data-about-portrait] img')
    if ((await portrait.count()) > 0) {
      expect(await portrait.getAttribute('alt')).toBeTruthy()
      expect(await portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    }
    // Links come from Site → Social links and are rel="me".
    for (const rel of await page.locator('.about-links a').evaluateAll((as) => as.map((a) => a.getAttribute('rel')))) {
      expect(rel).toContain('me')
    }

    for (const path of ['/ja/about', '/zh/about']) {
      expect(await hasAbout(page, path)).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('lang', path.startsWith('/ja') ? 'ja' : 'zh-Hans')
    }
  })

  for (const [width, settings, path] of [
    [320, { view: 'modern', theme: 'light' }, '/about'],
    [390, { view: 'cli', theme: 'dark' }, '/ja/about'],
    [1280, { view: 'modern', theme: 'dark' }, '/zh/about'],
  ] as const) {
    test(`TC-E-55 ${width}px ${settings.view} ${settings.theme}: no horizontal scroll, the portrait beside the lead only on wide screens`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      test.skip(!(await hasAbout(page, path, settings)), 'Nothing in the CMS About global')
      expect(await overflowX(page)).toBeLessThanOrEqual(0)
      const portrait = page.locator('[data-about-portrait]')
      const lead = page.locator('.about-lead')
      if ((await portrait.count()) === 0 || (await lead.count()) === 0) return
      const [p, l] = [await portrait.boundingBox(), await lead.boundingBox()]
      if (!p || !l) throw new Error('portrait or lead not laid out')
      if (width >= 640) expect(p.x).toBeGreaterThan(l.x + l.width - 1)
      else expect(p.y).toBeGreaterThanOrEqual(l.y + l.height - 1)
    })
  }
})
