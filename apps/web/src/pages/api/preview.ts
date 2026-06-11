import type { APIRoute } from 'astro'

import { enableDraft } from '@/lib/draft'
import { env } from '@/lib/env'

/**
 * Draft-preview entry point. The CMS admin's Preview button links here via
 * generatePreviewPath: `${WEB_URL}/api/preview?slug&collection&path&previewSecret`.
 * On a valid secret we set the HttpOnly draft cookie and redirect to the
 * requested path, where pages render the newest draft content.
 */
export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const secret = env('PREVIEW_SECRET')
  const previewSecret = url.searchParams.get('previewSecret')
  const path = url.searchParams.get('path')

  if (!secret || previewSecret !== secret) {
    return new Response('Invalid preview secret', { status: 401 })
  }
  if (!path || !path.startsWith('/')) {
    return new Response('Invalid path', { status: 400 })
  }

  enableDraft(cookies)
  return redirect(path, 307)
}
