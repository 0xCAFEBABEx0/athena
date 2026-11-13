import { createHash } from 'node:crypto'

import { ROUTES } from '@athena/shared/constants'

import { cachedCms } from './cms-cache'
import { parseCmsResponse } from './cms'
import { cmsProtectionBypass, cmsURL, env } from './env'
import { isLocale, localizePath, type Locale } from './i18n'

/**
 * AI search on /search: posts found by meaning, and answers written from
 * them. The CMS keeps the index (ai.post_chunks, apps/cms/src/ai) and answers
 * POST /api/ai/search with the nearest post excerpts; this app turns those
 * into results and, for questions, asks Claude (lib/ai-answer.ts). See
 * docs/AI_SEARCH.md.
 */

/** One excerpt from POST ${CMS_URL}/api/ai/search, best first. */
export type ChunkHit = {
  postId: string
  slug: string
  title: string
  heading: string | null
  content: string
  score: number
}

export const MAX_QUERY_CHARS = 300

/** Collapse whitespace and refuse empty or overlong queries. */
export const normalizeQuery = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const query = value.replace(/\s+/g, ' ').trim()
  if (!query || query.length > MAX_QUERY_CHARS) return null
  return query
}

/** Cache key part: the same question in another case or spacing is the same entry. */
export const queryKey = (locale: Locale, query: string): string =>
  `${locale}:${createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 32)}`

export type AiRequest = { q: string; locale: Locale }

/** Read `{ q, locale }` from a request body; null when unusable. */
export const parseAiRequest = (body: unknown): AiRequest | null => {
  if (typeof body !== 'object' || body === null) return null
  const { q, locale } = body as Record<string, unknown>
  const query = normalizeQuery(q)
  if (!query) return null
  return { q: query, locale: isLocale(locale) ? locale : 'en' }
}

/** True when the web app can write answers (the switch for the whole AI search UI). */
export const aiSearchEnabled = (): boolean => Boolean(env('ANTHROPIC_API_KEY'))

export class AiSearchError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AiSearchError'
    this.status = status
  }
}

type SearchResponse = { results?: ChunkHit[]; building?: boolean }

/**
 * The excerpts nearest to `query`, from the CMS. Results are kept in the
 * Runtime Cache like other CMS reads, so a repeated query (the same words in
 * the same language) wakes neither the CMS nor its database until the next
 * content change.
 */
export const searchChunks = async (
  { q, locale }: AiRequest,
  limit: number,
  {
    beforeLoad,
    fetchImpl = fetch,
  }: {
    /** Runs only on a cache miss, before the CMS is asked (spending limits); may throw. */
    beforeLoad?: () => Promise<void>
    fetchImpl?: typeof fetch
  } = {},
): Promise<ChunkHit[]> => {
  const secret = env('REVALIDATE_SECRET')
  if (!secret) throw new AiSearchError('REVALIDATE_SECRET is not set on the web deployment.', 503)
  const load = async (): Promise<ChunkHit[]> => {
    await beforeLoad?.()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    }
    const bypass = cmsProtectionBypass()
    if (bypass) headers['x-vercel-protection-bypass'] = bypass
    const path = '/ai/search'
    let res: Response
    try {
      res = await fetchImpl(`${cmsURL()}/api${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ q, locale, limit }),
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
      })
    } catch (error) {
      throw new AiSearchError(`CMS unreachable: ${String(error)}`, 502)
    }
    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new AiSearchError(body.error ?? 'AI search is not set up on the CMS.', 503)
    }
    try {
      const body = await parseCmsResponse<SearchResponse>(res, path)
      return Array.isArray(body.results) ? body.results : []
    } catch (error) {
      // A login redirect, a 401 (secrets out of step) or a 500: the CMS side failed.
      throw new AiSearchError(error instanceof Error ? error.message : String(error), 502)
    }
  }
  return cachedCms(`ai:search:${limit}:${queryKey(locale, q)}`, load)
}

export type PostHit = {
  slug: string
  href: string
  title: string
  heading: string | null
  /** The best matching excerpt, shortened. */
  snippet: string
  score: number
}

const SNIPPET_CHARS = 140

export const snippetOf = (content: string): string => {
  const flat = content.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim()
  return flat.length > SNIPPET_CHARS ? `${flat.slice(0, SNIPPET_CHARS - 1).trimEnd()}…` : flat
}

/** Results within this distance of the best one are shown. */
const RELATIVE_CUT = 0.15
/** Nothing below this similarity is shown, however few results that leaves. */
const ABSOLUTE_FLOOR = 0.2
const MAX_POSTS = 10

/**
 * One result per post (its best excerpt), best first, keeping only posts
 * close to the best match: a query about one topic should not list every
 * post just because each is a little similar.
 */
export const rankPosts = (chunks: ChunkHit[], locale: Locale): PostHit[] => {
  const best = new Map<string, ChunkHit>()
  for (const chunk of chunks) {
    const seen = best.get(chunk.slug)
    if (!seen || chunk.score > seen.score) best.set(chunk.slug, chunk)
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score)
  const top = ranked[0]?.score ?? 0
  return ranked
    .filter((chunk) => chunk.score >= ABSOLUTE_FLOOR && chunk.score >= top - RELATIVE_CUT)
    .slice(0, MAX_POSTS)
    .map((chunk) => ({
      slug: chunk.slug,
      href: localizePath(locale, `${ROUTES.posts}/${chunk.slug}`),
      title: chunk.title,
      heading: chunk.heading,
      snippet: snippetOf(chunk.content),
      score: Math.round(chunk.score * 1000) / 1000,
    }))
}

/** Excerpts below this similarity, or this far below the best one, are not given to Claude. */
const ANSWER_FLOOR = 0.15
const ANSWER_SPREAD = 0.25

/**
 * The excerpts worth answering from: the nearest ones, minus those clearly
 * unrelated to the question (every post is a little similar to anything).
 */
export const relevantChunks = (chunks: ChunkHit[]): ChunkHit[] => {
  const top = chunks.reduce((best, chunk) => Math.max(best, chunk.score), 0)
  return chunks.filter((chunk) => chunk.score >= ANSWER_FLOOR && chunk.score >= top - ANSWER_SPREAD)
}

/**
 * Same-origin check for the browser-facing AI endpoints: a page on another
 * site cannot make a reader's browser spend this site's API budget. Requests
 * without an Origin header (curl) are left to the rate limits.
 */
export const isCrossSite = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  if (!origin) return request.headers.get('sec-fetch-site') === 'cross-site'
  try {
    return new URL(origin).host !== new URL(request.url).host
  } catch {
    return true
  }
}

/** The caller's address as Vercel reports it, for the per-visitor limit. */
export const clientAddress = (request: Request): string =>
  request.headers.get('x-real-ip') ??
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown'
