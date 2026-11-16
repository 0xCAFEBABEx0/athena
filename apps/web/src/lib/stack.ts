import type { Media, Stack } from '@athena/shared/payload-types'

import type { Locale } from '@athena/shared/constants'

import { getGlobal } from './cms'
import { mediaUrl } from './media'
import { httpUrl } from './safe-url'

/**
 * /stacks: the tools Master builds with, from the CMS `stack` global. Each
 * item's favicon was fetched by the CMS on save and lives in Media, so the
 * page never asks the tool's site (or Google) for it.
 */
export type StackStatus = 'current' | 'trying' | 'former'

export type StackItem = {
  name: string
  /** Official site (absolute http(s)), or null. */
  url: string | null
  note: string
  since: number | null
  status: StackStatus
  /** Favicon in Media (absolute URL), or null for the initials tile. */
  icon: string | null
  /** One or two letters for the tile when there is no icon. */
  initials: string
}

export type StackGroup = { title: string; description: string; items: StackItem[] }

export type StackData = {
  intro: string
  /** Groups with their current and trying tools; empty groups are left out. */
  groups: StackGroup[]
  /** Former tools of every group, folded at the end of the page. */
  former: StackItem[]
  /** Tools in `groups` (former ones not counted). */
  count: number
}

/** "Claude Code" → "CC", "TypeScript" → "T", "daisyUI" → "D". */
export const initialsOf = (name: string): string => {
  const words = name
    .trim()
    .split(/[\s/._-]+/)
    .filter(Boolean)
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '')
  return letters.join('').toUpperCase()
}

const iconOf = (icon: number | Media | null | undefined): string | null =>
  icon && typeof icon === 'object' && icon.url ? mediaUrl(icon.url, icon.updatedAt) : null

const STATUSES: StackStatus[] = ['current', 'trying', 'former']

/** Exported for tests. */
export const normalizeStack = (stack: Partial<Stack> | null | undefined): StackData => {
  const groups: StackGroup[] = []
  const former: StackItem[] = []
  for (const group of stack?.groups ?? []) {
    const items: StackItem[] = []
    for (const raw of group.items ?? []) {
      const name = raw.name?.trim()
      if (!name) continue
      const since = typeof raw.since === 'number' && Number.isInteger(raw.since) ? raw.since : null
      const item: StackItem = {
        name,
        url: httpUrl(raw.url?.trim()),
        note: raw.note?.trim() ?? '',
        since: since && since >= 1970 && since <= 2100 ? since : null,
        status: STATUSES.includes(raw.status) ? raw.status : 'current',
        icon: iconOf(raw.icon),
        initials: initialsOf(name),
      }
      if (item.status === 'former') former.push(item)
      else items.push(item)
    }
    if (items.length > 0) {
      groups.push({
        title: group.title?.trim() ?? '',
        description: group.description?.trim() ?? '',
        items,
      })
    }
  }
  return {
    intro: stack?.intro?.trim() ?? '',
    groups,
    former,
    count: groups.reduce((sum, group) => sum + group.items.length, 0),
  }
}

/**
 * The Stack global; throws when the CMS cannot answer, so `/stacks` shows the
 * 500 page (never cached) instead of a 404 the CDN would keep for a day.
 */
export const loadStack = async (locale: Locale): Promise<StackData> =>
  normalizeStack(await getGlobal<Stack>('stack', { locale }))

/** The Stack global, or null when the CMS cannot answer (the sitemap then leaves `/stacks` out). */
export const getStack = async (locale: Locale): Promise<StackData | null> => {
  try {
    return await loadStack(locale)
  } catch (error) {
    console.error('[stack] failed to load the stack', error)
    return null
  }
}
