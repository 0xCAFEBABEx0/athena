import type { Payload } from 'payload'

/**
 * GitHub data for the /work pages (the `projects` collection).
 *
 * One GraphQL request fetches every listed repository; a document is only
 * written (and the web cache only invalidated) when its snapshot changed, so
 * a quiet hour costs one GitHub call and no web re-render. The web app never
 * calls GitHub itself.
 */

/** Days without a push after which a repository is shown as idle. */
export const IDLE_AFTER_DAYS = 30

export type GitHubSnapshot = {
  description: string | null
  homepage: string | null
  language: string | null
  languages: { name: string; share: number }[]
  topics: string[]
  stars: number
  archived: boolean
  createdAt: string | null
  pushedAt: string | null
  commitCount: number
  release: { tag: string; date: string; url: string } | null
  commits: { sha: string; message: string; date: string }[]
  /** Open pull requests, shown as a small count beside the name. */
  openPRs: number
  /** The repository's social preview, only when one was uploaded (GitHub's generated card is skipped). */
  image: string | null
  /** working | idle | done, from activity (the CMS `status` field can override). */
  activity: 'working' | 'idle' | 'done'
}

export type FetchResult = { ok: true; snapshot: GitHubSnapshot } | { ok: false; error: string }

const REPO_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/

export const isRepoName = (value: unknown): value is string =>
  typeof value === 'string' && REPO_PATTERN.test(value)

const FIELDS = `
  isPrivate
  isArchived
  description
  homepageUrl
  stargazerCount
  createdAt
  pushedAt
  primaryLanguage { name }
  languages(first: 6, orderBy: { field: SIZE, direction: DESC }) { totalSize edges { size node { name } } }
  repositoryTopics(first: 10) { nodes { topic { name } } }
  latestRelease { tagName publishedAt url }
  pullRequests(states: OPEN) { totalCount }
  openGraphImageUrl
  usesCustomOpenGraphImage
  defaultBranchRef {
    target {
      ... on Commit {
        history(first: 5) { totalCount nodes { oid messageHeadline committedDate } }
      }
    }
  }
`

type RepoNode = {
  isPrivate: boolean
  isArchived: boolean
  description: string | null
  homepageUrl: string | null
  stargazerCount: number
  createdAt: string
  pushedAt: string | null
  primaryLanguage: { name: string } | null
  languages: { totalSize: number; edges: { size: number; node: { name: string } }[] }
  repositoryTopics: { nodes: { topic: { name: string } }[] }
  latestRelease: { tagName: string; publishedAt: string | null; url: string } | null
  pullRequests: { totalCount: number }
  openGraphImageUrl: string | null
  usesCustomOpenGraphImage: boolean
  defaultBranchRef: {
    target: {
      history?: {
        totalCount: number
        nodes: { oid: string; messageHeadline: string; committedDate: string }[]
      }
    } | null
  } | null
}

const activityOf = (node: RepoNode, now: number): GitHubSnapshot['activity'] => {
  if (node.isArchived) return 'done'
  const pushed = Date.parse(node.pushedAt ?? '')
  if (Number.isNaN(pushed)) return 'idle'
  return now - pushed < IDLE_AFTER_DAYS * 86_400_000 ? 'working' : 'idle'
}

const toSnapshot = (node: RepoNode, now: number): GitHubSnapshot => {
  const total = node.languages.totalSize || 0
  const languages = node.languages.edges
    .map((edge) => ({
      name: edge.node.name,
      share: total ? Math.round((edge.size / total) * 100) : 0,
    }))
    .filter((lang) => lang.share > 0)
  const history = node.defaultBranchRef?.target?.history
  return {
    description: node.description?.trim() || null,
    homepage: node.homepageUrl?.trim() || null,
    language: node.primaryLanguage?.name ?? null,
    languages,
    topics: node.repositoryTopics.nodes.map((n) => n.topic.name),
    stars: node.stargazerCount,
    archived: node.isArchived,
    createdAt: node.createdAt,
    pushedAt: node.pushedAt,
    commitCount: history?.totalCount ?? 0,
    release: node.latestRelease
      ? {
          tag: node.latestRelease.tagName,
          date: node.latestRelease.publishedAt ?? '',
          url: node.latestRelease.url,
        }
      : null,
    commits: (history?.nodes ?? []).map((commit) => ({
      sha: commit.oid.slice(0, 7),
      message: commit.messageHeadline,
      date: commit.committedDate,
    })),
    openPRs: node.pullRequests?.totalCount ?? 0,
    image: node.usesCustomOpenGraphImage ? node.openGraphImageUrl : null,
    activity: activityOf(node, now),
  }
}

/**
 * Fetch snapshots for `owner/name` repositories in one GraphQL request.
 * Private or missing repositories come back as errors: only public work is
 * shown on the site.
 */
export async function fetchRepos(repos: string[]): Promise<Map<string, FetchResult>> {
  const results = new Map<string, FetchResult>()
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    for (const repo of repos) results.set(repo, { ok: false, error: 'GITHUB_TOKEN is not set.' })
    return results
  }
  const valid = repos.filter(isRepoName)
  for (const repo of repos) {
    if (!isRepoName(repo)) results.set(repo, { ok: false, error: 'Use the form owner/name.' })
  }
  if (!valid.length) return results

  const query = `query {\n${valid
    .map((repo, index) => {
      const [owner, name] = repo.split('/')
      return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {${FIELDS}}`
    })
    .join('\n')}\n}`

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'athena-cms',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const error = `GitHub API ${res.status}`
    for (const repo of valid) results.set(repo, { ok: false, error })
    return results
  }
  const body = (await res.json()) as { data?: Record<string, RepoNode | null> | null }
  const now = Date.now()
  valid.forEach((repo, index) => {
    const node = body.data?.[`r${index}`]
    if (!node) results.set(repo, { ok: false, error: 'Repository not found (or not public).' })
    else if (node.isPrivate)
      results.set(repo, { ok: false, error: 'Private repositories are not shown.' })
    else results.set(repo, { ok: true, snapshot: toSnapshot(node, now) })
  })
  return results
}

/** Stable comparison so an unchanged repository causes no write. */
const sameSnapshot = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Scheduled task body: refresh every project's GitHub snapshot and save only
 * the ones that changed (their afterChange hook invalidates /builds).
 */
export async function syncProjects(
  payload: Payload,
): Promise<{ checked: number; updated: number }> {
  const { docs } = await payload.find({
    collection: 'projects',
    limit: 200,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    // Private repositories are never fetched (see the Projects collection).
    where: { privateRepo: { not_equals: true } },
  })
  if (!docs.length) return { checked: 0, updated: 0 }

  const results = await fetchRepos(docs.map((doc) => doc.repo))
  let updated = 0
  for (const doc of docs) {
    const result = results.get(doc.repo)
    if (!result) continue
    const data = result.ok
      ? { github: result.snapshot, syncError: null }
      : { syncError: result.error }
    const changed = result.ok
      ? !sameSnapshot(doc.github, result.snapshot) || doc.syncError
      : doc.syncError !== result.error
    if (!changed) continue
    await payload.update({
      collection: 'projects',
      id: doc.id,
      data: { ...data, syncedAt: new Date().toISOString() },
      overrideAccess: true,
      // The GitHub snapshot is already fresh; skip the hook's own fetch.
      context: { skipGitHubFetch: true },
    })
    updated += 1
  }
  payload.logger.info(`GitHub sync: ${docs.length} checked, ${updated} updated`)
  return { checked: docs.length, updated }
}
