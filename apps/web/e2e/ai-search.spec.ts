import { expect, type Page, test } from '@playwright/test'

import { open, overflowX } from './helpers'

/**
 * AI search on /search (docs/AI_SEARCH.md). The browser's calls to
 * /api/ai/search and /api/ai/ask are answered here with fixed data built from
 * the page's own posts, so these cases spend nothing on any deployment and
 * test only the page. The endpoints themselves are checked in TC-E-65 with
 * requests they refuse before any cost.
 *
 * Every case skips itself when the deployment has no AI search (no
 * REVALIDATE_SECRET, or AI_SEARCH=off: the page has no data-meaning) or no
 * posts; the Ask AI cases also without ANTHROPIC_API_KEY (no Ask AI tab).
 */

const visibleRows = (page: Page) => page.locator('[data-search-text]:not([hidden])')

/** Slugs of the posts listed on the page, in page order. */
const slugsOn = (page: Page) =>
  page.locator('[data-search-text]').evaluateAll((els) => els.map((el) => el.getAttribute('data-slug') ?? ''))

const requireAi = async (page: Page) => {
  test.skip((await page.locator('[data-search-page][data-meaning]').count()) === 0, 'AI search is off on this deployment')
  const slugs = await slugsOn(page)
  test.skip(slugs.length === 0, 'no posts in this CMS')
  return slugs
}

/** Ask AI needs ANTHROPIC_API_KEY on the web deployment; By meaning does not. */
const requireAsk = async (page: Page) => {
  test.skip((await page.locator('[data-search-mode="ask"]').count()) === 0, 'Ask AI is off on this deployment')
}

const answerStream = (slugs: string[], prefix = '') => {
  const sources = slugs.slice(0, 2).map((slug, i) => ({
    n: i + 1,
    slug,
    title: `Source ${i + 1}`,
    href: `${prefix}/notes/${slug}`,
    heading: i === 0 ? 'A heading' : null,
  }))
  const events = [
    { type: 'sources', sources },
    { type: 'text', text: 'The first part of the answer.' },
    { type: 'cite', n: 1 },
    { type: 'text', text: ' The second part.' },
    ...(sources.length > 1 ? [{ type: 'cite', n: 2 }] : []),
    { type: 'done' },
  ]
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
}

