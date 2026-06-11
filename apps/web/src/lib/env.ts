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

/** Origin of the Payload CMS (admin + REST API), no trailing slash. */
export const cmsURL = (): string => env('CMS_URL') ?? 'http://localhost:3000'

/** This app's own public origin, no trailing slash. */
export const webURL = (): string => env('WEB_URL') ?? 'http://localhost:4321'
