-- AI search on /search: the post excerpt index (2026-11-13)
--
-- Enables pgvector and creates `ai.post_chunks`, the excerpts of public posts
-- with their embeddings (docs/AI_SEARCH.md). It lives in its own schema `ai`,
-- outside Payload: no Payload migration or schema push reads or changes it.
-- Run on the preview Neon branch first, then production. Order with the
-- deploy does not matter: without the table the CMS logs a warning on publish
-- and /api/ai/search answers 503; nothing else changes. The rows are filled
-- by the first search after the deploy (or POST /api/ai/reindex as an admin).
-- Safe to run more than once. Same text as SCHEMA_SQL in
-- apps/cms/src/ai/store.ts.
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
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

COMMIT;

-- Check: one row, `post_chunks`, and the vector extension listed.
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'ai';
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
