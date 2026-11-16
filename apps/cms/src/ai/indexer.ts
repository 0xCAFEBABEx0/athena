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
  deleteUnknownKinds,
  ensureSchema,
  inTransaction,
  isEmptyFor,
  knownVectors,
  otherDocIds,
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
  /** Rows written or removed: when > 0, what a search finds changed (cached results are stale). */
  changed: number
  /** Set when nothing was done because the index has not been built yet (the first search builds it all). */
  waiting?: true
}

type Indexed = { result: LocaleResult; changed: number }

const indexLocale = async (
  payload: Payload,
  db: Db,
  config: EmbeddingConfig,
  doc: DocRef,
  locale: Locale,
  req?: PayloadRequest,
): Promise<Indexed> => {
  const source = await READERS[doc.kind](payload, doc.id, locale, req)
  if (!source) return { result: 'removed', changed: await deleteDocChunks(db, doc, locale) }
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
  const written = await replaceChunks(
    db,
    doc,
    locale,
    model,
    { slug: source.slug, title: source.title },
    changed,
    chunks.length,
  )
  return { result: { chunks: chunks.length, embedded: missing.length }, changed: written }
}

/**
 * Bring one document's chunks up to date in every language. Null when AI
 * search is not configured.
 *
 * With `untilBuilt` (the save hooks), nothing is done while the index holds
 * no row of the current model: the first search builds the whole index, and
 * a save before it must not leave a few rows that make the index look built.
 */
export const indexDoc = async (
  payload: Payload,
  kind: DocKind,
  id: string | number,
  req?: PayloadRequest,
  options: { untilBuilt?: boolean } = {},
): Promise<IndexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)
  const doc: DocRef = { kind, id: String(id) }
  const result: IndexResult = { kind, id: doc.id, locales: {}, changed: 0 }
  if (options.untilBuilt && (await isEmptyFor(db, modelId(config)))) return { ...result, waiting: true }
  // One update of a document at a time, each reading the document only once
  // it holds the lock: a publish still waiting on its embeddings can then not
  // write its text back after a later unpublish or delete removed it.
  return inTransaction(
    payload,
    async (locked) => {
      for (const locale of LOCALES) {
        const { result: done, changed } = await indexLocale(payload, locked, config, doc, locale, req)
        result.locales[locale] = done
        result.changed += changed
      }
      return result
    },
    { key: docLockKey(doc), wait: true },
  )
}

const docLockKey = (doc: DocRef) => `ai.chunks ${doc.kind} ${doc.id}`

/** Remove a deleted document from the index; returns the rows removed. */
export const removeDoc = async (
  payload: Payload,
  kind: DocKind,
  id: string | number,
): Promise<number> => {
  await ensureSchema(dbOf(payload))
  const doc: DocRef = { kind, id: String(id) }
  return (
    (await inTransaction(payload, (locked) => deleteDocChunks(locked, doc), { key: docLockKey(doc), wait: true })) ?? 0
  )
}

export type ReindexResult = { docs: number; embedded: number; removed: number }

const BUILD_LOCK = 'ai.chunks first build'

/**
 * Re-check every document the public can read, and drop rows of documents
 * that are gone. Unchanged chunks cost one SELECT each, no embedding call.
 *
 * With `atomic` (the first build, started by a search on an empty index),
 * every write lands in one transaction: a build that fails half way leaves
 * the index empty, so the next search starts it again instead of finding a
 * partial index that looks built. Only one atomic build runs at a time; a
 * second one returns null at once.
 */
export const reindexAll = async (
  payload: Payload,
  options: { atomic?: boolean } = {},
): Promise<ReindexResult | null> => {
  const config = embeddingConfig()
  if (!config) return null
  const db = dbOf(payload)
  await ensureSchema(db)
  if (options.atomic) {
    return inTransaction(payload, (locked) => reindexInto(payload, locked, config, true), { key: BUILD_LOCK })
  }
  return reindexInto(payload, db, config, false)
}

/**
 * Each document is updated under its own lock (see indexDoc): inside the
 * atomic build's transaction, or in a short transaction of its own. A
 * document in the index but not in the list read at the start is read again
 * under its lock before its rows go, so one published meanwhile (and indexed
 * by its hook) stays.
 */
const reindexInto = async (
  payload: Payload,
  db: Db,
  config: EmbeddingConfig,
  inside: boolean,
): Promise<ReindexResult> => {
  const indexAllLocales = async (target: Db, doc: DocRef) => {
    let shown = false
    let count = 0
    let dropped = 0
    for (const locale of LOCALES) {
      const { result, changed } = await indexLocale(payload, target, config, doc, locale)
      if (result === 'removed') {
        dropped += changed
      } else {
        shown = true
        count += result.embedded
      }
    }
    return { shown, count, dropped }
  }
  const underLock = async (doc: DocRef) => {
    const lock = { key: docLockKey(doc), wait: true }
    if (!inside) return inTransaction(payload, (locked) => indexAllLocales(locked, doc), lock)
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lock.key])
    return indexAllLocales(db, doc)
  }
  let docs = 0
  let embedded = 0
  let removed = 0
  for (const kind of DOC_KINDS) {
    const ids = new Set<string>()
    for (const locale of LOCALES) {
      for (const id of await listIds(payload, kind, locale)) ids.add(id)
    }
    for (const id of ids) {
      const done = await underLock({ kind, id })
      if (done?.shown) docs += 1
      embedded += done?.count ?? 0
    }
    for (const id of await otherDocIds(db, kind, [...ids])) {
      const done = await underLock({ kind, id })
      removed += done?.dropped ?? 0
      if (done?.shown) {
        docs += 1
        embedded += done.count
      }
    }
  }
  removed += await deleteUnknownKinds(db)
  return { docs, embedded, removed }
}
