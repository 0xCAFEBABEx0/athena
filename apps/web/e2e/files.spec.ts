import { expect, test } from '@playwright/test'

import { open } from './helpers'

test('TC-E-17 og:image is the site image, and /og.png is served', async ({ page, request }) => {
  await open(page, '/posts')
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(og).toMatch(/^https?:\/\//)
  expect(og).not.toContain('website-template')
  const image = await request.get('/og.png')
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
})

test('TC-E-18 the template share image is gone', async ({ request }) => {
  expect((await request.get('/website-template-OG.webp')).status()).toBe(404)
})

test('TC-E-19 /llms.txt is generated from the site', async ({ request }) => {
  const res = await request.get('/llms.txt')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/plain')
  const text = await res.text()
  expect(text).toMatch(/^# \S/)
  expect(text).toContain('## Main sections')
  expect(text).not.toContain('Payload Website Template')
})

test('TC-E-20 the footer has no Payload template links', async ({ page }) => {
  await open(page, '/')
  const hrefs = await page.locator('footer a').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
  expect(hrefs.filter((href) => /payloadcms\.com|github\.com\/payloadcms/.test(href))).toEqual([])
})

test('TC-E-39 no link to the CMS admin in the header, sidebar or footer', async ({ page }) => {
  for (const path of ['/', '/ja/posts']) {
    await open(page, path)
    const hrefs = await page
      .locator('header a, footer a, nav a, aside a')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
    expect(hrefs.filter((href) => /\/admin(\/|$|\?)/.test(new URL(href).pathname + new URL(href).search)), path).toEqual([])
  }
})

test('TC-E-21 feeds and crawler files', async ({ request }) => {
  const rss = await request.get('/ja/rss.xml')
  expect(rss.status()).toBe(200)
  expect(await rss.text()).toContain('<language>ja</language>')
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain('Sitemap:')
  const sitemap = await request.get('/pages-sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).toContain('/work</loc>')
})

test('TC-E-22 unknown paths answer 404 in the page language', async ({ page }) => {
  const en = await open(page, '/no-such-page-xyz')
  expect(en?.status()).toBe(404)
  const ja = await open(page, '/ja/no-such-page-xyz')
  expect(ja?.status()).toBe(404)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})

test('TC-E-30 scanner paths get a plain 404 without a page render', async ({ request }) => {
  for (const path of ['/wp-login.php', '/.env', '/ja/config.php', '/posts/x.bak']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(404)
    expect(res.headers()['content-type'], path).toContain('text/plain')
  }
  // Real dotted routes still work.
  for (const path of ['/rss.xml', '/zh/rss.xml', '/llms.txt', '/search-index.json', '/ja/search-index.json']) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})
