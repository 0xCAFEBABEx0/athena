/**
 * Environment configuration utility.
 *
 * Platform-neutral: deployment stage comes from DEPLOY_ENV
 * ('development' | 'preview' | 'production'), set per environment in
 * wrangler.jsonc vars (Cloudflare) or the host's env settings. VERCEL_ENV is
 * honored as a fallback while the Vercel bridge deployment is still alive.
 */

export type DeployEnv = 'development' | 'preview' | 'production'

export const getEnvironment = (): DeployEnv => {
  const explicit = process.env.DEPLOY_ENV || process.env.VERCEL_ENV
  if (explicit === 'production' || explicit === 'preview' || explicit === 'development') {
    return explicit
  }

  if (process.env.NODE_ENV === 'production') {
    return 'production'
  }

  return 'development'
}

export const isProduction = () => getEnvironment() === 'production'
export const isPreview = () => getEnvironment() === 'preview'
export const isDevelopment = () => getEnvironment() === 'development'

export const getSentryEnvironment = () => {
  switch (getEnvironment()) {
    case 'production':
      return 'production'
    case 'preview':
      return 'staging'
    case 'development':
    default:
      return 'development'
  }
}
