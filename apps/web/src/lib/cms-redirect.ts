import { currentRoute } from '@athena/shared/constants'
import type { Redirect } from '@athena/shared/payload-types'

import { type Locale, localizePath } from './i18n'
import { type CMSLinkData, linkHref } from './links'
import { isLocalPath } from './safe-url'

/**
 * Where the CMS Redirects entry for this path sends the visitor, or null. An
 * entry written for an old section path (`/posts/old-slug`) also answers its
 * renamed path (`/notes/old-slug`), because CMS links typed with the old path
 * are rewritten to the new one before anyone clicks them; an exact entry wins.
 * Only paths on this site are used: an entry pointing anywhere else is ignored.
 */
export const cmsRedirectTarget = (
  redirects: Redirect[],
  pathname: string,
  locale: Locale,
): string | null => {
  const match =
    redirects.find((redirect) => redirect.from === pathname) ??
    redirects.find(
      (redirect) =>
        typeof redirect.from === 'string' &&
        redirect.from !== pathname &&
        currentRoute(redirect.from) === pathname,
    )
  if (!match?.to) return null
  const dest =
    match.to.type === 'reference'
      ? linkHref({ type: 'reference', reference: match.to.reference } as CMSLinkData)
      : match.to.url
  if (!isLocalPath(dest)) return null
  // Checked again after localizing: `/ja//host` becomes `//host` in English.
  const target = localizePath(locale, dest)
  return isLocalPath(target) ? target : null
}
