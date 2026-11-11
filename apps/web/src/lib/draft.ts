import { timingSafeEqual } from 'node:crypto'

import type { AstroCookies } from 'astro'

import { DRAFT_COOKIE } from '@athena/shared/constants'

import { env } from '@/lib/env'
import { isrBypassToken } from '@/lib/isr-bypass.mjs'

/**
 * Vercel serves ISR-cached pages without running our code unless the request
 * carries this cookie set to the adapter's `bypassToken` (see
 * lib/isr-bypass.mjs). Draft mode sets it so editors see fresh renders.
 */
const PRERENDER_BYPASS_COOKIE = '__prerender_bypass'

/**
 * Whether the request is in draft mode. The draft cookie alone is not proof
 * (anyone can set `athena-draft=1` in their browser): the request must also
 * carry the bypass cookie /api/preview set after checking PREVIEW_SECRET,
 * whose value cannot be guessed. Without REVALIDATE_SECRET (local dev) the
 * draft cookie is enough.
 */
export const isDraft = (cookies: AstroCookies): boolean => {
  if (!cookies.has(DRAFT_COOKIE)) return false
  const expected = isrBypassToken(env('REVALIDATE_SECRET'))
  if (!expected) return !import.meta.env.PROD
  const given = cookies.get(PRERENDER_BYPASS_COOKIE)?.value ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const enableDraft = (cookies: AstroCookies): void => {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
  } as const
  cookies.set(DRAFT_COOKIE, '1', options)
  const bypassToken = isrBypassToken(env('REVALIDATE_SECRET'))
  if (bypassToken) cookies.set(PRERENDER_BYPASS_COOKIE, bypassToken, options)
}

export const disableDraft = (cookies: AstroCookies): void => {
  cookies.delete(DRAFT_COOKIE, { path: '/' })
  cookies.delete(PRERENDER_BYPASS_COOKIE, { path: '/' })
}
