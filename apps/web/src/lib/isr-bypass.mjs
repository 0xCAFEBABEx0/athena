import { createHash } from 'node:crypto'

/**
 * Vercel ISR bypass token, derived from REVALIDATE_SECRET so no extra env var
 * is needed. It goes into the `__prerender_bypass` cookie of editors in draft
 * preview, so it must not be the secret itself: the secret also authorizes
 * /api/invalidate. Plain JS because astro.config.mjs imports it at build time.
 *
 * @param {string | undefined} secret REVALIDATE_SECRET
 * @returns {string | undefined} 64 hex characters (Vercel needs at least 32)
 */
export const isrBypassToken = (secret) =>
  secret ? createHash('sha256').update(`isr-bypass:${secret}`).digest('hex') : undefined
