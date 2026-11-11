import { expect, test } from '@playwright/test'

import { open } from './helpers'

const visibleRows = (page: import('@playwright/test').Page) =>
  page.locator('[data-search-text]:not([hidden])')

test.describe('/search (one cached page, filtered in the browser)', () => {
  test('TC-E-12 ?q= filters the list to matching posts', async ({ page }) => {
    await open(page, '/search', { view: 'cli' })
    const all = await page.locator('[data-search-text]').count()
    test.skip(all === 0, 'no posts in this CMS')
    const word = ((await page.locator('[data-search-text]').first().getAttribute('data-search-text')) ?? '').split(' ')[0] ?? ''
    await open(page, `/search?q=${encodeURIComponent(word)}`, { view: 'cli' })
    await expect(page.locator('[data-search-input]')).toHaveValue(word)
    const rows = visibleRows(page)
    expect(await rows.count()).toBeGreaterThan(0)
    for (const text of await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-search-text') ?? ''))) {
      expect(text).toContain(word)
    }
    await expect(page.locator('[data-prompt-line]')).toHaveText(`grep -ri "${word}" posts/`)
    await expect(page.locator('[data-prompt-count]').first()).toHaveText(String(await rows.count()))
  })

  test('TC-E-13 typing filters without any network request; no match shows the empty line', async ({ page }) => {
    await open(page, '/search', { view: 'cli' })
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await page.locator('[data-search-input]').fill('zzzz-no-such-post')
    await expect(visibleRows(page)).toHaveCount(0)
    await expect(page.locator('[data-search-empty]')).toBeVisible()
    await expect(page.locator('[data-prompt-count]').first()).toHaveText('0')
    await page.locator('[data-search-input]').fill('')
    await expect(page.locator('[data-prompt-line]')).toHaveText('ls posts')
    expect(requests).toEqual([])
  })

  test('TC-E-14 Enter updates the URL without loading a page', async ({ page }) => {
    await open(page, '/search', { view: 'cli' })
    let documents = 0
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents += 1
    })
    await page.locator('[data-search-input]').fill('astro')
    await page.locator('[data-search-input]').press('Enter')
    await expect(page).toHaveURL(/\/search\?q=astro$/)
    expect(documents).toBe(0)
  })

  test('TC-E-15 typing /status in the page prompt opens the status panel', async ({ page }) => {
    await open(page, '/search', { view: 'cli' })
    await page.locator('[data-search-input]').fill('/status')
    // The suggestion keeps its own text (the page filter must not rewrite it).
    await expect(page.locator('[data-prompt-commands] [data-prompt-command="/status"]')).toContainText('/status')
    await page.locator('[data-search-input]').press('Enter')
    await expect(page.locator('[data-status-dialog]')).toHaveAttribute('open', '')
  })

  test('TC-E-16 /ja/search is in Japanese and lists every post when empty', async ({ page }) => {
    await open(page, '/ja/search', { view: 'cli' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    const all = await page.locator('[data-search-text]').count()
    await expect(visibleRows(page)).toHaveCount(all)
    await expect(page.locator('[data-prompt-count]').first()).toHaveText(String(all))
  })
})
