import { stringify } from 'qs-esm'

import type { Footer, Header, Page, Post, Redirect, Search } from '@athena/shared/payload-types'

import { cmsProtectionBypass, cmsURL, env } from './env'

/** Shape of Payload's paginated REST responses. */
export type PaginatedDocs<T> = {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: number | null
  prevPage: number | null
}

type FetchOptions = {
  /**
   * Fetch the newest draft version instead of the published one. Requires
   * the `web-frontend` service account's API key (PAYLOAD_API_KEY), since
   * Payload only serves drafts to authenticated users. Server-side only.
   */
  draft?: boolean
}

export class CmsRequestError extends Error {
  readonly status: number
  readonly path: string

  constructor(message: string, { status, path }: { status: number; path: string }) {
    super(message)
    this.name = 'CmsRequestError'
    this.status = status
    this.path = path
  }
}

/** True when a Location / final URL is Vercel's Deployment Protection SSO. */
export const isVercelSsoLocation = (location: string | null | undefined): boolean => {
  if (!location) return false
  try {
    const url = new URL(location, 'https://vercel.com')
    if (url.hostname !== 'vercel.com') return false
    return url.pathname === '/sso-api' || url.pathname.startsWith('/sso-api/') || url.pathname === '/login'
  } catch {
    return false
  }
}

const ssoError = (path: string, status: number): CmsRequestError =>
  new CmsRequestError(
    `CMS is blocked by Vercel Deployment Protection (${path}). ` +
      'Disable Production protection on the athena-cms project, or set CMS_PROTECTION_BYPASS on athena-web.',
    { status, path },
  )

/**
 * Validate a CMS HTTP response and parse JSON. Exported for unit tests.
 *
 * Default `fetch` follows Vercel SSO 302s to a 200 login HTML page, so
 * `res.ok` is true and `res.json()` throws a SyntaxError — that surfaces on
 * Vercel as FUNCTION_INVOCATION_FAILED. Catch the SSO/HTML cases first.
 */
export const parseCmsResponse = async <T>(res: Response, path: string): Promise<T> => {
  if (isVercelSsoLocation(res.headers.get('location')) || isVercelSsoLocation(res.url)) {
    throw ssoError(path, res.status)
  }

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location') ?? 'unknown'
    throw new CmsRequestError(`CMS request redirected: ${res.status} → ${location} (${path})`, {
      status: res.status,
      path,
    })
  }

  if (!res.ok) {
    throw new CmsRequestError(`CMS request failed: ${res.status} ${res.statusText} (${path})`, {
      status: res.status,
      path,
    })
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw new CmsRequestError(
      `CMS returned non-JSON content-type "${contentType || 'unknown'}" (${path})`,
      { status: res.status, path },
    )
  }

  try {
    return (await res.json()) as T
  } catch (error) {
    throw new CmsRequestError(
      `CMS returned invalid JSON (${path}): ${error instanceof Error ? error.message : String(error)}`,
      { status: res.status, path },
    )
  }
}

const cmsHeaders = (draft: boolean): Headers => {
  const headers = new Headers()
  const bypass = cmsProtectionBypass()
  if (bypass) {
    headers.set('x-vercel-protection-bypass', bypass)
  }
  if (draft) {
    const apiKey = env('PAYLOAD_API_KEY')
    if (!apiKey) throw new Error('PAYLOAD_API_KEY is required to fetch draft content')
    headers.set('Authorization', `users API-Key ${apiKey}`)
  }
  return headers
}

const cmsFetch = async <T>(
  path: string,
  query: Record<string, unknown> = {},
  { draft = false }: FetchOptions = {},
): Promise<T> => {
  // Payload REST expects qs-encoded nested params for where/select objects.
  const qs = stringify({ ...query, ...(draft ? { draft: 'true' } : {}) }, { addQueryPrefix: true })
  const origin = cmsURL()
  const url = `${origin}/api${path}${qs}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: cmsHeaders(draft),
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    if (error instanceof CmsRequestError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new CmsRequestError(`CMS unreachable at ${origin} (${path}): ${message}`, {
      status: 0,
      path,
    })
  }

  try {
    return await parseCmsResponse<T>(res, path)
  } catch (error) {
    console.error('[cms]', error instanceof Error ? error.message : error)
    throw error
  }
}

export const getPage = async (slug: string, opts: FetchOptions = {}): Promise<Page | null> => {
  const result = await cmsFetch<PaginatedDocs<Page>>(
    '/pages',
    { where: { slug: { equals: slug } }, depth: 2, limit: 1, pagination: false },
    opts,
  )
  return result.docs[0] ?? null
}

export const getPost = async (slug: string, opts: FetchOptions = {}): Promise<Post | null> => {
  const result = await cmsFetch<PaginatedDocs<Post>>(
    '/posts',
    { where: { slug: { equals: slug } }, depth: 2, limit: 1, pagination: false },
    opts,
  )
  return result.docs[0] ?? null
}

export const POSTS_PER_PAGE = 12

export const getPosts = async (
  { page = 1, limit = POSTS_PER_PAGE }: { page?: number; limit?: number } = {},
  opts: FetchOptions = {},
): Promise<PaginatedDocs<Post>> =>
  cmsFetch<PaginatedDocs<Post>>(
    '/posts',
    {
      depth: 1,
      limit,
      page,
      sort: '-publishedAt',
      select: {
        title: true,
        slug: true,
        categories: true,
        meta: true,
      },
    },
    opts,
  )

/** Posts for the Archive block (populateBy=collection), optionally category-filtered. */
export const getArchivePosts = async ({
  categoryIds = [],
  limit = 3,
}: {
  categoryIds?: (number | string)[]
  limit?: number
}): Promise<Post[]> => {
  const result = await cmsFetch<PaginatedDocs<Post>>('/posts', {
    depth: 1,
    limit,
    ...(categoryIds.length > 0 ? { where: { categories: { in: categoryIds } } } : {}),
  })
  return result.docs
}

export const getGlobal = async <T extends Header | Footer>(
  slug: 'header' | 'footer',
  opts: FetchOptions = {},
): Promise<T> => cmsFetch<T>(`/globals/${slug}`, { depth: 1 }, opts)

export const searchPosts = async (q: string): Promise<PaginatedDocs<Search>> => {
  const like = q.trim()
  return cmsFetch<PaginatedDocs<Search>>('/search', {
    depth: 1,
    limit: 12,
    select: { title: true, slug: true, categories: true, meta: true },
    ...(like
      ? {
          where: {
            or: [
              { title: { like } },
              { 'meta.description': { like } },
              { 'meta.title': { like } },
              { slug: { like } },
            ],
          },
        }
      : {}),
  })
}

export const getRedirects = async (): Promise<Redirect[]> => {
  const result = await cmsFetch<PaginatedDocs<Redirect>>('/redirects', {
    depth: 1,
    limit: 0,
    pagination: false,
  })
  return result.docs
}

/** Slim slug listing for sitemaps and static-path generation. */
export const getAllSlugs = async (
  collection: 'pages' | 'posts',
): Promise<Array<{ slug?: string | null; updatedAt: string }>> => {
  const result = await cmsFetch<PaginatedDocs<{ slug?: string | null; updatedAt: string }>>(
    `/${collection}`,
    {
      depth: 0,
      limit: 0,
      pagination: false,
      select: { slug: true, updatedAt: true },
      where: { _status: { equals: 'published' } },
    },
  )
  return result.docs
}
