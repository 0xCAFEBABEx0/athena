import { timingSafeEqual } from 'node:crypto'

/**
 * True when the request carries `Authorization: Bearer <REVALIDATE_SECRET>`,
 * the secret the CMS and the web app already share (see AGENTS.md). Used by
 * the web app's server-side calls to /api/ai/search and /api/ai/answers.
 */
export const isServerCaller = (request: Request, secret = process.env.REVALIDATE_SECRET): boolean => {
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
