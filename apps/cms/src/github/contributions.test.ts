import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { Payload } from 'payload'

import {
  type ContributionCalendar,
  type ContributionsResult,
  fetchContributions,
  fillContributions,
  isGitHubLogin,
  syncContributions,
  toCalendar,
} from './contributions'

const day = (date: string, contributionCount: number, contributionLevel: string) => ({
  date,
  contributionCount,
  contributionLevel,
})

const answer = {
  data: {
    user: {
      login: 'Octocat',
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 7,
          weeks: [
            {
              contributionDays: [
                day('2025-11-09', 0, 'NONE'),
                day('2025-11-10', 1, 'FIRST_QUARTILE'),
              ],
            },
            {
              contributionDays: [
                day('2025-11-16', 2, 'SECOND_QUARTILE'),
                day('2025-11-17', 4, 'FOURTH_QUARTILE'),
                day('2025-11-18', 0, 'SOMETHING_NEW'),
              ],
            },
          ],
        },
      },
    },
  },
}

const calendar = (login: string, total = 7): ContributionCalendar => ({
  login,
  total,
  start: '2025-11-09',
  counts: [0, 1, 2, 4, 0],
  levels: [0, 1, 2, 4, 0],
})

describe('TC-U-46 GitHub contributions: reading the calendar', () => {
  const token = process.env.GITHUB_TOKEN
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token'
  })
  afterEach(() => {
    process.env.GITHUB_TOKEN = token
  })

  test('usernames: letters, digits and single hyphens, up to 39 characters', () => {
    for (const ok of ['octocat', 'a', 'my-name', 'A1-b2', 'a'.repeat(39)]) {
      expect(isGitHubLogin(ok), ok).toBe(true)
    }
    for (const bad of [
      '',
      '-a',
      'a-',
      'a--b',
      '@octocat',
      'https://github.com/x',
      'a b',
      'a'.repeat(40),
      'a/b',
      null,
    ]) {
      expect(isGitHubLogin(bad), String(bad)).toBe(false)
    }
  })

  test('the calendar is flattened day by day; unknown shades count as none', () => {
    expect(toCalendar(answer)).toEqual({
      login: 'Octocat',
      total: 7,
      start: '2025-11-09',
      counts: [0, 1, 2, 4, 0],
      levels: [0, 1, 2, 4, 0],
    })
    expect(toCalendar({ data: { user: null } })).toBeNull()
    expect(toCalendar({})).toBeNull()
  })

  test('one GraphQL request with the login as a variable and the token', async () => {
    const seen: { url: string; init: RequestInit }[] = []
    const result = await fetchContributions('octocat', (async (url: string, init: RequestInit) => {
      seen.push({ url, init })
      return Response.json(answer)
    }) as unknown as typeof fetch)
    expect(result).toEqual({ ok: true, calendar: calendar('Octocat') })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe('https://api.github.com/graphql')
    expect((seen[0]?.init.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer test-token',
    )
    const body = JSON.parse(String(seen[0]?.init.body))
    expect(body.variables).toEqual({ login: 'octocat' })
    expect(body.query).not.toContain('octocat')
  })

  test('errors come back as messages, never thrown; nothing is sent for a bad name or no token', async () => {
    let calls = 0
    const counting = (respond: () => Response | Promise<Response>) =>
      (async () => {
        calls += 1
        return respond()
      }) as unknown as typeof fetch
    expect(
      await fetchContributions(
        'a b',
        counting(() => Response.json(answer)),
      ),
    ).toEqual({
      ok: false,
      error: 'Not a GitHub username.',
    })
    expect(calls).toBe(0)
    expect(
      await fetchContributions(
        'octocat',
        counting(() => new Response('', { status: 502 })),
      ),
    ).toEqual({
      ok: false,
      error: 'GitHub API 502',
    })
    expect(
      await fetchContributions(
        'ghost',
        counting(() => Response.json({ data: { user: null } })),
      ),
    ).toEqual({
      ok: false,
      error: 'GitHub user not found.',
    })
    // GitHub reports a missing user as a NOT_FOUND error too.
    expect(
      await fetchContributions(
        'ghost',
        counting(() =>
          Response.json({ data: { user: null }, errors: [{ type: 'NOT_FOUND', message: 'x' }] }),
        ),
      ),
    ).toEqual({ ok: false, error: 'GitHub user not found.' })
    // Any other GraphQL error (token scope, rate limit) is not "not found".
    expect(
      await fetchContributions(
        'octocat',
        counting(() =>
          Response.json({
            data: null,
            errors: [{ type: 'RATE_LIMITED', message: 'secret detail' }, { type: 'RATE_LIMITED' }],
          }),
        ),
      ),
    ).toEqual({ ok: false, error: 'GitHub API error: RATE_LIMITED' })
    const failed = await fetchContributions(
      'octocat',
      counting(() => {
        throw new Error('offline')
      }),
    )
    expect(failed.ok).toBe(false)
    delete process.env.GITHUB_TOKEN
    calls = 0
    expect(
      await fetchContributions(
        'octocat',
        counting(() => Response.json(answer)),
      ),
    ).toEqual({
      ok: false,
      error: 'GITHUB_TOKEN is not set.',
    })
    expect(calls).toBe(0)
  })
})

