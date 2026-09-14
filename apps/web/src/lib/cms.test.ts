import { describe, expect, test } from 'bun:test'

import { isVercelSsoLocation, parseCmsResponse } from './cms'

describe('isVercelSsoLocation', () => {
  test('detects the Deployment Protection SSO bounce', () => {
    expect(
      isVercelSsoLocation(
        'https://vercel.com/sso-api?url=https%3A%2F%2Fcms.findb.uk%2Fapi%2Fpages',
      ),
    ).toBe(true)
    expect(isVercelSsoLocation('https://vercel.com/login?next=%2Fsso-api')).toBe(true)
  })

  test('ignores real CMS and unrelated Vercel URLs', () => {
    expect(isVercelSsoLocation('https://cms.findb.uk/api/pages')).toBe(false)
    expect(isVercelSsoLocation('https://vercel.com/docs')).toBe(false)
    expect(isVercelSsoLocation(null)).toBe(false)
    expect(isVercelSsoLocation('')).toBe(false)
  })
})

describe('parseCmsResponse', () => {
  test('throws a CmsRequestError on a Vercel SSO 302', async () => {
    const res = new Response('Redirecting...', {
      status: 302,
      headers: {
        location: 'https://vercel.com/sso-api?url=https%3A%2F%2Fcms.findb.uk%2Fapi%2Fpages',
      },
    })

    await expect(parseCmsResponse(res, '/pages')).rejects.toMatchObject({
      name: 'CmsRequestError',
      message: expect.stringMatching(/Deployment Protection/),
    })
  })

  test('throws when fetch followed SSO to a 200 HTML login page', async () => {
    const res = new Response('<!DOCTYPE html><html>login</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
    Object.defineProperty(res, 'url', { value: 'https://vercel.com/login?next=%2Fsso-api' })

    await expect(parseCmsResponse(res, '/globals/header')).rejects.toThrow(/Deployment Protection/)
  })

  test('throws on non-JSON 200 instead of letting res.json() crash', async () => {
    const res = new Response('<!DOCTYPE html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })

    await expect(parseCmsResponse(res, '/pages')).rejects.toThrow(/non-JSON content-type/)
  })

  test('parses a successful Payload JSON body', async () => {
    const res = new Response(JSON.stringify({ docs: [{ slug: 'home' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    await expect(parseCmsResponse<{ docs: Array<{ slug: string }> }>(res, '/pages')).resolves.toEqual({
      docs: [{ slug: 'home' }],
    })
  })
})
