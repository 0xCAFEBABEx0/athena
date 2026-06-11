import type { AstroCookies } from 'astro'

import { DRAFT_COOKIE } from '@athena/shared/constants'

/** Whether the request carries the draft-mode cookie set by /api/preview. */
export const isDraft = (cookies: AstroCookies): boolean => cookies.has(DRAFT_COOKIE)

export const enableDraft = (cookies: AstroCookies): void => {
  cookies.set(DRAFT_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
  })
}

export const disableDraft = (cookies: AstroCookies): void => {
  cookies.delete(DRAFT_COOKIE, { path: '/' })
}