describe('TC-U-47 GitHub contributions: Site save and the 6-hourly sync', () => {
  const run = async (
    github: Record<string, unknown> | null,
    before: Record<string, unknown> | null,
    result: ContributionsResult = { ok: true, calendar: calendar('octocat') },
    context: Record<string, unknown> = {},
  ) => {
    const asked: string[] = []
    const hook = fillContributions(async (login) => {
      asked.push(login)
      return result
    })
    const out = (await hook({
      data: { siteName: 'x', github },
      originalDoc: { github: before },
      context,
    } as never)) as { siteName: string; github: Record<string, unknown> | null }
    return { out, asked }
  }

  test('a new username is read on save', async () => {
    const { out, asked } = await run({ username: ' octocat ' }, null)
    expect(asked).toEqual(['octocat'])
    expect(out.siteName).toBe('x')
    expect(out.github?.username).toBe('octocat')
    expect(out.github?.contributions).toEqual(calendar('octocat'))
    expect(out.github?.syncError).toBeNull()
    expect(typeof out.github?.syncedAt).toBe('string')
  })

  test('an unchanged username with a stored calendar is not read again', async () => {
    const { out, asked } = await run(
      { username: 'octocat', contributions: calendar('octocat') },
      { username: 'octocat', contributions: calendar('octocat') },
    )
    expect(asked).toEqual([])
    expect(out.github?.contributions).toEqual(calendar('octocat'))
  })

  test("a changed username is read; when that fails the old user's calendar goes and the save still succeeds", async () => {
    const before = { username: 'octocat', contributions: calendar('octocat') }
    const moved = await run({ username: 'hubot', contributions: calendar('octocat') }, before, {
      ok: true,
      calendar: calendar('hubot'),
    })
    expect(moved.asked).toEqual(['hubot'])
    expect(moved.out.github?.contributions).toEqual(calendar('hubot'))

    const failed = await run({ username: 'hubot', contributions: calendar('octocat') }, before, {
      ok: false,
      error: 'GitHub user not found.',
    })
    expect(failed.out.github?.contributions).toBeNull()
    expect(failed.out.github?.syncError).toBe('GitHub user not found.')
  })

  test('an empty username hides the graph; the sync itself skips the hook', async () => {
    const cleared = await run(
      { username: '  ', contributions: calendar('octocat') },
      {
        username: 'octocat',
      },
    )
    expect(cleared.asked).toEqual([])
    expect(cleared.out.github).toMatchObject({
      username: null,
      contributions: null,
      syncError: null,
    })

    const fromSync = await run({ username: 'hubot' }, null, undefined, {
      skipContributionsFetch: true,
    })
    expect(fromSync.asked).toEqual([])
    expect(fromSync.out.github).toEqual({ username: 'hubot' })
  })

  const fakePayload = (github: Record<string, unknown> | null) => {
    const updates: { data: Record<string, unknown>; context?: Record<string, unknown> }[] = []
    const payload = {
      findGlobal: async () => ({ github }),
      updateGlobal: async (args: {
        data: Record<string, unknown>
        context?: Record<string, unknown>
      }) => {
        updates.push(args)
        return {}
      },
      logger: { info: () => {}, warn: () => {} },
    } as unknown as Payload
    return { payload, updates }
  }

  test('the sync saves only when the calendar or its error changed, and skips the save hook', async () => {
    // Stored as jsonb, the keys come back in another order: still the same calendar.
    const { counts, levels, start, total, login } = calendar('octocat')
    const same = fakePayload({
      username: 'octocat',
      contributions: { levels, counts, start, total, login },
    })
    expect(
      await syncContributions(same.payload, async () => ({
        ok: true,
        calendar: calendar('octocat'),
      })),
    ).toEqual({ checked: true, updated: false })
    expect(same.updates).toHaveLength(0)

    const grew = fakePayload({ username: 'octocat', contributions: calendar('octocat') })
    await syncContributions(grew.payload, async () => ({
      ok: true,
      calendar: calendar('octocat', 8),
    }))
    expect(grew.updates).toHaveLength(1)
    expect(grew.updates[0]?.context).toEqual({ skipContributionsFetch: true })
    expect(
      (grew.updates[0]?.data.github as { contributions: unknown } | undefined)?.contributions,
    ).toEqual(calendar('octocat', 8))

    // A failure keeps the last calendar and records the error once.
    const down = fakePayload({ username: 'octocat', contributions: calendar('octocat') })
    await syncContributions(down.payload, async () => ({ ok: false, error: 'GitHub API 502' }))
    expect(down.updates[0]?.data.github).toMatchObject({
      contributions: calendar('octocat'),
      syncError: 'GitHub API 502',
    })
    // syncedAt stays the time of the last successful read.
    expect(down.updates[0]?.data.github).not.toHaveProperty('syncedAt')
    expect(grew.updates[0]?.data.github).toHaveProperty('syncedAt')
    const stillDown = fakePayload({ username: 'octocat', syncError: 'GitHub API 502' })
    await syncContributions(stillDown.payload, async () => ({ ok: false, error: 'GitHub API 502' }))
    expect(stillDown.updates).toHaveLength(0)

    const none = fakePayload({ username: '' })
    let asked = 0
    expect(
      await syncContributions(none.payload, async () => {
        asked += 1
        return { ok: true, calendar: calendar('x') }
      }),
    ).toEqual({ checked: false, updated: false })
    expect(asked).toBe(0)
  })

  test('the sync writes nothing when the username changed during the lookup', async () => {
    const updates: unknown[] = []
    let reads = 0
    const payload = {
      findGlobal: async () => {
        reads += 1
        return { github: { username: reads === 1 ? 'octocat' : 'hubot' } }
      },
      updateGlobal: async (args: unknown) => {
        updates.push(args)
        return {}
      },
      logger: { info: () => {}, warn: () => {} },
    } as unknown as Payload
    expect(
      await syncContributions(payload, async () => ({ ok: true, calendar: calendar('octocat') })),
    ).toEqual({ checked: true, updated: false })
    expect(updates).toHaveLength(0)
  })
})
