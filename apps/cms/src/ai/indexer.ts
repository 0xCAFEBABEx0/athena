import type { Payload, PayloadRequest } from 'payload'

import { LOCALES, type Locale } from '@athena/shared/constants'

import { buildChunks, chunkHash } from './chunk'
import { type EmbeddingConfig, embed, embeddingConfig, modelId } from './embeddings'
import { lexicalToSections } from './lexical'
import {
  type Db,
  type StoredChunk,
  dbOf,
  deleteOtherPosts,
  deletePostChunks,
  ensureSchema,
  knownVectors,
  replaceChunks,
  storedHashes,
} from './store'

/**
 * Keep ai.post_chunks in step with what the public can read.
 *
 * Posts are read through the Local API exactly as an anonymous visitor would
 * (overrideAccess: false, no user), once per language with the usual English
 * fallback. So the index follows Payload's own idea of "published": after
 * the 4.0 upgrade, where the publish state moves to each language, a post
 * published only in English simply drops out of the ja/zh index (or falls
 * back, whichever Payload does) with no change here.
 *
 * Only chunks whose text changed are sent to the embedding provider, and an
 * excerpt already embedded elsewhere (an untranslated post's English text in
 * ja and zh) reuses that vector.
 */

type PostText = {
  id: string | number
  slug?: string | null
  title?: string | null
  content?: unknown
  meta?: { description?: string | null } | null
}

export type LocaleResult = { chunks: number; embedded: number } | 'removed'
export type IndexResult = { postId: string; locales: Partial<Record<Locale, LocaleResult>> }

const readPublished = async (
  payload: Payload,
  id: string,
  locale: Locale,
  req?: PayloadRequest,
): Promise<PostText | null> => {
  const { docs } = await payload.find({
    collection: 'posts',
    where: { id: { equals: id } },
    locale,
    depth: 0,
    limit: 1,
    pagination: false,
    draft: false,
    overrideAccess: false,
    // Same transaction as the save when the hook runs inline (jobs, scripts).
    ...(req ? { req } : {}),
  })
  return (docs[0] as PostText | undefined) ?? null
}

const indexLocale = async (
  payload: Payload,
  db: Db,
  config: EmbeddingConfig,
  postId: string,
  locale: Locale,
  req?: PayloadRequest,
): Promise<LocaleResult> => {
  const post = await readPublished(payload, postId, locale, req)
  if (!post?.slug) {
    await deletePostChunks(db, postId, locale)
    return 'removed'
  }
  const title = post.title?.trim() || post.slug
  const model = modelId(config)
  const chunks = buildChunks({
    title,
    description: post.meta?.description,
    sections: lexicalToSections(post.content),
  })
  const stored = await storedHashes(db, postId, locale, model)
  const pending = chunks
    .map((chunk) => ({ chunk, hash: chunkHash(chunk.embedText, model) }))
    .filter(({ chunk, hash }) => stored.get(chunk.index) !== hash)

  const known = await knownVectors(
    db,
    pending.map(({ hash }) => hash),
  )
  const missing = pending.filter(({ hash }) => !known.has(hash))
  const vectors = missing.length
    ? await embed(
        config,
        missing.map(({ chunk }) => chunk.embedText),
        'document',
      )
    : []
  missing.forEach(({ hash }, i) => {
    known.set(hash, vectors[i] as number[])
  })
  const changed: StoredChunk[] = pending.map(({ chunk, hash }) => ({
    chunk: chunk.index,
    slug: post.slug as string,
    title,
    heading: chunk.heading,
    content: chunk.content,
    hash,
    embedding: known.get(hash) as number[],
  }))
  await replaceChunks(db, postId, locale, model, { slug: post.slug, title }, changed, chunks.length)
  return { chunks: chunks.length, embedded: missing.length }
}

/** Bring one post's chunks up to date in every language. Null when AI search is not configured. */
export const indexPost = async (
  payload: Payload,
  id: string | number,
  req?: PayloadRequest,
): Promise<IndexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)
  const postId = String(id)
  const result: IndexResult = { postId, locales: {} }
  for (const locale of LOCALES) {
    result.locales[locale] = await indexLocale(payload, db, config, postId, locale, req)
  }
  return result
}

/** Remove a deleted post from the index. */
export const removePost = async (payload: Payload, id: string | number): Promise<void> => {
  const db = dbOf(payload)
  await ensureSchema(db)
  await deletePostChunks(db, String(id))
}

export type ReindexResult = { posts: number; embedded: number; removed: number }

/**
 * Re-check every post the public can read, and drop rows of posts that are
 * gone. Unchanged chunks cost one SELECT each, no embedding call.
 */
export const reindexAll = async (payload: Payload): Promise<ReindexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)

  const ids = new Set<string>()
  for (const locale of LOCALES) {
    const { docs } = await payload.find({
      collection: 'posts',
      locale,
      depth: 0,
      pagination: false,
      draft: false,
      overrideAccess: false,
      select: {},
    })
    for (const doc of docs) ids.add(String(doc.id))
  }

  let embedded = 0
  for (const id of ids) {
    for (const locale of LOCALES) {
      const result = await indexLocale(payload, db, config, id, locale)
      if (result !== 'removed') embedded += result.embedded
    }
  }
  const removed = await deleteOtherPosts(db, [...ids])
  return { posts: ids.size, embedded, removed }
}
