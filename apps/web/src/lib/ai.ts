import { createHash } from 'node:crypto'

import { anthropicConnection } from '@athena/shared/anthropic'
import { ROUTES } from '@athena/shared/constants'

import { cachedCms } from './cms-cache'
import { parseCmsResponse } from './cms'
import { cmsProtectionBypass, cmsURL, env } from './env'
import { isLocale, localizePath, type Locale } from './i18n'

/**
 * AI search on /search: notes and pages found by meaning, and answers
 * written from them. The CMS keeps the index (ai.chunks, apps/cms/src/ai) and
 * answers POST /api/ai/search with the nearest excerpts; this app turns those
 * into results and, for questions, asks Claude (lib/ai-answer.ts). See
 * docs/AI_SEARCH.md.
 */

/** What an excerpt comes from (apps/cms/src/ai/store.ts DOC_KINDS). */
export const DOC_KINDS = ['post', 'page', 'project', 'about', 'stack'] as const
export type DocKind = (typeof DOC_KINDS)[number]

/**
 * One plain path segment: the characters CMS slugs use (builds keep a
 * repository's dots, e.g. `foo.js`), never `.` or `..`.
 */
const SLUG = /^(?!\.{1,2}$)[\w.-]{1,200}$/

/**
 * The public path (without the language prefix) of a document in the index,
 * built here from ROUTES so a section rename needs no reindex; null for an
 * unknown kind or a slug that is not a plain path segment.
 */
export const docPath = (kind: unknown, slug: unknown): string | null => {
  if (kind === 'about') return ROUTES.about
  if (kind === 'stack') return ROUTES.stack
  if (typeof slug !== 'string' || !SLUG.test(slug)) return null
  if (kind === 'post') return `${ROUTES.posts}/${slug}`
  if (kind === 'project') return `${ROUTES.work}/${slug}`
  if (kind === 'page') return `/${slug}`
  return null
}

/** One excerpt from POST ${CMS_URL}/api/ai/search, best first. */
export type ChunkHit = {
  kind: DocKind
  docId: string
  /** '' for about and stack. */
  slug: string
  title: string
  heading: string | null
  content: string
  /** Changes when the excerpt's text changes. */
  hash: string
  score: number
}

/** An answer the CMS kept (ai.answers) for this question or one meaning nearly the same. */
export type KeptAnswer = { question: string; sourceKey: string; answer: unknown; similarity: number }

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

export type AiMode = 'meaning' | 'ask'

/**
 * The AI modes this deployment offers. By meaning needs only the CMS (its
 * VOYAGE_API_KEY and the ai.chunks table; this server reaches it with
 * REVALIDATE_SECRET); Ask AI also needs a way to Claude here: ANTHROPIC_API_KEY,
 * or ANTHROPIC_BASE_URL + CF_AIG_TOKEN for Cloudflare AI Gateway (anthropicConnection).
 * AI_SEARCH=off hides both.
 */
export const aiModes = (): AiMode[] => {
  if (env('AI_SEARCH')?.trim().toLowerCase() === 'off' || !env('REVALIDATE_SECRET')) return []
  return anthropicConnection(env) ? ['meaning', 'ask'] : ['meaning']
}

export const aiModeEnabled = (mode: AiMode): boolean => aiModes().includes(mode)

/** `code` is what the page is told (busy, daily, building); anything else shows as `search`. */
export class AiSearchError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status: number, code = 'search') {
    super(message)
    this.name = 'AiSearchError'
    this.status = status
    this.code = code
  }
}

/** The error body the AI endpoints send for a failed search. */
export const searchFailure = (cause: unknown): { status: number; code: string } => {
  if (cause instanceof AiSearchError) {
    if (cause.status === 429 || cause.status === 503) return { status: cause.status, code: cause.code }
  }
  return { status: 502, code: 'search' }
}

type SearchResponse = { results?: ChunkHit[]; building?: boolean; answers?: KeptAnswer[] }

export type CmsSearch = { results: ChunkHit[]; answers: KeptAnswer[] }

/**
 * The excerpts nearest to `query`, from the CMS. Results are kept in the
 * Runtime Cache like other CMS reads, so a repeated query (the same words in
 * the same language) wakes neither the CMS nor its database until the next
 * content change.
 */
export const searchCms = async (
  { q, locale }: AiRequest,
  limit: number,
  {
    beforeLoad,
    answerModel,
    fetchImpl = fetch,
  }: {
    /** Runs only on a cache miss, before the CMS is asked (spending limits); may throw. */
    beforeLoad?: () => Promise<void>
    /** Also ask for answers this Claude model wrote before (Ask AI). */
    answerModel?: string
    fetchImpl?: typeof fetch
  } = {},
): Promise<CmsSearch> => {
  const secret = env('REVALIDATE_SECRET')
  if (!secret) throw new AiSearchError('REVALIDATE_SECRET is not set on the web deployment.', 503)
  const load = async (): Promise<CmsSearch> => {
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
        body: JSON.stringify({ q, locale, limit, ...(answerModel ? { answerModel } : {}) }),
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
    let body: SearchResponse
    try {
      body = await parseCmsResponse<SearchResponse>(res, path)
    } catch (error) {
      // A login redirect, a 401 (secrets out of step) or a 500: the CMS side failed.
      throw new AiSearchError(error instanceof Error ? error.message : String(error), 502)
    }
    // The CMS index was empty and is being filled now: an error, so the
    // empty answer is not cached until the next publish.
    if (body.building) throw new AiSearchError('The AI search index is being built.', 503, 'building')
    return {
      // Only excerpts this app can link to (an older CMS sends no kind: notes).
      results: (Array.isArray(body.results) ? body.results : [])
        .map((hit) => ({ ...hit, kind: hit.kind ?? 'post' }))
        .filter((hit) => docPath(hit.kind, hit.slug) !== null),
      answers: Array.isArray(body.answers) ? body.answers : [],
    }
  }
  const kind = answerModel ? `ask:${answerModel}` : 'search'
  return cachedCms(`ai:${kind}:${limit}:${queryKey(locale, q)}`, load)
}

