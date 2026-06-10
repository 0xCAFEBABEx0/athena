import { SentryTest } from '@/components/SentryTest'
import { notFound } from 'next/navigation'

export default function SentryTestPage() {
  // Only allow access in development and preview environments
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Sentry Integration Test</h1>
      <SentryTest />
    </div>
  )
} 