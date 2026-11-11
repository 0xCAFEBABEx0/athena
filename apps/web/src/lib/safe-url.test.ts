import { describe, expect, test } from 'bun:test'

import { httpUrl, isLocalPath, safeHref } from './safe-url'

describe('TC-U-33 link and redirect guards', () => {
  test('safeHref keeps web, mail, phone and on-site links', () => {
    for (const ok of [
      'https://x.com/a',
      'HTTP://example.com',
      'mailto:a@example.com',
      'tel:+81',
      '/posts',
      '/ja/work?x=1',
      '#top',
    ]) {
      expect(safeHref(` ${ok} `)).toBe(ok)
    }
  })

  test('safeHref drops script, data and other schemes, and control characters', () => {
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,x',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.example',
      '/\\evil.example',
      'example.com',
      '',
      null,
      undefined,
    ]) {
      expect(safeHref(bad)).toBeNull()
    }
  })

  test('httpUrl accepts only absolute http(s) URLs', () => {
    expect(httpUrl('https://whoa.me')).toBe('https://whoa.me')
    expect(httpUrl('/work')).toBeNull()
    expect(httpUrl('mailto:a@example.com')).toBeNull()
    expect(httpUrl('javascript:alert(1)')).toBeNull()
  })

  test('isLocalPath refuses anything a browser could read as another site', () => {
    for (const ok of ['/', '/posts/a', '/ja?x=1#y']) expect(isLocalPath(ok)).toBe(true)
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      '/a\\b',
      'https://evil.example',
      'posts',
      '',
      null,
      undefined,
      '/a\nb',
    ]) {
      expect(isLocalPath(bad)).toBe(false)
    }
  })
})
