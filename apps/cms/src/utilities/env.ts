/**
 * Environment configuration utility
 * Manages environment variables for different deployment stages
 */

export const getEnvironment = () => {
  // Vercel automatically sets VERCEL_ENV
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV as 'development' | 'preview' | 'production'
  }
  
  // Fallback to NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    return 'production'
  }
  
  return 'development'
}

export const getServerUrl = () => {
  const env = getEnvironment()
  
  switch (env) {
    case 'production':
      // Use production URL from Vercel
      return process.env.VERCEL_PROJECT_PRODUCTION_URL 
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://zeus.vercel.app'
    
    case 'preview':
      // Use preview URL from Vercel
      return process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
    
    case 'development':
    default:
      // Local development
      return process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'
  }
}

export const getDatabaseUrl = () => {
  const env = getEnvironment()
  
  // In production and preview, use the main database
  if (env === 'production' || env === 'preview') {
    return process.env.DATABASE_URL
  }
  
  // In development, you might want to use a different database
  return process.env.DATABASE_URL || process.env.DATABASE_URL_DEV
}

export const isProduction = () => getEnvironment() === 'production'
export const isPreview = () => getEnvironment() === 'preview'
export const isDevelopment = () => getEnvironment() === 'development'

export const getSentryEnvironment = () => {
  const env = getEnvironment()
  
  switch (env) {
    case 'production':
      return 'production'
    case 'preview':
      return 'staging'
    case 'development':
    default:
      return 'development'
  }
} 