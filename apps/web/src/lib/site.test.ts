import { describe, expect, test } from 'bun:test'

import { normalizeSite } from './site'

describe('normalizeSite', () => {
  test('TC-U-10 defaults when the CMS is empty or unreachable', () => {
    const site = normalizeSite(null)
    expect(site.siteName).toBe('whoa.me')
    expect(site.ogImage).toBeNull()
    expect(site.tagline).toBe('')
    expect(normalizeSite({ tagline: '  notes  ' }).tagline).toBe('notes')
    expect(site.banner).toEqual({ style: 'fetch', mascot: true, tips: [] })
  })

  test('TC-U-11 ogImage prefers the og rendition and makes it absolute', () => {
    process.env.CMS_URL = 'https://cms.example'
    const site = normalizeSite({
      ogImage: { id: 1, url: '/api/media/file/a.png', sizes: { og: { url: '/api/media/file/a-og.png' } } } as never,
    })
    expect(site.ogImage).toBe('https://cms.example/api/media/file/a-og.png')
    expect(normalizeSite({ ogImage: { id: 2, url: 'https://blob.example/b.png' } as never }).ogImage).toBe(
      'https://blob.example/b.png',
    )
    // An unpopulated id (depth 0) is not an image.
    expect(normalizeSite({ ogImage: 3 }).ogImage).toBeNull()
  })

  test('TC-U-12 banner settings: off, no owl, trimmed tips', () => {
    const site = normalizeSite({ banner: { style: 'off', mascot: false, tips: [{ text: ' hi ' }, { text: '' }] } } as never)
    expect(site.banner).toEqual({ style: 'off', mascot: false, tips: ['hi'] })
  })
})
