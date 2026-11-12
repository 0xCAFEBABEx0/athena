import type { GlobalBeforeChangeHook, Payload } from 'payload'

/**
 * GitHub contribution calendar for the home page (Site global → GitHub).
 *
 * The CMS reads the last year of a user's public contribution calendar with
 * one GraphQL request (GITHUB_TOKEN, as for /builds) when the username is
 * saved and then every 6 hours in the syncGitHub job, and stores it on the
 * Site global. Visitors' browsers never contact GitHub.
 */

/** A user's calendar, compact: one entry per day from `start`, oldest first. */
export type ContributionCalendar = {
  login: string
  total: number
  /** First day shown, `YYYY-MM-DD` (GitHub's calendar starts on a Sunday). */
  start: string
  /** Contributions per day. */
  counts: number[]
  /** GitHub's own shade per day: 0 (none) to 4 (most). */
  levels: number[]
}

export type ContributionsResult =
  { ok: true; calendar: ContributionCalendar } | { ok: false; error: string }

/** GitHub usernames: letters, digits and single hyphens, at most 39 characters. */
export const isGitHubLogin = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(value)

const LEVELS: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
}

const QUERY = `query ($login: String!) {
  user(login: $login) {
    login
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`

type Day = { date: string; contributionCount: number; contributionLevel: string }
type Response = {
  data?: {
    user?: {
      login: string
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number
          weeks: { contributionDays: Day[] }[]
        }
      }
    } | null
  } | null
  /** GraphQL errors (bad token scope, rate limit, ...) come with a 200. */
  errors?: { type?: string; message?: string }[] | null
}

/** The calendar from GitHub's answer, or null when it is not one. */
export const toCalendar = (body: Response): ContributionCalendar | null => {
  const user = body.data?.user
  const calendar = user?.contributionsCollection?.contributionCalendar
  if (!user || !calendar) return null
  const days = calendar.weeks.flatMap((week) => week.contributionDays)
  const first = days[0]
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first.date)) return null
  return {
    login: user.login,
    total: calendar.totalContributions,
    start: first.date,
    counts: days.map((day) => Math.max(0, Math.trunc(day.contributionCount) || 0)),
    levels: days.map((day) => LEVELS[day.contributionLevel] ?? 0),
  }
}

/** The user's calendar for the last year. Never throws. */
export const fetchContributions = async (
  login: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<ContributionsResult> => {
  if (!isGitHubLogin(login)) return { ok: false, error: 'Not a GitHub username.' }
  const token = process.env.GITHUB_TOKEN
  if (!token) return { ok: false, error: 'GITHUB_TOKEN is not set.' }
  try {
    const res = await fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'athena-cms',
      },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { ok: false, error: `GitHub API ${res.status}` }
    const body = (await res.json()) as Response
    const calendar = toCalendar(body)
    if (calendar) return { ok: true, calendar }
    // A missing user also comes back as an error (type NOT_FOUND); anything
    // else is a problem with the token or the API, not with the name.
    const errorTypes = (body.errors ?? []).map((error) => error.type ?? 'ERROR')
    if (errorTypes.some((type) => type !== 'NOT_FOUND')) {
      return { ok: false, error: `GitHub API error: ${[...new Set(errorTypes)].join(', ')}` }
    }
    return { ok: false, error: 'GitHub user not found.' }
  } catch (error) {
    return { ok: false, error: `GitHub API: ${String(error)}` }
  }
}

type GitHubGroup = {
  username?: string | null
  contributions?: ContributionCalendar | null
  syncedAt?: string | null
  syncError?: string | null
}

/**
 * Site beforeChange: reads the calendar when the username is new or changed
 * (or no calendar is stored yet), and clears it when the username is removed.
 * A failed read does not block the save: the error is shown under the field
 * and the next sync tries again.
 */
export const fillContributions =
  (
    lookup: (login: string) => Promise<ContributionsResult> = (login) => fetchContributions(login),
  ): GlobalBeforeChangeHook =>
  async ({ data, originalDoc, context }) => {
    if (context?.skipContributionsFetch) return data
    const group = (data as { github?: GitHubGroup | null }).github
    if (!group) return data
    const login = group.username?.trim() ?? ''
    if (!login) {
      return { ...data, github: { ...group, username: null, contributions: null, syncError: null } }
    }
    const before = (originalDoc as { github?: GitHubGroup | null } | undefined)?.github
    const stored = group.contributions ?? before?.contributions ?? null
    const same = before?.username?.trim().toLowerCase() === login.toLowerCase()
    if (same && stored?.login?.toLowerCase() === login.toLowerCase()) return data

    const result = await lookup(login)
    return {
      ...data,
      github: result.ok
        ? {
            ...group,
            username: login,
            contributions: result.calendar,
            syncedAt: new Date().toISOString(),
            syncError: null,
          }
        : // Another user's calendar must not stay under the new name.
          { ...group, username: login, contributions: null, syncError: result.error },
    }
  }

/**
 * Field by field: Postgres stores json as jsonb, which reorders the keys, so
 * comparing JSON strings would see a change on every run.
 */
export const sameCalendar = (
  a: ContributionCalendar | null | undefined,
  b: ContributionCalendar | null | undefined,
): boolean =>
  Boolean(a && b) &&
  a?.login === b?.login &&
  a?.total === b?.total &&
  a?.start === b?.start &&
  String(a?.counts) === String(b?.counts) &&
  String(a?.levels) === String(b?.levels)

/**
 * Scheduled task body: refresh the calendar and save the Site global only
 * when it changed (its afterChange hook then invalidates the home page).
 */
export async function syncContributions(
  payload: Payload,
  lookup: (login: string) => Promise<ContributionsResult> = (login) => fetchContributions(login),
): Promise<{ checked: boolean; updated: boolean }> {
  const site = (await payload.findGlobal({ slug: 'site', depth: 0, overrideAccess: true })) as {
    github?: GitHubGroup | null
  }
  const login = site.github?.username?.trim()
  if (!login) return { checked: false, updated: false }
  const result = await lookup(login)
  const before = site.github ?? {}
  const next: GitHubGroup = result.ok
    ? { ...before, contributions: result.calendar, syncError: null }
    : { ...before, syncError: result.error }
  const changed = result.ok
    ? !sameCalendar(before.contributions, result.calendar) || Boolean(before.syncError)
    : before.syncError !== result.error
  if (!changed) return { checked: true, updated: false }
  // The lookup can take seconds: if the username was changed meanwhile, the
  // save that changed it already read the new user's calendar. Writing this
  // group now would put the old name back.
  const current = (await payload.findGlobal({ slug: 'site', depth: 0, overrideAccess: true })) as {
    github?: GitHubGroup | null
  }
  if (current.github?.username?.trim() !== login) return { checked: true, updated: false }
  await payload.updateGlobal({
    slug: 'site',
    // syncedAt is the last successful read; a failure only records its error.
    data: { github: result.ok ? { ...next, syncedAt: new Date().toISOString() } : next },
    depth: 0,
    overrideAccess: true,
    context: { skipContributionsFetch: true },
  })
  payload.logger.info(`GitHub contributions: updated for ${login}`)
  return { checked: true, updated: true }
}
