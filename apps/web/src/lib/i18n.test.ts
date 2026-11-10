import { describe, expect, test } from 'bun:test'

import { dict, LOCALES, localizePath, splitLocale } from './i18n'

describe('splitLocale', () => {
  test('English paths have no prefix', () => {
    expect(splitLocale('/')).toEqual({ locale: 'en', path: '/' })
    expect(splitLocale('/posts/x')).toEqual({ locale: 'en', path: '/posts/x' })
  })

  test('strips a known locale prefix', () => {
    expect(splitLocale('/ja')).toEqual({ locale: 'ja', path: '/' })
    expect(splitLocale('/zh/posts/x')).toEqual({ locale: 'zh', path: '/posts/x' })
  })

  test('drops a trailing slash', () => {
    expect(splitLocale('/ja/posts/x/')).toEqual({ locale: 'ja', path: '/posts/x' })
    expect(splitLocale('/search/')).toEqual({ locale: 'en', path: '/search' })
    expect(splitLocale('/ja/')).toEqual({ locale: 'ja', path: '/' })
  })

  test('leaves /en and unknown two-letter segments alone', () => {
    expect(splitLocale('/en/posts')).toEqual({ locale: 'en', path: '/en/posts' })
    expect(splitLocale('/fr/posts')).toEqual({ locale: 'en', path: '/fr/posts' })
  })
})

describe('localizePath', () => {
  test('prefixes internal paths', () => {
    expect(localizePath('ja', '/')).toBe('/ja')
    expect(localizePath('zh', '/posts')).toBe('/zh/posts')
    expect(localizePath('en', '/posts')).toBe('/posts')
  })

  test('re-prefixes an already localized path', () => {
    expect(localizePath('zh', '/ja/posts')).toBe('/zh/posts')
    expect(localizePath('en', '/ja/posts')).toBe('/posts')
  })

  test('keeps external and protocol-relative URLs', () => {
    expect(localizePath('ja', 'https://example.com/x')).toBe('https://example.com/x')
    expect(localizePath('ja', '//example.com/x')).toBe('//example.com/x')
  })
})

test('every locale has every UI string', () => {
  const keys = Object.keys(dict('en')).sort()
  for (const locale of LOCALES) expect(Object.keys(dict(locale)).sort()).toEqual(keys)
})
