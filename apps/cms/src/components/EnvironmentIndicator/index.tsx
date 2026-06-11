'use client'

import { useEffect, useState } from 'react'

export const EnvironmentIndicator: React.FC = () => {
  const [environment, setEnvironment] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check environment on client side
    const env = process.env.NODE_ENV
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV
    
    setEnvironment(vercelEnv || env || 'unknown')
    
    // Only show in non-production environments
    setIsVisible((vercelEnv || env) !== 'production')
  }, [])

  if (!isVisible) return null

  const getEnvColor = () => {
    switch (environment) {
      case 'development':
        return 'bg-green-500'
      case 'preview':
        return 'bg-yellow-500'
      case 'production':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-white text-sm font-medium ${getEnvColor()}`}>
      {environment.toUpperCase()}
    </div>
  )
} 