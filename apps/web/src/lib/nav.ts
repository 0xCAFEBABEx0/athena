import type { Footer, Header, Post } from '@athena/shared/payload-types'

import { getGlobal, getPosts } from './cms'
import type { Locale } from './i18n'
import type { CMSLinkData } from './links'

/**
 * Per-request memo: the CLI header and the modern sidebar both render on
 * every page (CSS shows one of them), so each CMS call should happen once.
 */
const memo = <T>(load: (locale: Locale) => Promise<T>) => {
  const cache = new WeakMap<Request, Map<Locale, Promise<T>>>()
  return (request: Request, locale: Locale): Promise<T> => {
    let byLocale = cache.get(request)
    if (!byLocale) {
      byLocale = new Map()
      cache.set(request, byLocale)
    }
    let pending = byLocale.get(locale)
    if (!pending) {
      pending = load(locale)
      byLocale.set(locale, pending)
    }
    return pending
  }
}

/** Header nav links. Never throws: a CMS outage renders the fallback nav. */
export const getHeaderNav = memo(async (locale): Promise<CMSLinkData[]> => {
  try {
    const header = await getGlobal<Header>('header', { locale })
    return (header?.navItems ?? []).map(({ link }) => link)
  } catch (error) {
    console.error('[nav] failed to load header nav', error)
    return []
  }
})

export const getFooterNav = memo(async (locale): Promise<CMSLinkData[]> => {
  try {
    const footer = await getGlobal<Footer>('footer', { locale })
    return (footer?.navItems ?? []).map(({ link }) => link)
  } catch (error) {
    console.error('[nav] failed to load footer nav', error)
    return []
  }
})

/** Newest post titles for the modern sidebar. */
export const getRecentPosts = memo(async (locale): Promise<Pick<Post, 'slug' | 'title'>[]> => {
  try {
    const result = await getPosts({ page: 1, limit: 6 }, { locale })
    return result.docs.filter((post) => post.slug)
  } catch (error) {
    console.error('[nav] failed to load recent posts', error)
    return []
  }
})
