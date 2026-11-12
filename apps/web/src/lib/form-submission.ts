import { cmsProtectionBypass, cmsURL } from './env'

/** Largest JSON body accepted from the browser (a contact form is far smaller). */
export const MAX_BODY_BYTES = 32 * 1024
const MAX_FIELDS = 50

export type FormSubmission = {
  form: string
  submissionData: { field: string; value: string }[]
}

const errorResponse = (status: number, message: string): Response =>
  Response.json({ errors: [{ message }] }, { status })

/**
 * Validate the browser's JSON body and keep only what Payload's
 * form-submissions collection takes. Returns null for anything else.
 */
export const parseFormSubmission = (raw: string): FormSubmission | null => {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return null
  }
  if (!body || typeof body !== 'object') return null
  const { form, submissionData } = body as Record<string, unknown>

  const formId = typeof form === 'number' ? String(form) : form
  if (typeof formId !== 'string' || !/^[\w-]{1,64}$/.test(formId)) return null
  if (!Array.isArray(submissionData) || submissionData.length > MAX_FIELDS) return null

  const fields: FormSubmission['submissionData'] = []
  for (const item of submissionData) {
    if (!item || typeof item !== 'object') return null
    const { field, value } = item as Record<string, unknown>
    if (typeof field !== 'string' || typeof value !== 'string') return null
    fields.push({ field, value })
  }
  return { form: formId, submissionData: fields }
}

/**
 * Forward a form post from the browser to the CMS, server to server.
 *
 * The browser used to post to `${CMS_URL}/api/form-submissions` itself, which
 * fails once Vercel Deployment Protection covers the CMS (visitors have no
 * Vercel login). From here the request carries the Protection Bypass for
 * Automation secret like every other CMS read (lib/cms.ts).
 */
export const forwardFormSubmission = async (
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> => {
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) return errorResponse(413, 'Submission is too large.')

  const raw = await readLimited(request, MAX_BODY_BYTES)
  if (raw === null) return errorResponse(413, 'Submission is too large.')

  const submission = parseFormSubmission(raw)
  if (!submission) return errorResponse(400, 'Invalid submission.')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const bypass = cmsProtectionBypass()
  if (bypass) headers['x-vercel-protection-bypass'] = bypass

  let status: number
  let text: string
  let isJson: boolean
  try {
    const res = await fetchImpl(`${cmsURL()}/api/form-submissions`, {
      body: JSON.stringify(submission),
      headers,
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    // A redirect here is the Vercel login page (protection without a bypass).
    if (res.status >= 300 && res.status < 400) {
      console.error(
        `[form-submissions] CMS redirected ${res.status} -> ${res.headers.get('location') ?? 'unknown'}; ` +
          'set CMS_PROTECTION_BYPASS on athena-web',
      )
      return errorResponse(502, 'Something went wrong.')
    }
    status = res.status
    isJson = (res.headers.get('content-type') ?? '').toLowerCase().includes('json')
    text = await res.text()
  } catch (error) {
    console.error('[form-submissions] CMS request failed:', error)
    return errorResponse(502, 'Something went wrong.')
  }

  // Anything but JSON is not Payload answering (a proxy or login page), even
  // with a 2xx status: the browser must not show the confirmation for it.
  if (!isJson) {
    console.error(`[form-submissions] CMS answered ${status} without JSON`)
    return errorResponse(502, 'Something went wrong.')
  }
  if (status >= 500) console.error(`[form-submissions] CMS answered ${status}`)
  // Pass Payload's status and JSON (validation errors) through; never its other headers.
  return new Response(text, { status, headers: { 'Content-Type': 'application/json' } })
}

/** The request body as text, or null once it passes `limit` bytes (stops reading). */
const readLimited = async (request: Request, limit: number): Promise<string | null> => {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}
