/**
 * Search-engine metadata, checked against Google Search Central guidance:
 * unique titles and descriptions, self-referencing canonical, reciprocal
 * hreflang with x-default, noindex for search results and 404s, valid
 * structured data, and a sitemap that lists only indexable URLs.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

type Head = {
  status: number
  lang: string
  title: string
  description: string | null
  robots: string | null
  canonical: string | null
  ogUrl: string | null
  ogType: string | null
  ogLocale: string | null
  ogLocaleAlternates: string[]
  hreflang: Record<string, string>
  jsonLd: Record<string, unknown>[]
  h1: string
}

const readHead = async (page: Page, path: string): Promise<Head> => {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  const head = await page.evaluate(() => {
    const attr = (selector: string, name = 'content') =>
      document.querySelector(selector)?.getAttribute(name) ?? null
    const hreflang: Record<string, string> = {}
    for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
      hreflang[link.getAttribute('hreflang') ?? ''] = link.getAttribute('href') ?? ''
    }
    return {
      lang: document.documentElement.lang,
      title: document.title,
      description: attr('meta[name="description"]'),
      robots: attr('meta[name="robots"]'),
      canonical: attr('link[rel="canonical"]', 'href'),
      ogUrl: attr('meta[property="og:url"]'),
      ogType: attr('meta[property="og:type"]'),
      ogLocale: attr('meta[property="og:locale"]'),
      ogLocaleAlternates: [...document.querySelectorAll('meta[property="og:locale:alternate"]')].map(
        (m) => m.getAttribute('content') ?? '',
      ),
      hreflang,
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
        JSON.parse(s.textContent ?? '{}'),
      ),
      h1: [...document.querySelectorAll('h1')]
        .filter((h) => h.offsetParent !== null || getComputedStyle(h).display !== 'none')
        .map((h) => h.textContent?.trim() ?? '')
        .join(' | '),
    }
  })
  return { status: response?.status() ?? 0, ...head }
}

const pathOf = (url: string | null) => (url ? new URL(url).pathname.replace(/\/$/, '') || '/' : null)

const firstLink = async (page: Page, path: string, prefix: string) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  return page.locator(`a[href^="${prefix}"]`).first().getAttribute('href').catch(() => null)
}

const indexable = async (page: Page) => {
  const post = await firstLink(page, '/posts', '/posts/')
  const work = await firstLink(page, '/work', '/work/')
  return ['/', '/ja', '/zh', '/posts', '/ja/posts', '/work', '/ja/work', post, work].filter(
    (path): path is string => Boolean(path),
  )
}

test('TC-E-31 indexable pages: own title (per language) and description, self canonical, all hreflang', async ({ page }) => {
  const titles = new Map<string, string>()
  for (const path of await indexable(page)) {
    const head = await readHead(page, path)
    expect(head.status, path).toBe(200)
    expect(head.robots, path).toBeNull()
    expect(head.title.length, path).toBeGreaterThan(0)
    // Unique within a language (language versions of one page may share a
    // title, e.g. the site name on each home page).
    const key = `${head.lang} ${head.title}`
    expect(titles.has(key), `${path} repeats the title of ${titles.get(key)}`).toBe(false)
    titles.set(key, path)
    expect(head.description?.length ?? 0, `${path} description`).toBeGreaterThan(0)
    expect(head.description?.length ?? 0, `${path} description`).toBeLessThanOrEqual(160)
    expect(head.canonical, path).toMatch(/^https?:\/\//)
    expect(pathOf(head.canonical), path).toBe(path === '/' ? '/' : path.replace(/\/$/, ''))
    expect(head.ogUrl, path).toBe(head.canonical)
    expect(Object.keys(head.hreflang).sort(), path).toEqual(['en', 'ja', 'x-default', 'zh-Hans'])
  }
})

test('TC-E-32 hreflang is reciprocal and points at the right language', async ({ page }) => {
  const post = await firstLink(page, '/posts', '/posts/')
  for (const bare of ['/posts', ...(post ? [post] : [])]) {
    const versions = [bare, `/ja${bare}`, `/zh${bare}`]
    const sets = []
    for (const path of versions) {
      const head = await readHead(page, path)
      sets.push(head.hreflang)
      // Each version lists itself under its own language tag.
      expect(pathOf(head.hreflang[head.lang] ?? null), path).toBe(path)
    }
    expect(sets[1]).toEqual(sets[0])
    expect(sets[2]).toEqual(sets[0])
    expect(pathOf(sets[0]?.['x-default'] ?? null)).toBe(bare)
  }
})

test('TC-E-33 search pages are noindex, follow, with no canonical or hreflang', async ({ page }) => {
  for (const path of ['/search', '/search?q=astro', '/ja/search']) {
    const head = await readHead(page, path)
    expect(head.robots, path).toBe('noindex, follow')
    expect(head.canonical, path).toBeNull()
    expect(Object.keys(head.hreflang), path).toEqual([])
  }
})

test('TC-E-34 404 pages are noindex with a localized title', async ({ page }) => {
  const en = await readHead(page, '/no-such-page')
  expect(en.status).toBe(404)
  expect(en.robots).toBe('noindex, follow')
  expect(en.canonical).toBeNull()
  expect(en.ogUrl).toBeNull()
  expect(Object.keys(en.hreflang)).toEqual([])
  expect(en.title).toContain('Page not found')
  const ja = await readHead(page, '/ja/no-such-page')
  expect(ja.status).toBe(404)
  expect(ja.title).toContain('ページが見つかりません')
})

test('TC-E-35 posts: og:type article, dates, BlogPosting matching the page', async ({ page }) => {
  const post = await firstLink(page, '/posts', '/posts/')
  test.skip(!post, 'no posts in the CMS')
  for (const path of [post as string, `/ja${post}`]) {
    const head = await readHead(page, path)
    expect(head.ogType, path).toBe('article')
    expect(await page.locator('meta[property="article:published_time"]').getAttribute('content')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
    const ld = head.jsonLd.find((d) => d['@type'] === 'BlogPosting')
    expect(ld, path).toBeTruthy()
    expect(ld?.['@context']).toBe('https://schema.org')
    expect(head.h1).toContain(String(ld?.headline))
    expect(ld?.inLanguage).toBe(head.lang)
    expect(ld?.url).toBe(head.canonical)
    expect(String(ld?.datePublished)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Array.isArray(ld?.image)).toBe(true)
  }
})

test('TC-E-36 home: WebSite JSON-LD; work: SoftwareSourceCode; lists have none', async ({ page }) => {
  const home = await readHead(page, '/')
  const site = home.jsonLd.find((d) => d['@type'] === 'WebSite')
  expect(site).toBeTruthy()
  expect(site?.url).toBe(home.canonical)
  expect(site?.name).toBe(await page.locator('meta[property="og:site_name"]').getAttribute('content'))
  expect((await readHead(page, '/posts')).jsonLd).toEqual([])

  const work = await firstLink(page, '/work', '/work/')
  test.skip(!work, 'no projects')
  const item = await readHead(page, work as string)
  const code = item.jsonLd.find((d) => d['@type'] === 'SoftwareSourceCode')
  expect(code?.url).toBe(item.canonical)
  expect(code?.programmingLanguage ?? []).not.toContain('Other')
})

test('TC-E-37 og:locale follows the page language', async ({ page }) => {
  const expected: Record<string, string> = { '/': 'en_US', '/ja': 'ja_JP', '/zh': 'zh_CN' }
  for (const [path, locale] of Object.entries(expected)) {
    const head = await readHead(page, path)
    expect(head.ogLocale, path).toBe(locale)
    expect(head.ogLocaleAlternates.sort(), path).toEqual(
      Object.values(expected).filter((l) => l !== locale).sort(),
    )
  }
})

const sitemapURLs = async (request: APIRequestContext, path: string) => {
  const xml = await (await request.get(path)).text()
  return [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(<lastmod>[^<]+<\/lastmod>)?<\/url>/g)].map((m) => ({
    loc: m[1] as string,
    lastmod: Boolean(m[2]),
  }))
}

test('TC-E-38 sitemaps list only indexable 200 pages whose canonical is themselves', async ({ page, request }) => {
  const pages = await sitemapURLs(request, '/pages-sitemap.xml')
  const paths = pages.map((entry) => new URL(entry.loc).pathname)
  expect(paths).toContain('/')
  expect(paths.some((p) => p.endsWith('/search'))).toBe(false)
  // Fixed routes have no reliable change date, so no <lastmod>.
  for (const entry of pages.filter((e) => /^\/(ja\/|zh\/)?(posts|work)?$/.test(new URL(e.loc).pathname))) {
    expect(entry.lastmod, entry.loc).toBe(false)
  }
  const posts = await sitemapURLs(request, '/posts-sitemap.xml')
  for (const { loc } of [...pages, ...posts]) {
    const path = new URL(loc).pathname
    const head = await readHead(page, path)
    expect(head.status, path).toBe(200)
    expect(head.robots, path).toBeNull()
    expect(pathOf(head.canonical), path).toBe(path.replace(/\/$/, '') || '/')
  }
})
