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

/**
 * Links to the CMS admin (`/admin`, on any host) are dropped from the public
 * nav even when an editor adds one: the site should not point visitors, or
 * scanners, at the login page.
 */
const isAdminLink = (link: CMSLinkData): boolean => {
  if (link.type === 'reference' || !link.url) return false
  try {
    const { pathname } = new URL(link.url, 'https://site.invalid')
    return pathname === '/admin' || pathname.startsWith('/admin/')
  } catch {
    return false
  }
}

const publicLinks = (items: { link: CMSLinkData }[] | null | undefined): CMSLinkData[] =>
  (items ?? []).map(({ link }) => link).filter((link) => !isAdminLink(link))

/** Header nav links. Never throws: a CMS outage renders the fallback nav. */
export const getHeaderNav = memo(async (locale): Promise<CMSLinkData[]> => {
  try {
    const header = await getGlobal<Header>('header', { locale })
    return publicLinks(header?.navItems)
  } catch (error) {
    console.error('[nav] failed to load header nav', error)
    return []
  }
})

export const getFooterNav = memo(async (locale): Promise<CMSLinkData[]> => {
  try {
    const footer = await getGlobal<Footer>('footer', { locale })
    return publicLinks(footer?.navItems)
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
