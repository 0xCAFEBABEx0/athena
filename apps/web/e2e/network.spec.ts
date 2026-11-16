import { expect, test } from '@playwright/test'

import { open } from './helpers'

// Hosts a page may talk to: itself, Vercel's analytics scripts, and images
// (CMS media on Vercel Blob, GitHub social previews on /builds).
const ALLOWED = [
  /vercel-scripts\.com$/,
  /vercel-insights\.com$/,
  /blob\.vercel-storage\.com$/,
  /githubusercontent\.com$/,
  /githubassets\.com$/,
]

test('TC-E-24 pages make no unexpected requests (no CMS API calls from the browser)', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://localhost:4321').host
  const offenders: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol === 'data:' || url.host === origin) return
    if (url.pathname.startsWith('/api/') || !ALLOWED.some((host) => host.test(url.hostname)))
      offenders.push(request.url())
  })
  for (const path of ['/', '/ja/notes', '/builds', '/zh/search?q=a']) {
    await open(page, path, { view: 'cli' })
  }
  expect(offenders).toEqual([])
})

test('TC-E-25 the status panel loads the search index once', async ({ page }) => {
  await open(page, '/', { view: 'cli' })
  let loads = 0
  page.on('request', (request) => {
    if (request.url().includes('search-index.json')) loads += 1
  })
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press('s')
    await expect(page.locator('[data-status-dialog]')).toHaveAttribute('open', '')
    await expect(page.locator('[data-status-content]')).not.toHaveText('…')
    await page.keyboard.press('Escape')
  }
  expect(loads).toBeLessThanOrEqual(1)
})

test('TC-E-26 the popup search filters locally after one index load', async ({ page }) => {
  await open(page, '/', { view: 'cli' })
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.keyboard.press('/')
  const input = page.locator('[data-search-query]')
  for (const q of ['a', 'as', 'ast', 'zzz']) await input.fill(q)
  await page.waitForTimeout(300)
  expect(requests.filter((url) => !url.includes('search-index.json'))).toEqual([])
  expect(requests.filter((url) => url.includes('search-index.json')).length).toBeLessThanOrEqual(1)
})
