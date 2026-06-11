import { stringify } from 'qs-esm'

import type { Footer, Header, Page, Post, Redirect, Search } from '@athena/shared/payload-types'

import { cmsURL, env } from './env'

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

const cmsFetch = async <T>(
  path: string,
  query: Record<string, unknown> = {},
  { draft = false }: FetchOptions = {},
): Promise<T> => {
  // Payload REST expects qs-encoded nested params for where/select objects.
  const qs = stringify({ ...query, ...(draft ? { draft: 'true' } : {}) }, { addQueryPrefix: true })

  const headers: HeadersInit = {}
  if (draft) {
    const apiKey = env('PAYLOAD_API_KEY')
    if (!apiKey) throw new Error('PAYLOAD_API_KEY is required to fetch draft content')
    headers.Authorization = `users API-Key ${apiKey}`
  }

  const res = await fetch(`${cmsURL()}/api${path}${qs}`, { headers })
  if (!res.ok) {
    throw new Error(`CMS request failed: ${res.status} ${res.statusText} (${path})`)
  }
  return (await res.json()) as T
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
