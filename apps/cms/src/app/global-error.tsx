'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{ margin: '0 auto', maxWidth: '48rem', padding: '7rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
          <div>
            <h1 style={{ marginBottom: 0 }}>Something went wrong!</h1>
            <p style={{ marginBottom: '1rem' }}>An unexpected error occurred. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && error && (
              <pre style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '0.25rem', overflow: 'auto' }}>
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
