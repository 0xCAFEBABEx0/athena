import type { APIRoute } from 'astro'

import { disableDraft } from '@/lib/draft'
import { isLocalPath } from '@/lib/safe-url'

/** Clears the draft cookie and returns to the published view. */
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  disableDraft(cookies)

  const path = url.searchParams.get('path')
  // Only paths on this site: "//host" would send the visitor elsewhere.
  return redirect(isLocalPath(path) ? path : '/', 307)
}
