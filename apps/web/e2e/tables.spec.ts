import { expect, type Page, test } from '@playwright/test'

import { open, overflowX } from './helpers'

/**
 * Rich text tables (EXPERIMENTAL_TableFeature in the CMS, lib/richtext.ts).
 * Needs a note with a table; the case skips itself when the first notes have none.
 */
const noteWithTable = async (page: Page): Promise<string | null> => {
  await open(page, '/notes')
  const hrefs = await page
    .locator('a[href^="/notes/"]')
    .evaluateAll((links) =>
      [...new Set(links.map((a) => a.getAttribute('href') ?? ''))].slice(0, 12),
    )
  for (const href of hrefs) {
    await page.goto(href, { waitUntil: 'domcontentloaded' })
    if ((await page.locator('.rt-table').count()) > 0) return href
  }
  return null
}

test('TC-E-72 a wide table scrolls inside its box, never the page, in both views and themes', async ({
  page,
}) => {
  const href = await noteWithTable(page)
  test.skip(!href, 'No note with a table among the first notes in this CMS')
  for (const [width, view, theme] of [
    [320, 'cli', 'light'],
    [320, 'modern', 'dark'],
    [390, 'modern', 'light'],
    [390, 'cli', 'dark'],
    [1280, 'cli', 'light'],
  ] as const) {
    await page.setViewportSize({ width, height: 800 })
    await open(page, href as string, { view, theme })
    expect(await overflowX(page), `${width}px ${view} ${theme}`).toBeLessThanOrEqual(0)
    const box = page.locator('.rt-table').first()
    await expect(box).toHaveAttribute('role', 'region')
    await expect(box).toHaveAttribute('tabindex', '0')
    await expect(box.locator('table.table')).toHaveCount(1)
    // The box never grows past the text column; a wider table scrolls inside it.
    const fits = await box.evaluate((el) => {
      const parent = el.parentElement as HTMLElement
      return el.getBoundingClientRect().right <= parent.getBoundingClientRect().right + 1
    })
    expect(fits, `${width}px box inside the text column`).toBe(true)
    // Payload's own converter inlines grey borders; ours leaves colors to the theme.
    expect(await box.locator('[style]').count()).toBe(0)
  }
  // The keyboard can scroll a table that is wider than its box.
  await page.setViewportSize({ width: 320, height: 800 })
  await open(page, href as string)
  const wide = page.locator('.rt-table').filter({ has: page.locator('table') })
  const index = await wide.evaluateAll((els) =>
    els.findIndex((el) => el.scrollWidth > el.clientWidth + 1),
  )
  test.skip(index < 0, 'No table wider than 320px on this note')
  const box = wide.nth(index)
  await box.focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(() => box.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
})
