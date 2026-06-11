'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="container py-28">
          <div className="prose max-w-none">
            <h1 style={{ marginBottom: 0 }}>Something went wrong!</h1>
            <p className="mb-4">An unexpected error occurred. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && error && (
              <pre className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                {error.message}
                {error.stack && (
                  <>
                    {'\n\n'}
                    {error.stack}
                  </>
                )}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
