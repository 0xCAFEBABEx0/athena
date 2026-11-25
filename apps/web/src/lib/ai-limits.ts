import { bumpCounter, type CmsCacheStore, runtimeCache } from './cms-cache'
import { env } from './env'

/**
 * Spending limits for the AI endpoints. Every uncached question costs a
 * Claude request and an embedding request, and wakes the Neon database for
 * five minutes (Neon Free has 100 CU-hours a month), so both a single
 * visitor and the whole site are capped. Cached answers do not count.
 *
 * - Per visitor: PER_VISITOR requests per WINDOW_SECONDS, and at most a tenth
 *   of the daily budget per UTC day, so one client cannot spend the budget
 *   for everyone. A visitor is an IPv4 address or an IPv6 /64.
 * - Per day: AI_DAILY_LIMIT uncached requests for the whole site (default
 *   100).
 *
 * All counts live in the Runtime Cache, shared by every function instance.
 * If a count cannot be read or written, or the cache is missing on Vercel,
 * the request is refused (fails closed). Check the visitor first, so a
 * refused visitor does not move the daily count.
 */

const WINDOW_SECONDS = 10 * 60
const PER_VISITOR = 10
const VISITOR_SHARE = 0.1
const DEFAULT_DAILY = 100
const DAY_TTL = 2 * 24 * 60 * 60

export const dailyLimit = (): number => {
  const raw = env('AI_DAILY_LIMIT')?.trim()
  if (!raw) return DEFAULT_DAILY
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_DAILY
}

/** Uncached requests one visitor may make per UTC day: a tenth of the site's, at least one. */
export const visitorDailyLimit = (daily = dailyLimit()): number =>
  daily === 0 ? 0 : Math.max(1, Math.ceil(daily * VISITOR_SHARE))

const expandIpv6 = (address: string): string[] | null => {
  const halves = address.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  return groups.every((group) => /^[0-9a-f]{1,4}$/.test(group)) ? groups : null
}

/**
 * The key one visitor is counted under: an IPv4 address as is (also when
 * written IPv4-mapped), an IPv6 address by its /64, since one connection
 * usually gets a whole /64 to pick addresses from.
 */
export const visitorKey = (address: string): string => {
  const value = address.trim().toLowerCase().replace(/%.*$/, '')
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value)
  if (mapped?.[1]) return mapped[1]
  if (!value.includes(':')) return value
  const groups = expandIpv6(value)
  if (!groups) return value
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group, 16).toString(16))
    .join(':')}::/64`
}

/** Count one uncached AI request for `visitor`; false once it used up its share. */
export const allowVisitor = async (
  visitor: string,
  now = new Date(),
  store: CmsCacheStore | null = runtimeCache(),
): Promise<boolean> => {
  if (!store && process.env.VERCEL) return false
  const key = visitorKey(visitor)
  const day = now.toISOString().slice(0, 10)
  const window = Math.floor(now.getTime() / (WINDOW_SECONDS * 1000))
  // A request refused by the ten-minute window does not use up the day's share.
  const recent = await bumpCounter(`ai:visitor:${window}:${key}`, 2 * WINDOW_SECONDS, 1, store)
  if (recent > PER_VISITOR) return false
  const today = await bumpCounter(`ai:visitor-daily:${day}:${key}`, DAY_TTL, 1, store)
  return today <= visitorDailyLimit()
}

/** Count one uncached AI request today (UTC); false once the day's budget is spent. */
export const allowToday = async (
  now = new Date(),
  store: CmsCacheStore | null = runtimeCache(),
): Promise<boolean> => {
  const day = now.toISOString().slice(0, 10)
  // On Vercel without the shared cache, a count per instance would allow
  // the daily budget on every instance: refuse instead (fails closed).
  if (!store && process.env.VERCEL) return false
  const used = await bumpCounter(`ai:daily:${day}`, DAY_TTL, 1, store)
  return used <= dailyLimit()
}
