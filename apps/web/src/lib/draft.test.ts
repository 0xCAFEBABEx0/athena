import { afterEach, describe, expect, test } from 'bun:test'

import type { AstroCookies } from 'astro'

import { isDraft } from './draft'
import { isrBypassToken } from './isr-bypass.mjs'

const jar = (values: Record<string, string>) =>
  ({
    has: (name: string) => name in values,
    get: (name: string) => (name in values ? { value: values[name] } : undefined),
  }) as unknown as AstroCookies

const saved = process.env.REVALIDATE_SECRET
afterEach(() => {
  if (saved === undefined) delete process.env.REVALIDATE_SECRET
  else process.env.REVALIDATE_SECRET = saved
})

describe('TC-U-34 draft mode', () => {
  test('the draft cookie alone does not turn on drafts', () => {
    process.env.REVALIDATE_SECRET = 's3cret'
    expect(isDraft(jar({ 'athena-draft': '1' }))).toBe(false)
    expect(isDraft(jar({ 'athena-draft': '1', __prerender_bypass: 'guess' }))).toBe(false)
    expect(isDraft(jar({ __prerender_bypass: isrBypassToken('s3cret') ?? '' }))).toBe(false)
  })

  test('the cookies set by /api/preview turn it on', () => {
    process.env.REVALIDATE_SECRET = 's3cret'
    expect(
      isDraft(jar({ 'athena-draft': '1', __prerender_bypass: isrBypassToken('s3cret') ?? '' })),
    ).toBe(true)
  })
})
