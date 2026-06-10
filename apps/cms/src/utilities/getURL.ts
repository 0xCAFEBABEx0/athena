import canUseDOM from './canUseDOM'

/**
 * Origin of this CMS app (admin + API).
 * CMS_URL is the canonical setting; NEXT_PUBLIC_SERVER_URL is honored for
 * backwards compatibility with the existing Vercel deployment.
 */
export const getServerSideURL = () => {
  return (
    process.env.CMS_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'
  )
}

/**
 * Origin of the public web frontend (the Astro app). Used for CORS/CSRF,
 * preview URLs, and cache-invalidation webhooks. Empty string while the
 * frontend still lives in this app (bridge period) — callers must handle that.
 */
export const getWebURL = () => {
  return process.env.WEB_URL || ''
}

export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  return process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || ''
}
