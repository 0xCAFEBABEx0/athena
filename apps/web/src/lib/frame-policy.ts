import { cmsURL } from './env'

/**
 * Who may show this site's pages in a frame: the site itself and the CMS
 * (Payload's Live Preview frames the page being edited). Any other site is
 * refused, so a page elsewhere cannot load /search?mode=ask in a hidden frame
 * and spend the AI search budget, or overlay the site (clickjacking).
 */
export const frameAncestors = (cms: () => string = cmsURL): string => {
  let origin = ''
  try {
    origin = new URL(cms()).origin
  } catch {
    // No CMS_URL: only the site itself.
  }
  return ["frame-ancestors 'self'", origin].filter(Boolean).join(' ')
}

/** Add the frame policy to an HTML response; responses with fixed headers (redirects) are left alone. */
export const withFramePolicy = (response: Response, policy = frameAncestors()): Response => {
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  try {
    response.headers.set('Content-Security-Policy', policy)
  } catch {
    // Immutable headers.
  }
  return response
}
