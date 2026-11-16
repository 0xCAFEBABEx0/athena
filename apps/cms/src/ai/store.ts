import type { Payload } from 'payload'

/**
 * The AI search index: ai.chunks (excerpts of everything a visitor can read:
 * notes, pages, builds, /about, /stacks) and ai.answers (answers kept for
 * reuse), in the CMS database.
 *
 * They live in their own `ai` schema, outside the `public` schema Payload
 * owns, so Payload's dev schema push and its migrations never see them, and a
 * Payload major upgrade (4.0 renames and moves columns) leaves them alone.
 * Nothing here reads Payload's tables: the indexer reads documents through
 * the Local API.
 *
 * One table for every kind of document: `kind` + `doc_id` say where an
 * excerpt comes from, and the web app turns `kind` + `slug` into a link, so
 * a section rename (ROUTES) never needs a reindex.
 *
 * Production and the preview Neon branch need docs/sql/2026-11-15-ai.sql run
 * by hand once (docs/AI_SEARCH.md, docs/UPGRADE_NOTES.md). In local dev the
 * tables are created on first use.
 */

/** What an excerpt belongs to. Globals use their own slug as `doc_id`. */
export const DOC_KINDS = ['post', 'page', 'project', 'about', 'stack'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const SCHEMA_SQL = `CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE TABLE IF NOT EXISTS ai.chunks (
  kind         text        NOT NULL,
  doc_id       text        NOT NULL,
  locale       text        NOT NULL,
  chunk        integer     NOT NULL,
  slug         text        NOT NULL DEFAULT '',
  title        text        NOT NULL,
  heading      text,
  content      text        NOT NULL,
  content_hash text        NOT NULL,
  model        text        NOT NULL,
  embedding    vector(1024) NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, doc_id, locale, chunk)
);
CREATE INDEX IF NOT EXISTS chunks_content_hash_idx ON ai.chunks (content_hash);
CREATE TABLE IF NOT EXISTS ai.answers (
  locale       text        NOT NULL,
  question     text        NOT NULL,
  answer_model text        NOT NULL,
  model        text        NOT NULL,
  embedding    vector(1024) NOT NULL,
  source_key   text        NOT NULL,
  answer       jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (locale, question, answer_model)
);`

/** The one thing taken from the database adapter: a pg-style query function. */
export type Db = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
}

/**
 * The connection pool of @payloadcms/db-postgres. If a Payload upgrade moves
 * it, this is the only line to change.
 */
export const dbOf = (payload: Payload): Db => {
  const pool = (payload.db as unknown as { pool?: Partial<Db> }).pool
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('AI search needs the Postgres adapter connection pool (payload.db.pool)')
  }
  return pool as Db
}

type PoolClient = Db & { release: () => void }

/**
 * Run `task` in one transaction on one pooled connection: all of its writes
 * land together or not at all. With `lock`, only one transaction holding
 * that key runs at a time: with `wait` the next one waits its turn,
 * otherwise it gets `null` at once.
 */
