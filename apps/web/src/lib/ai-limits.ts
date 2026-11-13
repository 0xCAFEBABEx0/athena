import { bumpCounter } from './cms-cache'
import { env } from './env'

/**
 * Spending limits for the AI endpoints. Every uncached question costs a
 * Claude request and an embedding request, and wakes the Neon database for
 * five minutes (Neon Free has 100 CU-hours a month), so both a single
 * visitor and the whole site are capped. Cached answers do not count.
 *
 * - Per visitor: PER_VISITOR requests per WINDOW_MS on one function instance
 *   (in memory; a determined client can spread over instances, which the
 *   daily cap still bounds).
 * - Per day: AI_DAILY_LIMIT uncached requests for the whole site (default
 *   200), counted in the Runtime Cache.
 */

const WINDOW_MS = 10 * 60 * 1000
const PER_VISITOR = 10
const DEFAULT_DAILY = 200

const recent = new Map<string, number[]>()

/** False when `visitor` used up its requests in the last ten minutes. */
export const allowVisitor = (visitor: string, now = Date.now()): boolean => {
  const since = now - WINDOW_MS
  const times = (recent.get(visitor) ?? []).filter((time) => time > since)
  if (times.length >= PER_VISITOR) {
    recent.set(visitor, times)
    return false
  }
  times.push(now)
  recent.set(visitor, times)
  // Keep the map small on a long-lived instance.
  if (recent.size > 5_000) {
    for (const [key, list] of recent) if (!list.some((time) => time > since)) recent.delete(key)
  }
  return true
}

export const dailyLimit = (): number => {
  const raw = env('AI_DAILY_LIMIT')?.trim()
  if (!raw) return DEFAULT_DAILY
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_DAILY
}

/** Count one uncached AI request today (UTC); false once the day's budget is spent. */
export const allowToday = async (now = new Date()): Promise<boolean> => {
  const day = now.toISOString().slice(0, 10)
  const used = await bumpCounter(`ai:daily:${day}`, 2 * 24 * 60 * 60)
  return used <= dailyLimit()
}

/** For tests. */
export const resetVisitorLimits = (): void => recent.clear()
