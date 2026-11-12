import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { forwardFormSubmission, MAX_BODY_BYTES, parseFormSubmission } from './form-submission'

const post = (body: string) =>
  new Request('https://web.example/api/form-submissions', {
    body,
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

const valid = JSON.stringify({
  form: '3',
  submissionData: [{ field: 'email', value: 'a@example.com' }],
  extra: 'dropped',
})

describe('parseFormSubmission', () => {
  test('keeps only form and submissionData', () => {
    expect(parseFormSubmission(valid)).toEqual({
      form: '3',
      submissionData: [{ field: 'email', value: 'a@example.com' }],
    })
  })

  test('accepts a numeric form id', () => {
    expect(parseFormSubmission('{"form":7,"submissionData":[]}')?.form).toBe('7')
  })

  test('rejects malformed bodies', () => {
    expect(parseFormSubmission('not json')).toBeNull()
    expect(parseFormSubmission('null')).toBeNull()
    expect(parseFormSubmission('{"form":"../users","submissionData":[]}')).toBeNull()
    expect(parseFormSubmission('{"form":"3","submissionData":"x"}')).toBeNull()
    expect(parseFormSubmission('{"form":"3","submissionData":[{"field":"a","value":1}]}')).toBeNull()
    const many = Array.from({ length: 51 }, (_, i) => ({ field: `f${i}`, value: '' }))
    expect(parseFormSubmission(JSON.stringify({ form: '3', submissionData: many }))).toBeNull()
  })
})

describe('forwardFormSubmission', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    process.env.CMS_URL = 'https://cms.example'
    process.env.CMS_PROTECTION_BYPASS = 'bypass'
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  test('posts the cleaned body to the CMS with the protection bypass', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return Response.json({ doc: { id: 1 } }, { status: 201 })
    }) as unknown as typeof fetch

    const res = await forwardFormSubmission(post(valid), fetchImpl)

    expect(res.status).toBe(201)
    expect(seen?.url).toBe('https://cms.example/api/form-submissions')
    expect(seen?.init.redirect).toBe('manual')
    expect((seen?.init.headers as Record<string, string>)['x-vercel-protection-bypass']).toBe(
      'bypass',
    )
    expect(JSON.parse(String(seen?.init.body))).toEqual({
      form: '3',
      submissionData: [{ field: 'email', value: 'a@example.com' }],
    })
  })

  test('passes Payload validation errors through', async () => {
    const fetchImpl = (async () =>
      Response.json({ errors: [{ message: 'Email is required' }] }, { status: 400 })) as unknown as typeof fetch

    const res = await forwardFormSubmission(post(valid), fetchImpl)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ errors: [{ message: 'Email is required' }] })
  })

  test('turns a Vercel login redirect into a 502', async () => {
    const fetchImpl = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://vercel.com/sso-api?url=x' },
      })) as unknown as typeof fetch

    const res = await forwardFormSubmission(post(valid), fetchImpl)

    expect(res.status).toBe(502)
    expect(res.headers.get('location')).toBeNull()
  })

  test('rejects invalid and oversized bodies without calling the CMS', async () => {
    let calls = 0
    const fetchImpl = (async () => {
      calls++
      return Response.json({})
    }) as unknown as typeof fetch

    expect((await forwardFormSubmission(post('{}'), fetchImpl)).status).toBe(400)
    const big = JSON.stringify({
      form: '3',
      submissionData: [{ field: 'm', value: 'x'.repeat(MAX_BODY_BYTES) }],
    })
    expect((await forwardFormSubmission(post(big), fetchImpl)).status).toBe(413)
    expect(calls).toBe(0)
  })

  test('a network failure gives a 502', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch

    expect((await forwardFormSubmission(post(valid), fetchImpl)).status).toBe(502)
  })
})
