import type { Project } from '@athena/shared/payload-types'

import { getProjectDocs } from './cms'
import type { Locale } from './i18n'

/**
 * "Work threads": each GitHub repository is shown like a thread in an agent
 * app. Status is derived from GitHub activity unless set in the CMS.
 */
/** `done` is shown as "Resolved"; `waiting` ("Waiting on you") is only set in the CMS. */
export type WorkStatus = 'waiting' | 'working' | 'idle' | 'done'

export type WorkCommit = { sha: string; message: string; date: string }

export type WorkItem = {
  slug: string
  repo: string
  repoUrl: string
  title: string
  /** One line: CMS override, else the (translated) GitHub description. */
  description: string
  /** What Master asked for, shown as the user's message of the thread. */
  brief: string
  /** Short write-up shown as the reply. */
  notes: string
  status: WorkStatus
  pinned: boolean
  order: number
  liveUrl: string | null
  language: string | null
  languages: { name: string; share: number }[]
  topics: string[]
  stars: number
  commitCount: number
  createdAt: string
  pushedAt: string
  release: { tag: string; date: string; url: string } | null
  commits: WorkCommit[]
  openPRs: number
  /** Custom social preview image of the repository, if one was uploaded. */
  image: string | null
}

/** Shape of `projects.github`, written by the CMS sync (apps/cms/src/github/sync.ts). */
type GitHubSnapshot = {
  description?: string | null
  homepage?: string | null
  language?: string | null
  languages?: { name: string; share: number }[]
  topics?: string[]
  stars?: number
  archived?: boolean
  createdAt?: string | null
  pushedAt?: string | null
  commitCount?: number
  release?: { tag: string; date: string; url: string } | null
  commits?: WorkCommit[]
  openPRs?: number
  image?: string | null
  activity?: WorkStatus
}

/** Days without a push after which a repository counts as idle (matches the CMS). */
export const IDLE_AFTER_DAYS = 30

const isSnapshot = (value: unknown): value is GitHubSnapshot =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const deriveStatus = (doc: Project, gh: GitHubSnapshot, now: number): WorkStatus => {
  if (doc.status && doc.status !== 'auto') return doc.status
  if (gh.archived) return 'done'
  if (gh.activity) return gh.activity
  const pushed = Date.parse(gh.pushedAt ?? '')
  if (Number.isNaN(pushed)) return 'idle'
  return now - pushed < IDLE_AFTER_DAYS * 86_400_000 ? 'working' : 'idle'
}

const normalize = (doc: Project, gh: GitHubSnapshot, now: number): WorkItem => ({
  slug: doc.slug || doc.repo.split('/').pop() || String(doc.id),
  repo: doc.repo,
  repoUrl: `https://github.com/${doc.repo}`,
  title: doc.title?.trim() || doc.repo.split('/').pop() || doc.repo,
  description: doc.description?.trim() || gh.description?.trim() || '',
  brief: doc.brief?.trim() || '',
  notes: doc.notes?.trim() || '',
  status: deriveStatus(doc, gh, now),
  pinned: Boolean(doc.pinned),
  order: doc.order ?? 0,
  liveUrl: doc.liveUrl?.trim() || gh.homepage || null,
  language: gh.language ?? null,
  languages: gh.languages ?? [],
  topics: gh.topics ?? [],
  stars: gh.stars ?? 0,
  commitCount: gh.commitCount ?? 0,
  createdAt: gh.createdAt ?? '',
  pushedAt: gh.pushedAt ?? '',
  release: gh.release ?? null,
  commits: gh.commits ?? [],
  openPRs: gh.openPRs ?? 0,
  image: gh.image?.startsWith('https://') ? gh.image : null,
})

const STATUS_ORDER: Record<WorkStatus, number> = { waiting: 0, working: 1, idle: 2, done: 3 }

const loadWork = async (locale: Locale): Promise<WorkItem[]> => {
  try {
    const now = Date.now()
    const docs = await getProjectDocs<Project>({ locale })
    // Entries GitHub never returned (private, renamed, typo) stay off the site.
    return docs
      .filter((doc) => doc.repo && !doc.hidden && isSnapshot(doc.github))
      .map((doc) => normalize(doc, doc.github as GitHubSnapshot, now))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          Date.parse(b.pushedAt || '0') - Date.parse(a.pushedAt || '0'),
      )
  } catch (error) {
    console.error('[work] failed to load projects', error)
    return []
  }
}

// One fetch per request: the page and the ADE sidebar both ask for it.
const perRequest = new WeakMap<Request, Map<Locale, Promise<WorkItem[]>>>()

/** All visible work threads, most recently active first within each status. Never throws. */
export const getWork = (request: Request, locale: Locale): Promise<WorkItem[]> => {
  let byLocale = perRequest.get(request)
  if (!byLocale) {
    byLocale = new Map()
    perRequest.set(request, byLocale)
  }
  let pending = byLocale.get(locale)
  if (!pending) {
    pending = loadWork(locale)
    byLocale.set(locale, pending)
  }
  return pending
}

/** Hostname for display: https://whoa.me/ → whoa.me */
export const displayHost = (url: string): string => {
  try {
    const { host, pathname } = new URL(url)
    return pathname === '/' ? host : `${host}${pathname}`
  } catch {
    return url
  }
}
