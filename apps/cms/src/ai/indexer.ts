import type { Payload, PayloadRequest } from 'payload'

import { LOCALES, type Locale } from '@athena/shared/constants'

import { buildChunks, chunkHash } from './chunk'
import { type EmbeddingConfig, embed, embeddingConfig, modelId } from './embeddings'
import { READERS, listIds } from './sources'
import {
  DOC_KINDS,
  type Db,
  type DocKind,
  type DocRef,
  type StoredChunk,
  dbOf,
  deleteDocChunks,
  deleteOtherDocs,
  ensureSchema,
  knownVectors,
  replaceChunks,
  storedHashes,
} from './store'

/**
 * Keep ai.chunks in step with what the public can read: notes, pages,
 * builds, /about and /stacks (sources.ts reads each as a visitor would).
 *
 * So the index follows Payload's own idea of "published": after the 4.0
 * upgrade, where the publish state moves to each language, a document
 * published only in English simply drops out of the ja/zh index (or falls
 * back, whichever Payload does) with no change here.
 *
 * Only chunks whose text changed are sent to the embedding provider, and an
 * excerpt already embedded elsewhere (an untranslated document's English
 * text in ja and zh) reuses that vector.
 */

export type LocaleResult = { chunks: number; embedded: number } | 'removed'
export type IndexResult = {
  kind: DocKind
  id: string
  locales: Partial<Record<Locale, LocaleResult>>
}

const indexLocale = async (
  payload: Payload,
  db: Db,
  config: EmbeddingConfig,
  doc: DocRef,
  locale: Locale,
  req?: PayloadRequest,
): Promise<LocaleResult> => {
  const source = await READERS[doc.kind](payload, doc.id, locale, req)
  if (!source) {
    await deleteDocChunks(db, doc, locale)
    return 'removed'
  }
  const model = modelId(config)
  const chunks = buildChunks({
    title: source.title,
    description: source.description,
    sections: source.sections,
  })
  const stored = await storedHashes(db, doc, locale, model)
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
    heading: chunk.heading,
    content: chunk.content,
    hash,
    embedding: known.get(hash) as number[],
  }))
  await replaceChunks(
    db,
    doc,
    locale,
    model,
    { slug: source.slug, title: source.title },
    changed,
    chunks.length,
  )
  return { chunks: chunks.length, embedded: missing.length }
}

/** Bring one document's chunks up to date in every language. Null when AI search is not configured. */
export const indexDoc = async (
  payload: Payload,
  kind: DocKind,
  id: string | number,
  req?: PayloadRequest,
): Promise<IndexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)
  const doc: DocRef = { kind, id: String(id) }
  const result: IndexResult = { kind, id: doc.id, locales: {} }
  for (const locale of LOCALES) {
    result.locales[locale] = await indexLocale(payload, db, config, doc, locale, req)
  }
  return result
}

/** Remove a deleted document from the index. */
export const removeDoc = async (
  payload: Payload,
  kind: DocKind,
  id: string | number,
): Promise<void> => {
  const db = dbOf(payload)
  await ensureSchema(db)
  await deleteDocChunks(db, { kind, id: String(id) })
}

export type ReindexResult = { docs: number; embedded: number; removed: number }

/**
 * Re-check every document the public can read, and drop rows of documents
 * that are gone. Unchanged chunks cost one SELECT each, no embedding call.
 */
export const reindexAll = async (payload: Payload): Promise<ReindexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)

  let docs = 0
  let embedded = 0
  let removed = 0
  for (const kind of DOC_KINDS) {
    const ids = new Set<string>()
    for (const locale of LOCALES) {
      for (const id of await listIds(payload, kind, locale)) ids.add(id)
    }
    for (const id of ids) {
      let shown = false
      for (const locale of LOCALES) {
        const result = await indexLocale(payload, db, config, { kind, id }, locale)
        if (result !== 'removed') {
          shown = true
          embedded += result.embedded
        }
      }
      if (shown) docs += 1
    }
    removed += await deleteOtherDocs(db, kind, [...ids])
  }
  return { docs, embedded, removed }
}
