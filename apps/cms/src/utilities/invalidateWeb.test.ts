import { afterEach, describe, expect, test } from 'bun:test'

import type { Payload } from 'payload'

import { invalidateWeb } from './invalidateWeb'

const realFetch = globalThis.fetch
const saved = { ...process.env }

const logger = () => {
  const lines: { level: string; msg: string }[] = []
  const log = (level: string) => (msg: string) => lines.push({ level, msg })
  return {
    lines,
    payload: { logger: { info: log('info'), warn: log('warn'), error: log('error') } } as unknown as Payload,
  }
}

afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...saved }
})

describe('TC-U-31 invalidateWeb', () => {
  test('warns instead of failing silently when REVALIDATE_SECRET or WEB_URL is missing', async () => {
    process.env.WEB_URL = 'https://web.example'
    delete process.env.REVALIDATE_SECRET
    const { lines, payload } = logger()
    await invalidateWeb({ paths: ['/'], payload })
    expect(lines).toEqual([
      {
        level: 'warn',
        msg: 'Web invalidation skipped: REVALIDATE_SECRET is not set in this deployment',
      },
    ])
  })

  test('sends the secret and the protection bypass, without following redirects', async () => {
    process.env.WEB_URL = 'https://web.example'
    process.env.REVALIDATE_SECRET = 's3cret'
    process.env.WEB_PROTECTION_BYPASS = 'bypass'
    let init: RequestInit | undefined
    let url = ''
    globalThis.fetch = (async (input: string | URL | Request, options?: RequestInit) => {
      url = String(input)
      init = options
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const { lines, payload } = logger()
    await invalidateWeb({ paths: ['/'], tags: ['global_site'], payload })
    expect(url).toBe('https://web.example/api/invalidate')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer s3cret')
    expect(headers.get('x-vercel-protection-bypass')).toBe('bypass')
    expect(init?.redirect).toBe('manual')
    expect(JSON.parse(String(init?.body))).toEqual({ paths: ['/'], tags: ['global_site'] })
    expect(lines[0]?.level).toBe('info')
  })

  test('reports a redirect (for example to the Vercel login) as a failure', async () => {
    process.env.WEB_URL = 'https://web.example'
    process.env.REVALIDATE_SECRET = 's3cret'
    delete process.env.WEB_PROTECTION_BYPASS
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://vercel.com/sso-api?x' },
      })) as unknown as typeof fetch
    const { lines, payload } = logger()
    await invalidateWeb({ paths: ['/'], payload })
    expect(lines).toEqual([
      {
        level: 'error',
        msg: 'Web invalidation failed: 302 redirect to https://vercel.com/sso-api?x',
      },
    ])
  })
})
