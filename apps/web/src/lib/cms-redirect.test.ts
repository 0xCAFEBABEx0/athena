import { describe, expect, test } from 'bun:test'

import type { Redirect } from '@athena/shared/payload-types'

import { cmsRedirectTarget } from './cms-redirect'

const entry = (from: string, to: Redirect['to']): Redirect => ({
  id: 1,
  from,
  to,
  updatedAt: '',
  createdAt: '',
})

const custom = (from: string, url: string) => entry(from, { type: 'custom', url })

describe('TC-U-70 CMS redirects', () => {
  test('a custom path on this site is used, with the locale prefix', () => {
    const redirects = [custom('/old', '/about')]
    expect(cmsRedirectTarget(redirects, '/old', 'en')).toBe('/about')
    expect(cmsRedirectTarget(redirects, '/old', 'ja')).toBe('/ja/about')
  })

  test('a reference is used, and an old section path also answers its new one', () => {
    const redirects = [
      entry('/posts/moved', {
        type: 'reference',
        reference: { relationTo: 'posts', value: { slug: 'hello' } as never },
      }),
    ]
    expect(cmsRedirectTarget(redirects, '/posts/moved', 'en')).toBe('/notes/hello')
    expect(cmsRedirectTarget(redirects, '/notes/moved', 'zh')).toBe('/zh/notes/hello')
  })

  test('a destination off this site gives no redirect', () => {
    for (const url of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'evil.example',
      '',
    ]) {
      for (const locale of ['en', 'ja'] as const) {
        expect(cmsRedirectTarget([custom('/old', url)], '/old', locale)).toBeNull()
      }
    }
    // A path on this site that turns into `//host` once its prefix is dropped.
    expect(cmsRedirectTarget([custom('/old', '/ja//evil.example')], '/old', 'en')).toBeNull()
  })

  test('no entry, or an entry without a destination, gives no redirect', () => {
    expect(cmsRedirectTarget([custom('/old', '/about')], '/other', 'en')).toBeNull()
    expect(cmsRedirectTarget([entry('/old', undefined)], '/old', 'en')).toBeNull()
  })
})
