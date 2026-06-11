import type { APIRoute } from 'astro'

import { disableDraft } from '@/lib/draft'

/** Clears the draft cookie and returns to the published view. */
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  disableDraft(cookies)

  const path = url.searchParams.get('path')
  return redirect(path && path.startsWith('/') ? path : '/', 307)
}
