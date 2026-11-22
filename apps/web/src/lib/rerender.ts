import { type Locale, splitLocale } from '@/lib/i18n'

/**
 * Paths /api/invalidate re-renders after a CMS change, in lanes: one per
 * language, each lane in the order given.
 *
 * Every page of one language reads the same layout data from the CMS (site,
 * header, footer, recent posts, builds, redirects). Rendered one after
 * another, the first page of a lane reads it and the next ones take it from
 * the Runtime Cache (lib/cms-cache.ts), and the CMS answers from an instance
 * that is already running. Rendered all at once (before 2026-11-22), every
 * page read all of it, so one saved build made ~60 CMS calls in the same
 * second, each a cold start of Payload on its own instance: that burst, four
 * times a day from the GitHub sync, used most of the Fluid Active CPU.
 */
export const rerenderLanes = (paths: string[]): string[][] => {
  const lanes = new Map<Locale, string[]>()
  for (const path of paths) {
    const { locale } = splitLocale(path)
    const lane = lanes.get(locale)
    if (lane) lane.push(path)
    else lanes.set(locale, [path])
  }
  return [...lanes.values()]
}

/**
 * Time /api/invalidate gives a whole run, counted from when it starts (the
 * cache expiry included): the CMS stops waiting after 25 s, and the answer
 * naming the failed paths must reach it before that.
 */
export const RERENDER_BUDGET_MS = 20_000

/**
 * Re-render `paths` with `render` (true when done), the lanes side by side
 * and each lane one path at a time. Everything ends within `budgetMs`: each
 * render gets at most the time left (`render`'s second argument, in ms), and
 * paths not started in time are reported as failed without being requested.
 * They are already marked stale, so their next visitor re-renders them, and
 * the CMS stops waiting for this call after 25 s. Returns the paths that
 * failed.
 */
export const rerenderInLanes = async (
  paths: string[],
  render: (path: string, timeLeftMs: number) => Promise<boolean>,
  budgetMs = RERENDER_BUDGET_MS,
  now: () => number = Date.now,
): Promise<string[]> => {
  const deadline = now() + budgetMs
  const failed: string[] = []
  await Promise.all(
    rerenderLanes(paths).map(async (lane) => {
      for (const path of lane) {
        const left = deadline - now()
        if (left <= 0) {
          failed.push(path)
          continue
        }
        const ok = await render(path, left).catch(() => false)
        if (!ok) failed.push(path)
      }
    }),
  )
  return failed
}
