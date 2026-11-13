import type { Payload } from 'payload'

/**
 * The AI search index: one table, ai.post_chunks, in the CMS database.
 *
 * It lives in its own `ai` schema, outside the `public` schema Payload owns,
 * so Payload's dev schema push and its migrations never see it, and a Payload
 * major upgrade (4.0 renames and moves columns) leaves it alone. Nothing here
 * reads Payload's tables: the indexer reads posts through the Local API.
 *
 * Production and the preview Neon branch need SCHEMA_SQL run by hand once
 * (docs/AI_SEARCH.md, docs/UPGRADE_NOTES.md). In local dev it is created on
 * first use.
 */

export const SCHEMA_SQL = `CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE TABLE IF NOT EXISTS ai.post_chunks (
  post_id      text        NOT NULL,
  locale       text        NOT NULL,
  chunk        integer     NOT NULL,
  slug         text        NOT NULL,
  title        text        NOT NULL,
  heading      text,
  content      text        NOT NULL,
  content_hash text        NOT NULL,
  model        text        NOT NULL,
  embedding    vector(1024) NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, locale, chunk)
);
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

/** Postgres "relation does not exist": the index table was never created. */
export const isMissingTable = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42P01'

let ensured: Promise<void> | null = null

/** Create the table in local dev; elsewhere it is created by hand (see SCHEMA_SQL). */
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
  slug: string
  title: string
  heading: string | null
  content: string
  hash: string
  embedding: number[]
}

/** Hash of every stored chunk of one post in one language, by chunk number. */
export const storedHashes = async (
  db: Db,
  postId: string,
  locale: string,
  model: string,
): Promise<Map<number, string>> => {
  const { rows } = await db.query(
    'SELECT chunk, content_hash FROM ai.post_chunks WHERE post_id = $1 AND locale = $2 AND model = $3',
    [postId, locale, model],
  )
  return new Map(rows.map((row) => [Number(row.chunk), String(row.content_hash)]))
}

/**
 * Vectors already stored for these hashes (any post, any language). An
 * untranslated post shows English in ja and zh too, so the same excerpt is
 * stored three times; it is embedded once.
 */
export const knownVectors = async (db: Db, hashes: string[]): Promise<Map<string, number[]>> => {
  if (!hashes.length) return new Map()
  const { rows } = await db.query(
    `SELECT DISTINCT ON (content_hash) content_hash, embedding::text AS embedding
       FROM ai.post_chunks WHERE content_hash = ANY($1::text[])`,
    [hashes],
  )
  return new Map(rows.map((row) => [String(row.content_hash), JSON.parse(String(row.embedding)) as number[]]))
}

/**
 * Make the stored chunks of one post in one language exactly `chunks`:
 * insert or replace them, refresh slug and title on unchanged ones (cheap),
 * and drop chunk numbers past the end and rows of other models.
 */
export const replaceChunks = async (
  db: Db,
  postId: string,
  locale: string,
  model: string,
  meta: { slug: string; title: string },
  changed: StoredChunk[],
  count: number,
): Promise<void> => {
  for (const chunk of changed) {
    await db.query(
      `INSERT INTO ai.post_chunks
         (post_id, locale, chunk, slug, title, heading, content, content_hash, model, embedding, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, now())
       ON CONFLICT (post_id, locale, chunk) DO UPDATE SET
         slug = EXCLUDED.slug, title = EXCLUDED.title, heading = EXCLUDED.heading,
         content = EXCLUDED.content, content_hash = EXCLUDED.content_hash,
         model = EXCLUDED.model, embedding = EXCLUDED.embedding, updated_at = now()`,
      [
        postId,
        locale,
        chunk.chunk,
        chunk.slug,
        chunk.title,
        chunk.heading,
        chunk.content,
        chunk.hash,
        model,
        toVector(chunk.embedding),
      ],
    )
  }
  await db.query(
    'UPDATE ai.post_chunks SET slug = $3, title = $4 WHERE post_id = $1 AND locale = $2 AND (slug <> $3 OR title <> $4)',
    [postId, locale, meta.slug, meta.title],
  )
  await db.query(
    'DELETE FROM ai.post_chunks WHERE post_id = $1 AND locale = $2 AND (chunk >= $3 OR model <> $4)',
    [postId, locale, count, model],
  )
}

/** Drop a post from the index, in one language or (no locale) in all. */
export const deletePostChunks = async (db: Db, postId: string, locale?: string): Promise<void> => {
  if (locale) {
    await db.query('DELETE FROM ai.post_chunks WHERE post_id = $1 AND locale = $2', [postId, locale])
  } else {
    await db.query('DELETE FROM ai.post_chunks WHERE post_id = $1', [postId])
  }
}

/** Drop every post not in `keep` (posts deleted while a hook was missed). */
export const deleteOtherPosts = async (db: Db, keep: string[]): Promise<number> => {
  const { rows } = await db.query(
    'DELETE FROM ai.post_chunks WHERE NOT (post_id = ANY($1::text[])) RETURNING 1',
    [keep],
  )
  return rows.length
}

/** True when no row was written by `model` (a new table, or a new embedding model). */
export const isEmptyFor = async (db: Db, model: string): Promise<boolean> => {
  const { rows } = await db.query('SELECT 1 FROM ai.post_chunks WHERE model = $1 LIMIT 1', [model])
  return rows.length === 0
}

export type ChunkHit = {
  postId: string
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
    `SELECT post_id, slug, title, heading, content, content_hash, 1 - (embedding <=> $1::vector) AS score
       FROM ai.post_chunks
      WHERE locale = $2 AND model = $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
    [toVector(vector), locale, model, limit],
  )
  return rows.map((row) => ({
    postId: String(row.post_id),
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
