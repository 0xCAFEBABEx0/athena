import type { APIRoute } from 'astro'

import { forwardFormSubmission } from '@/lib/form-submission'

/**
 * Form-builder submissions from FormBlock:
 *
 *   POST /api/form-submissions
 *   { "form": "<form id>", "submissionData": [{ "field": "email", "value": "..." }] }
 *
 * Forwarded to the CMS from the server, so the CMS can sit behind Vercel
 * Deployment Protection (see lib/form-submission.ts).
 */
export const POST: APIRoute = ({ request }) => forwardFormSubmission(request)
