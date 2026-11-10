import type { WorkItem } from './work'

export type BannerActivity = {
  /** ISO timestamp. */
  date: string
  kind: 'post' | 'release' | 'push'
  label: string
  href: string
}

type ActivityPost = {
  slug?: string | null
  title?: string | null
  publishedAt?: string | null
}

type ActivityWork = Pick<WorkItem, 'slug' | 'title' | 'pushedAt' | 'release'>

/** A release this close to the last push counts as the project's news. */
const RELEASE_SLACK_MS = 60 * 60 * 1000

/**
 * The CLI banner's "Recent activity": the newest posts and, per project, its
 * latest release or push (whichever is newer), newest first. Entries without
 * a usable date are left out.
 */
export const buildActivity = (
  posts: ActivityPost[],
  work: ActivityWork[],
  href: (path: string) => string,
  limit = 3,
): BannerActivity[] => {
  const time = (value: string | null | undefined) => (value ? Date.parse(value) : Number.NaN)
  const items: BannerActivity[] = []
  for (const post of posts) {
    if (!post.slug || Number.isNaN(time(post.publishedAt))) continue
    items.push({
      date: post.publishedAt as string,
      kind: 'post',
      label: post.title || post.slug,
      href: href(`/posts/${post.slug}`),
    })
  }
  for (const item of work) {
    const link = href(`/work/${item.slug}`)
    const release = time(item.release?.date)
    const push = time(item.pushedAt)
    if (item.release && !Number.isNaN(release) && (Number.isNaN(push) || release >= push - RELEASE_SLACK_MS)) {
      items.push({ date: item.release.date, kind: 'release', label: `${item.title} ${item.release.tag}`, href: link })
    } else if (!Number.isNaN(push)) {
      items.push({ date: item.pushedAt, kind: 'push', label: item.title, href: link })
    }
  }
  return items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, limit)
}
