/**
 * /stack: the tools from the CMS Stack global. Hidden (404) until the global
 * has a tool; these cases skip then, after checking that it is hidden.
 */
import { expect, test, type Page } from '@playwright/test'

import { open, overflowX } from './helpers'

const hasStack = async (page: Page, path = '/stack') => {
  const response = await open(page, path, { view: 'cli' })
  return response?.status() === 200
}

test.describe('Stack', () => {
  test('TC-E-49 sitemap lists /stack only while the page exists', async ({ page, request }) => {
    const exists = await hasStack(page)
    const sitemap = await (await request.get('/pages-sitemap.xml')).text()
    for (const path of ['/stack', '/ja/stack', '/zh/stack']) {
      expect(sitemap.includes(`${path}</loc>`)).toBe(exists)
    }
    if (!exists) {
      await expect(page.locator('h1')).not.toContainText('Stack')
      test.skip(true, 'No tools in the CMS Stack global')
    }
  })

  test('TC-E-50 CLI tree: ├─/└─ rows, count in the heading, links open the site in a new tab', async ({
    page,
  }) => {
    test.skip(!(await hasStack(page)), 'No tools in the CMS Stack global')
    const groups = page.locator('.stack-group:not(.stack-former)')
    let total = 0
    for (let g = 0; g < (await groups.count()); g += 1) {
      const trees = await groups.nth(g).locator('.stack-tree').allTextContents()
      expect(trees.length).toBeGreaterThan(0)
      expect(trees.at(-1)?.trim()).toBe('└─')
      for (const tree of trees.slice(0, -1)) expect(tree.trim()).toBe('├─')
      total += trees.length
    }
    await expect(page.locator('#stack [data-prompt-count]').first()).toHaveText(String(total))
    for (const link of await page.locator('a.stack-row').all()) {
      await expect(link).toHaveAttribute('href', /^https?:\/\//)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
    }
    // Former tools start folded.
    const former = page.locator('.stack-former')
    if (await former.count()) await expect(former).not.toHaveAttribute('open', '')
  })

  test('TC-E-51 ADE: icon tile (favicon from Media or initials); nothing loaded from Google or the tools’ sites', async ({
    page,
  }) => {
    const outside: string[] = []
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname
      if (/(^|\.)(google|gstatic)\.com$/.test(host)) outside.push(request.url())
    })
    test.skip(!(await hasStack(page)), 'No tools in the CMS Stack global')
    await open(page, '/stack', { view: 'modern' })
    const links = await page
      .locator('a.stack-row')
      .evaluateAll((els) => els.map((el) => new URL((el as HTMLAnchorElement).href).host))
    const icons = page.locator('.stack-group:not(.stack-former) .stack-icon')
    for (let i = 0; i < (await icons.count()); i += 1) {
      const icon = icons.nth(i)
      await expect(icon).toBeVisible()
      const img = icon.locator('img')
      if (await img.count()) {
        const src = new URL((await img.getAttribute('src')) ?? '', page.url())
        expect(links).not.toContain(src.host)
        expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      } else {
        expect((await icon.textContent())?.trim()).toMatch(/^\S{1,2}$/)
      }
    }
    expect(outside).toEqual([])
  })

  for (const width of [320, 390]) {
    for (const [view, theme, path] of [
      ['cli', 'light', '/ja/stack'],
      ['modern', 'dark', '/stack'],
      ['modern', 'light', '/zh/stack'],
    ] as const) {
      test(`TC-E-52 no horizontal scroll at ${width}px (${view}, ${theme}, ${path})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 })
        const response = await open(page, path, { view, theme })
        test.skip(response?.status() !== 200, 'No tools in the CMS Stack global')
        expect(await overflowX(page)).toBeLessThanOrEqual(0)
        for (const box of await page
          .locator('.stack-row')
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) {
          expect(box).toBeLessThanOrEqual(width)
        }
      })
    }
  }
})
