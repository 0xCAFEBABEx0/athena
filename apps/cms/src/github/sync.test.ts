import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { Payload } from 'payload'

import { type GitHubSnapshot, sameSnapshot, syncProjects } from './sync'

// A push yesterday keeps `activity` at 'working' whenever the test runs.
const PUSHED = new Date(Date.now() - 86_400_000).toISOString()

const snapshot = (overrides: Partial<GitHubSnapshot> = {}): GitHubSnapshot => ({
  description: 'A site',
  homepage: null,
  language: 'TypeScript',
  languages: [
    { name: 'TypeScript', share: 90 },
    { name: 'CSS', share: 10 },
  ],
  topics: ['astro', 'payload'],
  stars: 3,
  archived: false,
  createdAt: '2026-01-01T00:00:00Z',
  pushedAt: PUSHED,
  commitCount: 120,
  release: {
    tag: 'v1.7.0',
    date: '2026-11-17T14:33:00Z',
    url: 'https://github.com/o/r/releases/v1.7.0',
  },
  commits: [{ sha: 'abc1234', message: 'Fix', date: '2026-11-20T00:00:00Z' }],
  openPRs: 0,
  image: null,
  activity: 'working',
  ...overrides,
})

/** What Postgres jsonb gives back: shorter keys first, then by bytes, at every level. */
const asJsonb = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(asJsonb)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => [key, asJsonb(v)]),
  )
}

const repoNode = (snap: GitHubSnapshot) => ({
  isPrivate: false,
  isArchived: snap.archived,
  description: snap.description,
  homepageUrl: snap.homepage,
  stargazerCount: snap.stars,
  createdAt: snap.createdAt,
  pushedAt: snap.pushedAt,
  primaryLanguage: snap.language ? { name: snap.language } : null,
  languages: {
    totalSize: 100,
    edges: snap.languages.map((lang) => ({ size: lang.share, node: { name: lang.name } })),
  },
  repositoryTopics: { nodes: snap.topics.map((name) => ({ topic: { name } })) },
  latestRelease: snap.release
    ? { tagName: snap.release.tag, publishedAt: snap.release.date, url: snap.release.url }
    : null,
  pullRequests: { totalCount: snap.openPRs },
  openGraphImageUrl: null,
  usesCustomOpenGraphImage: false,
  defaultBranchRef: {
    target: {
      history: {
        totalCount: snap.commitCount,
        nodes: snap.commits.map((c) => ({
          oid: `${c.sha}000000`,
          messageHeadline: c.message,
          committedDate: c.date,
        })),
      },
    },
  },
})

describe('TC-U-65 GitHub sync of /builds: no write when nothing changed', () => {
  const realFetch = globalThis.fetch
  const realToken = process.env.GITHUB_TOKEN
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token'
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    if (realToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = realToken
  })

  test('a snapshot read back from jsonb with its keys reordered is the same snapshot', () => {
    expect(sameSnapshot(asJsonb(snapshot()), snapshot())).toBe(true)
    expect(JSON.stringify(asJsonb(snapshot()))).not.toBe(JSON.stringify(snapshot()))
    expect(sameSnapshot(asJsonb(snapshot()), snapshot({ openPRs: 1 }))).toBe(false)
    // Array order still counts: languages and commits are ordered lists.
    const swapped = snapshot()
    swapped.languages.reverse()
    expect(sameSnapshot(snapshot(), swapped)).toBe(false)
    expect(sameSnapshot(null, snapshot())).toBe(false)
  })

  const fakePayload = (docs: Record<string, unknown>[]) => {
    const updates: { id: unknown; data: Record<string, unknown>; context?: unknown }[] = []
    const payload = {
      find: async () => ({ docs }),
      update: async (args: { id: unknown; data: Record<string, unknown>; context?: unknown }) => {
        updates.push(args)
        return {}
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    } as unknown as Payload
    return { payload, updates }
  }

  const answerWith = (snaps: GitHubSnapshot[]) => {
    globalThis.fetch = (async () =>
      Response.json({
        data: Object.fromEntries(snaps.map((snap, i) => [`r${i}`, repoNode(snap)])),
      })) as unknown as typeof fetch
  }

  test('an unchanged repository stored as jsonb is not saved; a changed one is, once, skipping the fetch hook', async () => {
    const quiet = snapshot()
    const busy = snapshot({ openPRs: 2 })
    answerWith([quiet, busy])
    const { payload, updates } = fakePayload([
      { id: 1, repo: 'o/quiet', github: asJsonb(quiet), syncError: null },
      { id: 2, repo: 'o/busy', github: asJsonb(snapshot()), syncError: null },
    ])
    const result = await syncProjects(payload)
    expect(result).toEqual({ checked: 2, updated: 1 })
    expect(updates.map((u) => u.id)).toEqual([2])
    expect(updates[0]?.data.github).toMatchObject({ openPRs: 2 })
    expect(updates[0]?.context).toEqual({ skipGitHubFetch: true })
  })

  test('a stored error is cleared by a good read even when the snapshot is unchanged', async () => {
    answerWith([snapshot()])
    const { payload, updates } = fakePayload([
      { id: 1, repo: 'o/r', github: asJsonb(snapshot()), syncError: 'GitHub API 502' },
    ])
    expect(await syncProjects(payload)).toEqual({ checked: 1, updated: 1 })
    expect(updates[0]?.data.syncError).toBeNull()
  })
})