test.describe('/search with AI (browser calls stubbed)', () => {
  test('TC-E-62 Search and Ask AI tabs switch with the keyboard and keep ?mode= in the URL; typing filters with no request', async ({
    page,
  }) => {
    await open(page, '/search', { view: 'cli' })
    await requireAi(page)
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/ai/')) requests.push(request.url())
    })
    const tabs = page.locator('[data-search-mode]')
    if ((await tabs.count()) === 0) {
      // Without Ask AI there is only Search, and ?mode=ask opens it.
      await open(page, '/search?mode=ask', { view: 'cli' })
      await expect(page).not.toHaveURL(/mode=/)
      await expect(page.locator('[data-mode-hint]')).toBeVisible()
    } else {
      await expect(tabs).toHaveCount(2)
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
      await tabs.first().focus()
      await page.keyboard.press('ArrowRight')
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
      await expect(tabs.nth(1)).toBeFocused()
      await expect(page).toHaveURL(/[?&]mode=ask/)
      await tabs.first().click()
      await expect(page).not.toHaveURL(/mode=/)
      // ?mode=meaning belongs to the Search tab.
      await open(page, '/search?mode=meaning', { view: 'cli' })
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    }
    await page.locator('[data-search-input]').fill('zzzz-no-such-post')
    await expect(visibleRows(page)).toHaveCount(0)
    // No keyword match: the empty line points at Enter (search by meaning).
    await expect(page.locator('[data-search-empty]')).toContainText('Enter')
    expect(requests).toEqual([])
  })

  test('TC-E-63 Search filters by keyword as you type and searches by meaning on Enter; typing again goes back to keywords', async ({
    page,
  }) => {
    await open(page, '/search', { view: 'cli' })
    const slugs = await requireAi(page)
    const picked = [...slugs].reverse().slice(0, 2)
    let bodies = 0
    await page.route('**/api/ai/search', async (route) => {
      bodies += 1
      expect(route.request().postDataJSON()).toEqual({ q: 'how it works', locale: 'en' })
      await route.fulfill({
        json: {
          posts: picked.map((slug, i) => ({
            slug,
            href: `/notes/${slug}`,
            title: slug,
            heading: null,
            snippet: `Snippet ${i + 1}`,
            score: 0.5 - i / 10,
          })),
        },
      })
    })
    const input = page.locator('[data-search-input]')
    await input.fill('how it works')
    // Typing filters by keyword and asks nothing.
    await page.waitForTimeout(300)
    expect(bodies).toBe(0)
    await expect(page.locator('[data-prompt-line]')).toHaveText('grep -ri "how it works" notes/')
    await input.press('Enter')
    await expect(page.locator('[data-prompt-line]')).toHaveText('search --meaning "how it works" notes/')
    await expect(visibleRows(page)).toHaveCount(picked.length)
    expect(await visibleRows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-slug')))).toEqual(picked)
    await expect(visibleRows(page).first().locator('[data-ai-snippet]')).toHaveText('Snippet 1')
    await expect(page).toHaveURL(/q=how\+it\+works.*mode=meaning|mode=meaning.*q=how\+it\+works/)
    // The same query again is not sent twice.
    await input.press('Enter')
    await page.waitForTimeout(300)
    expect(bodies).toBe(1)
    // Typing again: back to the keyword filter, snippets gone, mode dropped.
    await input.fill('')
    await expect(visibleRows(page)).toHaveCount(slugs.length)
    await expect(page.locator('[data-ai-snippet]')).toHaveCount(0)
    await expect(page).not.toHaveURL(/mode=/)
    expect(bodies).toBe(1)
  })

  test('TC-E-68 the composer and the "/" popup open /search by meaning on Enter and offer "Ask Hoo" only with Ask AI', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await open(page, '/search', { view: 'cli' })
    await requireAi(page)
    const withAsk = (await page.locator('[data-search-mode="ask"]').count()) > 0
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/ai/')) requests.push(request.url())
    })
    // The pinned composer on the home page (ADE view).
    await open(page, '/', { view: 'modern' })
    const input = page.locator('[data-search-prompt] [data-search-input]').first()
    await input.fill('how it works')
    const ask = page.locator('[data-prompt-ask]').first()
    if (withAsk) {
      await expect(ask).toBeVisible()
      await expect(ask).toHaveAttribute('aria-selected', 'false')
      expect(await overflowX(page)).toBeLessThanOrEqual(0)
      await input.press('ArrowDown')
      await expect(ask).toHaveAttribute('aria-selected', 'true')
      await input.press('ArrowUp')
      await expect(ask).toHaveAttribute('aria-selected', 'false')
    } else {
      await expect(ask).toHaveCount(0)
    }
    expect(requests).toEqual([])
    await page.route('**/api/ai/search', (route) => route.fulfill({ json: { posts: [] } }))
    await input.press('Enter')
    await expect(page).toHaveURL(/\/search\?.*mode=meaning/)
    await expect(page.locator('[data-prompt-line]')).toHaveText('search --meaning "how it works" notes/')

    // The "/" popup: never selects Ask Hoo by itself.
    await open(page, '/', { view: 'cli' })
    await page.keyboard.press('/')
    const query = page.locator('[data-search-query]')
    await expect(query).toBeFocused()
    await query.fill('zzzz-no-such-post')
    const askHit = page.locator('[data-search-results] [data-ask]')
    if (withAsk) {
      await expect(askHit).toBeVisible()
      await expect(askHit).toHaveAttribute('aria-selected', 'false')
      await expect(askHit).toHaveAttribute('href', /mode=ask/)
    } else {
      await expect(askHit).toHaveCount(0)
    }
    await query.press('Enter')
    await expect(page).toHaveURL(/\/search\?.*mode=meaning/)
  })

  test('TC-E-64 Ask AI streams the answer with numbered citations linking to the posts; errors show as an alert', async ({
    page,
  }) => {
    await open(page, '/ja/search?mode=ask', { view: 'modern', theme: 'dark' })
    const slugs = await requireAi(page)
    await requireAsk(page)
    await page.route('**/api/ai/ask', (route) =>
      route.fulfill({ contentType: 'application/x-ndjson', body: answerStream(slugs, '/ja') }),
    )
    await page.locator('[data-search-input]').fill('どうやって動く？')
    await page.locator('[data-search-input]').press('Enter')
    const answer = page.locator('[data-ai-answer]')
    await expect(answer).toBeVisible()
    await expect(page.locator('[data-ai-text]')).toContainText('The first part of the answer.')
    await expect(page.locator('[data-ai-text]')).toContainText('The second part.')
    const cites = page.locator('[data-ai-text] .ai-cite')
    await expect(cites.first()).toHaveText('1')
    await expect(cites.first()).toHaveAttribute('href', `/ja/notes/${slugs[0]}`)
    await expect(page.locator('[data-ai-sources]')).toBeVisible()
    await expect(page.locator('[data-ai-source-list] li').first()).toContainText('Source 1 — A heading')
    await expect(visibleRows(page)).toHaveCount(Math.min(2, slugs.length))
    await expect(page.locator('[data-ai-status]')).toBeHidden()

    await page.unroute('**/api/ai/ask')
    await page.route('**/api/ai/ask', (route) =>
      route.fulfill({ status: 429, json: { error: { code: 'busy', message: 'Too many questions.' } } }),
    )
    await page.locator('[data-search-input]').fill('もう一度')
    await page.locator('[data-search-input]').press('Enter')
    await expect(page.locator('[data-ai-error]')).toBeVisible()
    await expect(page.locator('[data-ai-answer]')).toBeHidden()
  })

  test('TC-E-67 a suggested question asks itself when clicked, shows only in Ask AI, and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await open(page, '/search?mode=ask', { view: 'cli' })
    const slugs = await requireAi(page)
    await requireAsk(page)
    const presets = page.locator('[data-ai-preset]')
    test.skip((await presets.count()) === 0, 'no suggested questions in the Site settings')
    await expect(page.locator('[data-ai-presets]')).toBeVisible()
    expect(await overflowX(page)).toBeLessThanOrEqual(0)
    const asked: string[] = []
    await page.route('**/api/ai/ask', async (route) => {
      asked.push(String(route.request().postDataJSON()?.q))
      await route.fulfill({ contentType: 'application/x-ndjson', body: answerStream(slugs) })
    })
    const question = (await presets.first().getAttribute('data-ai-preset')) ?? ''
    await presets.first().click()
    await expect(page.locator('[data-search-input]')).toHaveValue(question)
    await expect(page.locator('[data-ai-text]')).toContainText('The first part of the answer.')
    expect(asked).toEqual([question])
    // Not offered in Search.
    await page.locator('[data-search-mode="keyword"]').click()
    await expect(page.locator('[data-ai-presets]')).toBeHidden()
  })

  for (const width of [320, 390]) {
    test(`TC-E-66 phone width ${width}px: tabs, answer and sources fit without horizontal scroll (CLI and ADE)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      for (const view of ['cli', 'modern'] as const) {
        await open(page, '/search?mode=ask', { view })
        const slugs = await requireAi(page)
        await requireAsk(page)
        await page.route('**/api/ai/ask', (route) =>
          route.fulfill({ contentType: 'application/x-ndjson', body: answerStream(slugs) }),
        )
        await page.locator('[data-search-input]').fill('A long question about how the whole site is built and deployed?')
        await page.locator('[data-search-input]').press('Enter')
        await expect(page.locator('[data-ai-sources]')).toBeVisible()
        for (const tab of await page.locator('[data-search-mode]').all()) await expect(tab).toBeInViewport()
        expect(await overflowX(page)).toBeLessThanOrEqual(0)
        await page.unroute('**/api/ai/ask')
      }
    })
  }
})

test.describe('/api/ai/* (only requests refused before any cost)', () => {
  test('TC-E-65 another site cannot call the AI endpoints; an empty question is refused', async ({ request, baseURL }) => {
    for (const path of ['/api/ai/ask', '/api/ai/search']) {
      const crossSite = await request.post(path, {
        data: { q: 'hello' },
        headers: { origin: 'https://evil.example' },
      })
      expect(crossSite.status()).toBe(403)
      const empty = await request.post(path, { data: { q: '   ' }, headers: { origin: new URL(baseURL ?? '').origin } })
      // 503 when AI search is not set up on this deployment.
      expect([400, 503]).toContain(empty.status())
      expect(empty.headers()['cache-control']).toContain('no-store')
    }
  })
})
