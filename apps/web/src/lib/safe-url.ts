/**
 * Guards for URLs that come from the CMS, GitHub or a query string before
 * they become an `href` or a redirect target.
 */

/**
 * A link target safe to put in `href`: http(s), mailto, tel, or a path /
 * fragment on this site. Anything else (`javascript:`, `data:`, …) is null.
 */
export const safeHref = (value: string | null | undefined): string | null => {
  const url = (value ?? '').trim()
  if (!url) return null
  // Browsers drop tabs and newlines inside a scheme ("java\tscript:").
  // biome-ignore lint/suspicious/noControlCharactersInRegex: that is the point
  if (/[\u0000-\u001f\u007f]/.test(url)) return null
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url
  if (url.startsWith('#') || url.startsWith('?') || isLocalPath(url)) return url
  return null
}

/**
 * A path on this site, for redirects: starts with one "/" and cannot be read
 * as another origin ("//host", "/\\host").
 */
export const isLocalPath = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^\/(?![/\\])/.test(value) && !/[\u0000-\u001f\\]/.test(value)

/** An absolute http(s) URL, or null. */
export const httpUrl = (value: string | null | undefined): string | null => {
  const url = safeHref(value)
  return url && /^https?:\/\//i.test(url) ? url : null
}
