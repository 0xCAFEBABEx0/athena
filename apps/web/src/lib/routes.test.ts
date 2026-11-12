import { describe, expect, test } from 'bun:test'

import { currentRoute, ROUTES } from '@athena/shared/constants'

import { linkHref } from './links'

describe('TC-U-45 renamed sections', () => {
  test('old section paths map to the new routes; other paths stay', () => {
    expect(ROUTES).toEqual({
      posts: '/notes',
      work: '/builds',
      stack: '/stacks',
      about: '/about',
    })
    expect(currentRoute('/posts')).toBe('/notes')
    expect(currentRoute('/posts/hello')).toBe('/notes/hello')
    expect(currentRoute('/posts/page/2')).toBe('/notes/page/2')
    expect(currentRoute('/work/my.app')).toBe('/builds/my.app')
    expect(currentRoute('/stack')).toBe('/stacks')
    expect(currentRoute('/stack?x=1')).toBe('/stacks?x=1')
    for (const path of [
      '/',
      '/notes',
      '/postscript',
      '/posts-sitemap.xml',
      '/about',
      '/workshop/x',
    ]) {
      expect(currentRoute(path)).toBe(path)
    }
  })

  test('CMS links: post references and old typed paths point at the new routes', () => {
    expect(
      linkHref(
        { type: 'reference', reference: { relationTo: 'posts', value: { slug: 'hi' } as never } },
        'ja',
      ),
    ).toBe('/ja/notes/hi')
    expect(
      linkHref({
        type: 'reference',
        reference: { relationTo: 'pages', value: { slug: 'about' } as never },
      }),
    ).toBe('/about')
    expect(linkHref({ type: 'custom', url: '/posts' })).toBe('/notes')
    expect(linkHref({ type: 'custom', url: '/work' }, 'zh')).toBe('/zh/builds')
    expect(linkHref({ type: 'custom', url: '/stack' })).toBe('/stacks')
    expect(linkHref({ type: 'custom', url: 'https://example.com/posts' })).toBe(
      'https://example.com/posts',
    )
  })
})
