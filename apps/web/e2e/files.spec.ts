import { expect, test } from '@playwright/test'

import { open } from './helpers'

test('TC-E-17 og:image is the site image, and /og.png is served', async ({ page, request }) => {
  await open(page, '/notes')
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
  const hrefs = await page
    .locator('footer a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
  expect(hrefs.filter((href) => /payloadcms\.com|github\.com\/payloadcms/.test(href))).toEqual([])
})

test('TC-E-39 no link to the CMS admin in the header, sidebar or footer', async ({ page }) => {
  for (const path of ['/', '/ja/notes']) {
    await open(page, path)
    const hrefs = await page
      .locator('header a, footer a, nav a, aside a')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
    expect(
      hrefs.filter((href) =>
        /\/admin(\/|$|\?)/.test(new URL(href).pathname + new URL(href).search),
      ),
      path,
    ).toEqual([])
  }
})

test('TC-E-21 feeds and crawler files', async ({ request }) => {
  const rss = await request.get('/ja/rss.xml')
  expect(rss.status()).toBe(200)
  const feed = await rss.text()
  expect(feed).toContain('<language>ja</language>')
  // Items link to /notes but keep their pre-1.2.0 GUIDs, so readers do not
  // list every post again.
  for (const item of feed.match(/<item>.*?<\/item>/gs) ?? []) {
    expect(item).toMatch(/<link>[^<]*\/ja\/notes\/[^<]+<\/link>/)
    expect(item).toMatch(/<guid isPermaLink="true">[^<]*\/ja\/posts\/[^<]+<\/guid>/)
  }
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain('Sitemap:')
  const sitemap = await request.get('/pages-sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).toContain('/builds</loc>')
})

test('TC-E-22 unknown paths answer 404 in the page language', async ({ page }) => {
  const en = await open(page, '/no-such-page-xyz')
  expect(en?.status()).toBe(404)
  const ja = await open(page, '/ja/no-such-page-xyz')
  expect(ja?.status()).toBe(404)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})

test('TC-E-30 scanner paths get a plain 404 without a page render', async ({ request }) => {
  for (const path of ['/wp-login.php', '/.env', '/ja/config.php', '/notes/x.bak']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(404)
    expect(res.headers()['content-type'], path).toContain('text/plain')
  }
  // Real dotted routes still work.
  for (const path of [
    '/rss.xml',
    '/zh/rss.xml',
    '/llms.txt',
    '/search-index.json',
    '/ja/search-index.json',
  ]) {
    expect((await request.get(path)).status(), path).toBe(200)
  }
})

test('TC-E-44 leaving preview only redirects to a path on this site', async ({ request }) => {
  const target = async (path: string) => {
    const res = await request.get(`/api/exit-preview?path=${path}`, { maxRedirects: 0 })
    expect(res.status(), path).toBe(307)
    return res.headers().location ?? ''
  }
  expect(await target('/notes')).toBe('/notes')
  for (const path of ['//example.com', '/%5Cexample.com', 'https://example.com', '']) {
    expect(await target(path), path).toBe('/')
  }
  // The preview entry point needs the secret before it looks at the path.
  const preview = await request.get('/api/preview?path=//example.com&previewSecret=wrong', {
    maxRedirects: 0,
  })
  expect(preview.status()).toBe(401)
})

test('TC-E-53 old section URLs (1.1 and before) redirect permanently to the renamed ones', async ({
  request,
}) => {
  for (const [from, to] of [
    ['/posts', '/notes'],
    ['/posts/page/2', '/notes/page/2'],
    ['/ja/posts/some-post', '/ja/notes/some-post'],
    ['/work', '/builds'],
    ['/zh/work/my.app', '/zh/builds/my.app'],
    ['/stack', '/stacks'],
    ['/ja/stack?view=cli', '/ja/stacks?view=cli'],
  ] as const) {
    const res = await request.get(from, { maxRedirects: 0 })
    expect(res.status(), from).toBe(308)
    expect(res.headers().location, from).toBe(to)
  }
  // Paths that only start with the same letters are not sections.
  expect((await request.get('/postscript', { maxRedirects: 0 })).status()).not.toBe(308)
})

test('TC-E-56 a CMS redirect written for an old section path wins over the rename', async ({
  request,
}) => {
  const res = await request.get('/posts/moved-away', { maxRedirects: 0 })
  if (res.status() === 308) test.skip(true, 'No Redirects entry for /posts/moved-away in this CMS')
  expect(res.status()).toBe(301)
  expect(res.headers().location).toBe('/about')
  // A CMS link typed as /posts/moved-away renders as /notes/moved-away: the
  // same entry answers there too, in every language.
  for (const [path, to] of [
    ['/notes/moved-away', '/about'],
    ['/ja/notes/moved-away', '/ja/about'],
  ] as const) {
    const renamed = await request.get(path, { maxRedirects: 0 })
    expect(renamed.status(), path).toBe(301)
    expect(renamed.headers().location, path).toBe(to)
  }
})