/** Keep an answer Claude wrote in ai.answers on the CMS; failures are logged, never thrown. */
export const saveAnswer = async (
  {
    q,
    locale,
    answerModel,
    sourceKey,
    answer,
  }: AiRequest & { answerModel: string; sourceKey: string; answer: unknown },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  const secret = env('REVALIDATE_SECRET')
  if (!secret) return false
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }
  const bypass = cmsProtectionBypass()
  if (bypass) headers['x-vercel-protection-bypass'] = bypass
  try {
    const res = await fetchImpl(`${cmsURL()}/api/ai/answers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ q, locale, answerModel, sourceKey, answer }),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) console.error(`[ai] answer not kept: CMS answered ${res.status}`)
    return res.ok
  } catch (error) {
    console.error('[ai] answer not kept:', error instanceof Error ? error.message : error)
    return false
  }
}

/** The excerpts nearest to `query` (By meaning). */
export const searchChunks = async (
  query: AiRequest,
  limit: number,
  options: { beforeLoad?: () => Promise<void>; fetchImpl?: typeof fetch } = {},
): Promise<ChunkHit[]> => (await searchCms(query, limit, options)).results

/** One result of a search by meaning: a note or a page. */
export type SearchHit = {
  kind: DocKind
  /** `kind:slug`, the same for every excerpt of one document. */
  key: string
  slug: string
  href: string
  title: string
  heading: string | null
  /** The best matching excerpt, shortened. */
  snippet: string
  score: number
}

const SNIPPET_CHARS = 140

const TABLE_ROW = /^\|.*\|$/
const TABLE_RULE = /^\|(\s*:?-{3,}:?\s*\|)+$/

/**
 * Tables reach the index as Markdown rows (`| a | b |`, apps/cms/src/ai/lexical.ts):
 * cells become `a · b`, rows are joined by ` / `, the `| --- |` line goes.
 */
const flattenTables = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !TABLE_RULE.test(line))
    .map((line) =>
      TABLE_ROW.test(line)
        ? `\u0000${line
            .slice(1, -1)
            .split(/(?<!\\)\|/)
            .map((cell) => cell.trim().replaceAll('\\|', '|'))
            .filter(Boolean)
            .join(' · ')}\u0000`
        : line,
    )
    .join('\n')
    .replace(/\u0000\n\u0000/g, ' / ')
    .replaceAll('\u0000', '')

export const snippetOf = (content: string): string => {
  const flat = flattenTables(content.replace(/```[\s\S]*?```/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > SNIPPET_CHARS ? `${flat.slice(0, SNIPPET_CHARS - 1).trimEnd()}…` : flat
}

/** Results within this distance of the best one are shown. */
const RELATIVE_CUT = 0.15
/** Nothing below this similarity is shown, however few results that leaves. */
const ABSOLUTE_FLOOR = 0.2
const MAX_HITS = 10

/** The same for every excerpt of one document. */
export const hitKey = (chunk: Pick<ChunkHit, 'kind' | 'slug'>): string => `${chunk.kind}:${chunk.slug}`

/**
 * One result per document (its best excerpt), best first, keeping only
 * documents close to the best match: a query about one topic should not list
 * every page just because each is a little similar.
 */
export const rankHits = (chunks: ChunkHit[], locale: Locale): SearchHit[] => {
  const best = new Map<string, ChunkHit>()
  for (const chunk of chunks) {
    const seen = best.get(hitKey(chunk))
    if (!seen || chunk.score > seen.score) best.set(hitKey(chunk), chunk)
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score)
  const top = ranked[0]?.score ?? 0
  return ranked
    .filter((chunk) => chunk.score >= ABSOLUTE_FLOOR && chunk.score >= top - RELATIVE_CUT)
    .slice(0, MAX_HITS)
    .map((chunk) => ({
      kind: chunk.kind,
      key: hitKey(chunk),
      slug: chunk.slug,
      href: localizePath(locale, docPath(chunk.kind, chunk.slug) ?? '/'),
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
 * unrelated to the question (every page is a little similar to anything).
 */
export const relevantChunks = (chunks: ChunkHit[]): ChunkHit[] => {
  const top = chunks.reduce((best, chunk) => Math.max(best, chunk.score), 0)
  return chunks.filter((chunk) => chunk.score >= ANSWER_FLOOR && chunk.score >= top - ANSWER_SPREAD)
}

/**
 * Same-origin check for the browser-facing AI endpoints: a page on another
 * site cannot make a reader's browser spend this site's API budget, and a
 * request that does not come from a page of this site (curl sends neither
 * header) is refused too. Browsers send `Sec-Fetch-Site` and, on a POST,
 * `Origin`; either must say same origin, and neither may say otherwise.
 */
export const isCrossSite = (request: Request): boolean => {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite !== null && fetchSite !== 'same-origin') return true
  const origin = request.headers.get('origin')
  if (!origin) return fetchSite !== 'same-origin'
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
