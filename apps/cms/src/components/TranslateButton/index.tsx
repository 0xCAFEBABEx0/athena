'use client'

import { useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { DEFAULT_LOCALE } from '@athena/shared/constants'
import type React from 'react'
import { useState } from 'react'
import '@/admin-ui/index.css'

type Result =
  | { ok: true; seconds: number; locales: Record<string, { segments: number; translated: number }> }
  | { error: string }

/**
 * Sidebar action on posts and pages: translate the saved English version
 * into 日本語 and 中文 as drafts. The editor then switches the locale to
 * review each translation and publishes when it reads well.
 *
 * Built with daisyUI instead of Payload's <Button>, whose size/buttonStyle
 * props change in Payload 4.
 */
export const TranslateButton: React.FC = () => {
  const { id, collectionSlug } = useDocumentInfo()
  const { config } = useConfig()
  const locale = useLocale()
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!id) {
    return (
      <div className="whoa-ui field-type tw:mb-6">
        <p className="tw:m-0 tw:text-sm tw:opacity-70">Save the English version to enable translation.</p>
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

  const notEnglish = locale?.code !== DEFAULT_LOCALE

  return (
    <div className="whoa-ui field-type tw:mb-6 tw:grid tw:gap-2 tw:justify-items-start">
      <p className="tw:m-0 tw:text-sm tw:font-semibold">Translation</p>
      <button
        className="tw:btn tw:btn-sm tw:btn-outline tw:rounded-full"
        disabled={state === 'running' || notEnglish}
        onClick={run}
        type="button"
      >
        {state === 'running' ? <span className="tw:loading tw:loading-spinner tw:loading-xs" /> : null}
        {state === 'running' ? 'Translating…' : 'Translate to 日本語 / 中文'}
      </button>
      {notEnglish ? <p className="tw:m-0 tw:text-sm tw:opacity-70">Switch to English to translate from it.</p> : null}
      {message ? (
        <p className={`tw:m-0 tw:text-sm ${state === 'error' ? 'tw:text-error' : ''}`} role="status">
          {message}
          {state === 'done' ? (
            <>
              {' '}
              <button className="tw:btn tw:btn-link tw:btn-xs tw:p-0 tw:align-baseline" onClick={() => window.location.reload()} type="button">
                Reload
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
