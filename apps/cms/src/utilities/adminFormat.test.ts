import { describe, expect, test } from 'bun:test'
import { publishState, thumbnailURL, timeAgo } from './adminFormat'

describe('timeAgo', () => {
  const now = Date.parse('2026-11-13T12:00:00Z')
  test('seconds, minutes, hours, days', () => {
    expect(timeAgo('2026-11-13T11:59:59Z', now)).toBe('1 second ago')
    expect(timeAgo('2026-11-13T11:57:00Z', now)).toBe('3 minutes ago')
    expect(timeAgo('2026-11-13T10:00:00Z', now)).toBe('2 hours ago')
    expect(timeAgo('2026-11-10T12:00:00Z', now)).toBe('3 days ago')
  })
  test('years', () => {
    expect(timeAgo('2024-11-13T12:00:00Z', now)).toBe('2 years ago')
  })
  test('empty or invalid input', () => {
    expect(timeAgo(undefined, now)).toBe('')
    expect(timeAgo('not a date', now)).toBe('')
  })
})

describe('thumbnailURL', () => {
  test('prefers Payload 4 variants, then Payload 3 sizes, then the original', () => {
    expect(thumbnailURL({ url: '/o.webp', variants: { thumbnail: { url: '/v.webp' } } })).toBe('/v.webp')
    expect(thumbnailURL({ url: '/o.webp', sizes: { thumbnail: { url: '/s.webp' } } })).toBe('/s.webp')
    expect(thumbnailURL({ url: '/o.webp', sizes: { thumbnail: { url: null } } })).toBe('/o.webp')
  })
  test('ids and empty values have no thumbnail', () => {
    expect(thumbnailURL(12)).toBeUndefined()
    expect(thumbnailURL(null)).toBeUndefined()
    expect(thumbnailURL({})).toBeUndefined()
  })
})

test('publishState', () => {
  expect(publishState('draft')).toBe('draft')
  expect(publishState('published')).toBe('published')
  expect(publishState(undefined)).toBe('published')
})
