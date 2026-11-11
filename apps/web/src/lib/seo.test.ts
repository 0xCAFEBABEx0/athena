import { describe, expect, test } from 'bun:test'

import {
  buildMeta,
  DEFAULT_OG_IMAGE,
  homeTitle,
  htmlToText,
  jsonLdScript,
  postJsonLd,
  postMeta,
  routeMeta,
  summarize,
  websiteJsonLd,
  workJsonLd,
} from './seo'

process.env.WEB_URL = 'https://whoa.me'

describe('share image (og:image)', () => {
  test('TC-U-13 built-in image is ours, not the template one', () => {
    expect(DEFAULT_OG_IMAGE).toBe('/og.png')
    expect(routeMeta(null, '/', { siteName: 'whoa.me' }).ogImage).toBe('https://whoa.me/og.png')
  })

  test('TC-U-14 the Site global image replaces the built-in one', () => {
    const site = { siteName: 'whoa.me', ogImage: 'https://blob.example/site.png' }
    expect(routeMeta('Posts', '/posts', site).ogImage).toBe('https://blob.example/site.png')
    expect(buildMeta({ title: 'A post' }, '/posts/a', site).ogImage).toBe('https://blob.example/site.png')
  })

  test('TC-U-15 a page image beats both', () => {
    const meta = buildMeta(
      { title: 'A', meta: { image: { id: 1, url: 'https://blob.example/page.png' } as never } },
      '/a',
      { siteName: 'whoa.me', ogImage: 'https://blob.example/site.png' },
    )
    expect(meta.ogImage).toBe('https://blob.example/page.png')
    expect(meta.title).toBe('A | whoa.me')
  })
})

describe('search metadata', () => {
  const site = { siteName: 'whoa.me', intro: 'I build small tools.\nMostly for the web.' }

  test('TC-U-19 description falls back to the intro, then the welcome line', () => {
    expect(routeMeta(null, '/', site).description).toBe('I build small tools. Mostly for the web.')
    expect(routeMeta(null, '/', { siteName: 'x', welcome: 'Hi' }).description).toBe('Hi')
    expect(routeMeta(null, '/', { siteName: 'x', description: 'SEO', intro: 'intro' }).description).toBe('SEO')
    expect(routeMeta(null, '/', { siteName: 'x' }).description).toBeUndefined()
  })

  test('TC-U-20 a route description beats the site one', () => {
    expect(routeMeta('Posts', '/posts', site, 'Every post.').description).toBe('Every post.')
  })

  test('TC-U-21 summaries stop near 155 characters, on a word in English', () => {
    const long = 'word '.repeat(60)
    const out = summarize(long)
    expect(out.length).toBeLessThanOrEqual(155)
    expect(out.endsWith('word…')).toBe(true)
    const ja = 'あ'.repeat(300)
    expect(summarize(ja).length).toBe(155)
    expect(summarize('  short  text ')).toBe('short text')
  })

  test('TC-U-32 htmlToText leaves an out-of-range character reference as text', () => {
    expect(htmlToText('<p>a &#99999999; &#x110000; &#65;</p>')).toBe('a &#99999999; &#x110000; A')
  })

  test('TC-U-22 a post without an SEO description uses its text; og:type article with dates', () => {
    const meta = postMeta(
      { title: 'T', publishedAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z' },
      '/posts/t',
      site,
      htmlToText('<p>Fish &amp; chips &lt;3</p><h2>Two</h2>'),
    )
    expect(meta.description).toBe('Fish & chips <3 Two')
    expect(meta.type).toBe('article')
    expect(meta.publishedTime).toBe('2026-11-01T00:00:00.000Z')
    expect(meta.modifiedTime).toBe('2026-11-02T00:00:00.000Z')
    const own = buildMeta({ title: 'T', meta: { description: 'Own' } }, '/p', site, 'text')
    expect(own.description).toBe('Own')
  })

  test('TC-U-23 JSON-LD: WebSite, BlogPosting, SoftwareSourceCode', () => {
    const home = websiteJsonLd(
      { siteName: 'whoa.me', authorName: 'Ann', socialLinks: [{ url: 'https://github.com/ann' }, { url: 'mailto:a@b' }] },
      'ja',
      'https://whoa.me/ja',
    )
    expect(home['@type']).toBe('WebSite')
    expect(home.inLanguage).toBe('ja')
    expect(home.author).toEqual({ '@type': 'Person', name: 'Ann', url: 'https://whoa.me/ja', sameAs: ['https://github.com/ann'] })

    const meta = postMeta({ title: 'T', publishedAt: '2026-11-01T00:00:00.000Z' }, '/posts/t', site, 'Body')
    const post = postJsonLd(meta, 'T', ['Ann'], 'zh', 'https://whoa.me/zh')
    expect(post['@type']).toBe('BlogPosting')
    expect(post.inLanguage).toBe('zh-Hans')
    expect(post.datePublished).toBe('2026-11-01T00:00:00.000Z')
    expect(post.dateModified).toBe('2026-11-01T00:00:00.000Z')
    expect(post.image).toEqual(['https://whoa.me/og.png'])

    const work = workJsonLd(
      { title: 'athena', description: 'CMS', repoUrl: 'https://github.com/a/athena', liveUrl: null, languages: [{ name: 'TypeScript' }], createdAt: '', pushedAt: '' },
      'https://whoa.me/work/athena',
      '',
    )
    expect(work).toEqual({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'athena',
      url: 'https://whoa.me/work/athena',
      description: 'CMS',
      codeRepository: 'https://github.com/a/athena',
      programmingLanguage: ['TypeScript'],
    })
  })

  test('TC-U-24 JSON-LD cannot close its script element', () => {
    expect(jsonLdScript({ name: '</script><script>alert(1)</script>' })).not.toContain('</script')
  })
})

describe('home title', () => {
  test('TC-U-25 home title is "site — tagline", or the site name alone', () => {
    expect(homeTitle('whoa.me', 'notes on building for the web')).toBe('whoa.me — notes on building for the web')
    expect(homeTitle('whoa.me', '  ')).toBe('whoa.me')
    expect(homeTitle('whoa.me', null)).toBe('whoa.me')
  })
})
