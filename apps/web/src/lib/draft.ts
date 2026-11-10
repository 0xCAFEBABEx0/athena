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

/** Whether the request carries the draft-mode cookie set by /api/preview. */
export const isDraft = (cookies: AstroCookies): boolean => cookies.has(DRAFT_COOKIE)

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