export const inTransaction = async <T>(
  payload: Payload,
  task: (db: Db) => Promise<T>,
  lock?: { key: string; wait?: boolean },
): Promise<T | null> => {
  const pool = dbOf(payload) as Db & { connect?: () => Promise<PoolClient> }
  if (typeof pool.connect !== 'function') throw new Error('AI search needs a pg Pool with connect()')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (lock?.wait) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lock.key])
    } else if (lock) {
      const { rows } = await client.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked', [lock.key])
      if (!rows[0]?.locked) {
        await client.query('ROLLBACK')
        return null
      }
    }
    const result = await task(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

/** Postgres "relation does not exist": the index tables were never created. */
export const isMissingTable = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42P01'

let ensured: Promise<void> | null = null

/** Create the tables in local dev; elsewhere they are created by hand (see SCHEMA_SQL). */
export const ensureSchema = (db: Db): Promise<void> => {
  if (process.env.NODE_ENV === 'production') return Promise.resolve()
  ensured ??= db.query(SCHEMA_SQL).then(
    () => undefined,
    (error: unknown) => {
      ensured = null
      throw error
    },
  )
  return ensured
}

const toVector = (values: number[]): string => `[${values.join(',')}]`

export type StoredChunk = {
  chunk: number
  heading: string | null
  content: string
  hash: string
  embedding: number[]
}

/** One document in the index: a post, a page, a build, or a global (about, stack). */
export type DocRef = { kind: DocKind; id: string }

/** Hash of every stored chunk of one document in one language, by chunk number. */
export const storedHashes = async (db: Db, doc: DocRef, locale: string, model: string): Promise<Map<number, string>> => {
  const { rows } = await db.query(
    'SELECT chunk, content_hash FROM ai.chunks WHERE kind = $1 AND doc_id = $2 AND locale = $3 AND model = $4',
    [doc.kind, doc.id, locale, model],
  )
  return new Map(rows.map((row) => [Number(row.chunk), String(row.content_hash)]))
}

/**
 * Vectors already stored for these hashes (any document, any language). An
 * untranslated document shows English in ja and zh too, so the same excerpt
 * is stored three times; it is embedded once.
 */
export const knownVectors = async (db: Db, hashes: string[]): Promise<Map<string, number[]>> => {
  if (!hashes.length) return new Map()
  const { rows } = await db.query(
    `SELECT DISTINCT ON (content_hash) content_hash, embedding::text AS embedding
       FROM ai.chunks WHERE content_hash = ANY($1::text[])`,
    [hashes],
  )
  return new Map(rows.map((row) => [String(row.content_hash), JSON.parse(String(row.embedding)) as number[]]))
}

/**
 * Make the stored chunks of one document in one language exactly `chunks`:
 * insert or replace them, refresh slug and title on unchanged ones (cheap),
 * and drop chunk numbers past the end and rows of other models. Returns how
 * many rows changed (0: what visitors find did not change).
 */
export const replaceChunks = async (
  db: Db,
  doc: DocRef,
  locale: string,
  model: string,
  meta: { slug: string; title: string },
  changed: StoredChunk[],
  count: number,
): Promise<number> => {
  for (const chunk of changed) {
    await db.query(
      `INSERT INTO ai.chunks
         (kind, doc_id, locale, chunk, slug, title, heading, content, content_hash, model, embedding, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, now())
       ON CONFLICT (kind, doc_id, locale, chunk) DO UPDATE SET
         slug = EXCLUDED.slug, title = EXCLUDED.title, heading = EXCLUDED.heading,
         content = EXCLUDED.content, content_hash = EXCLUDED.content_hash,
         model = EXCLUDED.model, embedding = EXCLUDED.embedding, updated_at = now()`,
      [
        doc.kind,
        doc.id,
        locale,
        chunk.chunk,
        meta.slug,
        meta.title,
        chunk.heading,
        chunk.content,
        chunk.hash,
        model,
        toVector(chunk.embedding),
      ],
    )
  }
  const renamed = await db.query(
    `UPDATE ai.chunks SET slug = $4, title = $5
      WHERE kind = $1 AND doc_id = $2 AND locale = $3 AND (slug <> $4 OR title <> $5)
      RETURNING 1`,
    [doc.kind, doc.id, locale, meta.slug, meta.title],
  )
  const dropped = await db.query(
    `DELETE FROM ai.chunks WHERE kind = $1 AND doc_id = $2 AND locale = $3 AND (chunk >= $4 OR model <> $5)
      RETURNING 1`,
    [doc.kind, doc.id, locale, count, model],
  )
  return changed.length + renamed.rows.length + dropped.rows.length
}

/** Drop a document from the index, in one language or (no locale) in all; returns the rows removed. */
export const deleteDocChunks = async (db: Db, doc: DocRef, locale?: string): Promise<number> => {
  const { rows } = locale
    ? await db.query('DELETE FROM ai.chunks WHERE kind = $1 AND doc_id = $2 AND locale = $3 RETURNING 1', [
        doc.kind,
        doc.id,
        locale,
      ])
    : await db.query('DELETE FROM ai.chunks WHERE kind = $1 AND doc_id = $2 RETURNING 1', [doc.kind, doc.id])
  return rows.length
}

/**
 * Documents of `kind` in the index but not in `keep`: deleted or hidden while
 * a hook was missed, or published since `keep` was listed. The caller checks
 * each one again before removing it.
 */
export const otherDocIds = async (db: Db, kind: DocKind, keep: string[]): Promise<string[]> => {
  const { rows } = await db.query(
    'SELECT DISTINCT doc_id FROM ai.chunks WHERE kind = $1 AND NOT (doc_id = ANY($2::text[]))',
    [kind, keep],
  )
  return rows.map((row) => String(row.doc_id))
}

/** Drop rows of kinds no longer indexed; returns the rows removed. */
export const deleteUnknownKinds = async (db: Db): Promise<number> => {
  const { rows } = await db.query('DELETE FROM ai.chunks WHERE NOT (kind = ANY($1::text[])) RETURNING 1', [
    [...DOC_KINDS],
  ])
  return rows.length
}

/** True when no row was written by `model` (a new table, or a new embedding model). */
export const isEmptyFor = async (db: Db, model: string): Promise<boolean> => {
  const { rows } = await db.query('SELECT 1 FROM ai.chunks WHERE model = $1 LIMIT 1', [model])
  return rows.length === 0
}

export type ChunkHit = {
  kind: DocKind
  docId: string
  /** '' for about and stack. */
  slug: string
  title: string
  heading: string | null
  content: string
  /** content_hash: changes when the excerpt's text (or the model) changes. */
  hash: string
  /** Cosine similarity, 1 = same direction. */
  score: number
}

/** The `limit` chunks nearest to `vector` in one language. */
export const nearestChunks = async (
  db: Db,
  vector: number[],
  locale: string,
  model: string,
  limit: number,
): Promise<ChunkHit[]> => {
  // Exact search (no ANN index): a few hundred rows scan in well under a
  // millisecond, and an HNSW index combined with the locale filter can
  // return fewer than `limit` rows. Add one when the table reaches ~10k rows.
  const { rows } = await db.query(
    `SELECT kind, doc_id, slug, title, heading, content, content_hash, 1 - (embedding <=> $1::vector) AS score
       FROM ai.chunks
      WHERE locale = $2 AND model = $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
    [toVector(vector), locale, model, limit],
  )
  return rows.map((row) => ({
    kind: String(row.kind) as DocKind,
    docId: String(row.doc_id),
    slug: String(row.slug),
    title: String(row.title),
    heading: row.heading == null ? null : String(row.heading),
    content: String(row.content),
    hash: String(row.content_hash),
    score: Number(row.score),
  }))
}

/**
 * A question is the same as one answered before when it is written the same
 * (case and spacing aside) or means nearly the same: at least this cosine
 * similarity. The web app still reuses the answer only when it would be
 * written from the same excerpts (source_key).
 */
export const SAME_QUESTION = 0.95

export type StoredAnswerRow = { question: string; sourceKey: string; answer: unknown; similarity: number }

/** Answers kept for this question or one that means nearly the same, the same wording first. */
export const storedAnswers = async (
  db: Db,
  { vector, locale, question, answerModel, model }: { vector: number[]; locale: string; question: string; answerModel: string; model: string },
): Promise<StoredAnswerRow[]> => {
  const { rows } = await db.query(
    `SELECT question, source_key, answer, 1 - (embedding <=> $1::vector) AS similarity
       FROM ai.answers
      WHERE locale = $2 AND answer_model = $3 AND model = $4
        AND (question = $5 OR 1 - (embedding <=> $1::vector) >= $6)
      ORDER BY (question = $5) DESC, embedding <=> $1::vector
      LIMIT 3`,
    [toVector(vector), locale, answerModel, model, question, SAME_QUESTION],
  )
  return rows.map((row) => ({
    question: String(row.question),
    sourceKey: String(row.source_key),
    answer: row.answer,
    similarity: Number(row.similarity),
  }))
}

/** Keep an answer (replacing the one for the same question), and drop answers not written for half a year. */
export const saveAnswer = async (
  db: Db,
  row: { locale: string; question: string; answerModel: string; model: string; vector: number[]; sourceKey: string; answer: unknown },
): Promise<void> => {
  await db.query(
    `INSERT INTO ai.answers (locale, question, answer_model, model, embedding, source_key, answer, created_at)
     VALUES ($1, $2, $3, $4, $5::vector, $6, $7::jsonb, now())
     ON CONFLICT (locale, question, answer_model) DO UPDATE SET
       model = EXCLUDED.model, embedding = EXCLUDED.embedding, source_key = EXCLUDED.source_key,
       answer = EXCLUDED.answer, created_at = now()`,
    [row.locale, row.question, row.answerModel, row.model, toVector(row.vector), row.sourceKey, JSON.stringify(row.answer)],
  )
  await db.query("DELETE FROM ai.answers WHERE created_at < now() - interval '180 days'")
}
