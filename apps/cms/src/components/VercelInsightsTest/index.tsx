'use client'

import { useEffect, useState } from 'react'

// Type definitions for Vercel analytics
interface VercelAnalytics {
  track: (event: string, properties?: Record<string, unknown>) => void;
}

// Vercel global objects interface
interface VercelGlobals {
  va?: VercelAnalytics;
  _va?: VercelAnalytics;
  si?: unknown;
  _si?: unknown;
  speedInsights?: unknown;
  __VERCEL_SPEED_INSIGHTS__?: unknown;
}

// Type guard to safely access Vercel globals from window
const getVercelGlobals = (): VercelGlobals => {
  if (typeof window === 'undefined') return {}
  return window as unknown as VercelGlobals
}

export const VercelInsightsTest: React.FC = () => {
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [speedInsightsLoaded, setSpeedInsightsLoaded] = useState(false)
  const [environment, setEnvironment] = useState('')

  useEffect(() => {
    // Check environment
    setEnvironment(process.env.NODE_ENV || 'unknown')

    // Check if Vercel Analytics is loaded
    const checkAnalytics = () => {
      const vercelGlobals = getVercelGlobals()
      if (vercelGlobals.va || vercelGlobals._va) {
        setAnalyticsLoaded(true)
      }
    }

    // Check if Speed Insights is loaded
    const checkSpeedInsights = () => {
      const vercelGlobals = getVercelGlobals()
      if (vercelGlobals.si || vercelGlobals._si || vercelGlobals.speedInsights || vercelGlobals.__VERCEL_SPEED_INSIGHTS__) {
        setSpeedInsightsLoaded(true)
      }
    }

    // Check immediately
    checkAnalytics()
    checkSpeedInsights()

    // Check again after a delay to allow scripts to load
    const timer = setTimeout(() => {
      checkAnalytics()
      checkSpeedInsights()
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  const triggerPageView = () => {
    const vercelGlobals = getVercelGlobals()
    const analytics = vercelGlobals.va
    if (analytics?.track) {
      analytics.track('test-page-view', {
        timestamp: new Date().toISOString(),
      })
    }
  }

  const triggerCustomEvent = () => {
    const vercelGlobals = getVercelGlobals()
    const analytics = vercelGlobals.va
    if (analytics?.track) {
      analytics.track('test-custom-event', {
        action: 'button-click',
        category: 'test',
        timestamp: new Date().toISOString(),
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Vercel Insights Test</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Environment Status</h3>
            <p>
              <span className="font-medium">Environment:</span>
              <span className={`ml-2 px-2 py-1 rounded text-sm ${environment === 'production' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                {environment}
              </span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Analytics are {environment === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' ? 'enabled' : 'disabled'} in this environment
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Analytics Status</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${analyticsLoaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Vercel Analytics: {analyticsLoaded ? 'Loaded' : 'Not Loaded'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${speedInsightsLoaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Speed Insights: {speedInsightsLoaded ? 'Loaded' : 'Not Loaded'}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Test Actions</h3>
            <div className="space-x-2">
              <button
                onClick={triggerPageView}
                disabled={!analyticsLoaded}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Test Page View
              </button>
              <button
                onClick={triggerCustomEvent}
                disabled={!analyticsLoaded}
                className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Test Custom Event
              </button>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded">
            <h4 className="font-semibold mb-2">Debugging Information</h4>
            <div className="text-sm space-y-1">
              <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
              <p><strong>NEXT_PUBLIC_ENABLE_ANALYTICS:</strong> {process.env.NEXT_PUBLIC_ENABLE_ANALYTICS || 'undefined'}</p>
              <p><strong>Analytics should be enabled:</strong> {String(process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true')}</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
            <h4 className="font-semibold mb-2">Troubleshooting Tips</h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>For development testing, add <code>NEXT_PUBLIC_ENABLE_ANALYTICS=true</code> to your .env.local</li>
              <li>Check browser DevTools Network tab for Vercel analytics requests</li>
              <li>Ensure your Vercel project has Analytics enabled in the dashboard</li>
              <li>Speed Insights requires actual user interactions to collect data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 