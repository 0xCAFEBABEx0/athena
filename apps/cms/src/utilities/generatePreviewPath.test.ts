import { describe, expect, test } from 'bun:test'

import { generatePreviewPath } from './generatePreviewPath'

const pathOf = (url: string) => new URL(url).searchParams.get('path')

describe('generatePreviewPath', () => {
  test('English stays unprefixed', () => {
    expect(
      pathOf(generatePreviewPath({ collection: 'posts', slug: 'hello', req: { locale: 'en' } })),
    ).toBe('/posts/hello')
    expect(pathOf(generatePreviewPath({ collection: 'pages', slug: 'about', req: {} }))).toBe(
      '/about',
    )
  })

  test('the edited translation keeps its locale prefix', () => {
    expect(
      pathOf(generatePreviewPath({ collection: 'posts', slug: 'hello', req: { locale: 'ja' } })),
    ).toBe('/ja/posts/hello')
    expect(
      pathOf(generatePreviewPath({ collection: 'pages', slug: 'about', req: { locale: 'zh' } })),
    ).toBe('/zh/about')
  })

  test('an unknown locale falls back to English', () => {
    expect(
      pathOf(generatePreviewPath({ collection: 'posts', slug: 'hello', req: { locale: 'all' } })),
    ).toBe('/posts/hello')
  })
})
