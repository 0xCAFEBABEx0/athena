import { describe, expect, test } from 'bun:test'

import { buildMeta, DEFAULT_OG_IMAGE, routeMeta } from './seo'

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
