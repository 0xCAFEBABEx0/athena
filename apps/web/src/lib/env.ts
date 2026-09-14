/**
 * Environment access for server code. Vite inlines `.env` values into
 * `import.meta.env` at build time; on Vercel, runtime secrets are only
 * available on `process.env`, so fall back to it.
 */
export const env = (key: string): string | undefined => {
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[key]
  return fromMeta ?? process.env[key]
}

export const requireEnv = (key: string): string => {
  const value = env(key)
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

const stripTrailingSlash = (value: string): string => value.replace(/\/$/, '')

/** Origin of the Payload CMS (admin + REST API), no trailing slash. */
export const cmsURL = (): string => {
  const value = env('CMS_URL')
  if (value) return stripTrailingSlash(value)
  // On Vercel the previous localhost fallback looks like a successful fetch
  // setup, then every page 500s with ECONNREFUSED.
  if (process.env.VERCEL) {
    throw new Error('Missing required environment variable: CMS_URL')
  }
  return 'http://localhost:3000'
}

/** This app's own public origin, no trailing slash. */
export const webURL = (): string => {
  const value = env('WEB_URL')
  if (value) return stripTrailingSlash(value)
  return 'http://localhost:4321'
}

/** Bypass secret for a Vercel-protected CMS deployment, if configured. */
export const cmsProtectionBypass = (): string | undefined => env('CMS_PROTECTION_BYPASS')
