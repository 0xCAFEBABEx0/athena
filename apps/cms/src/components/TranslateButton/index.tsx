'use client'

import { Button, useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { DEFAULT_LOCALE } from '@athena/shared/constants'
import type React from 'react'
import { useState } from 'react'

type Result =
  | { ok: true; seconds: number; locales: Record<string, { segments: number; translated: number }> }
  | { error: string }

/**
 * Sidebar action on posts and pages: translate the saved English version
 * into 日本語 and 中文 as drafts. The editor then switches the locale to
 * review each translation and publishes when it reads well.
 */
export const TranslateButton: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const { config } = useConfig()
  const locale = useLocale()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!id) {
    return (
      <div className="field-type" style={{ marginBottom: 'var(--base)' }}>
        <p style={{ margin: 0, opacity: 0.7 }}>Save the English version to enable translation.</p>
      </div>
    )
  }

  const run = async () => {
    if (
      !window.confirm(
        'Translate the saved English version into 日本語 and 中文?\n\nThis replaces the current Japanese and Chinese text with new drafts.',
      )
    ) {
      return
    }
    setState('running')
    setMessage('Translating… this can take a minute.')
    try {
      const res = await fetch(`${config.serverURL}${config.routes.api}/translate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionSlug, id }),
      })
      const body = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as Result
      if (!res.ok || 'error' in body) {
        setState('error')
        setMessage('error' in body ? body.error : `HTTP ${res.status}`)
        return
      }
      setState('done')
      setMessage(
        collectionSlug === 'projects'
          ? `Saved 日本語 and 中文 in ${body.seconds}s. Switch the locale at the top to review.`
          : `Saved 日本語 and 中文 drafts in ${body.seconds}s. Switch the locale at the top to review, then publish.`,
      )
    } catch {
      setState('error')
      setMessage('Could not reach the CMS.')
    }
  }

  return (
    <div className="field-type" style={{ marginBottom: 'var(--base)' }}>
      <p style={{ margin: '0 0 calc(var(--base) / 2)', fontWeight: 600 }}>Translation</p>
      <Button
        buttonStyle="secondary"
        disabled={state === 'running' || locale?.code !== DEFAULT_LOCALE}
        margin={false}
        onClick={run}
        size="small"
      >
        {state === 'running' ? 'Translating…' : 'Translate to 日本語 / 中文'}
      </Button>
      {locale?.code !== DEFAULT_LOCALE ? (
        <p style={{ margin: 'calc(var(--base) / 2) 0 0', opacity: 0.7 }}>
          Switch to English to translate from it.
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          style={{
            margin: 'calc(var(--base) / 2) 0 0',
            color: state === 'error' ? 'var(--theme-error-500)' : undefined,
          }}
        >
          {message}
          {state === 'done' ? (
            <>
              {' '}
              <button
                onClick={() => window.location.reload()}
                style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                type="button"
              >
                Reload
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
