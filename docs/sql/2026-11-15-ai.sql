-- AI search (1.5.0): the excerpt index, kept answers, and the Site global's AI fields (2026-11-15)
--
-- Replaces 2026-11-13-ai-search.sql and 2026-11-13-ai-answers.sql, which
-- only ever ran on the preview Neon branch. Run this file instead, on the
-- preview branch first, then production, BEFORE deploying the CMS (the Site
-- global reads site_ai_presets). Safe to run more than once, and on a
-- branch that ran the two old files.
--
-- 1. pgvector and the schema `ai`, outside Payload: no Payload migration or
--    schema push reads or changes it (docs/AI_SEARCH.md).
-- 2. `ai.chunks`: excerpts of everything a visitor can read (notes, pages,
--    builds, /about, /stacks) with their embeddings. Filled by the first
--    search after the deploy (or POST /api/ai/reindex as a logged-in user).
--    Same text as SCHEMA_SQL in apps/cms/src/ai/store.ts.
-- 3. `ai.answers`: answers Claude wrote, kept per question and reused while
--    the excerpts they cite are unchanged.
-- 4. `site.ai_model` and `site_ai_presets`: the Site global's "AI search:
--    answer model" and "AI search: suggested questions" (Payload column,
--    enum and table; DDL from a Drizzle push of the config).
-- 5. Drops `ai.post_chunks`, the notes-only index of the old files (rebuilt
--    as ai.chunks on the next search; nothing is lost).
--
-- Requires docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum).
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
END $$;

-- 1-3. The index and the kept answers.
CREATE EXTENSION IF NOT EXISTS vector;
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
);

-- 4. Site global fields.
DO $$
BEGIN
  IF to_regtype('public.enum_site_ai_model') IS NULL THEN
    CREATE TYPE "public"."enum_site_ai_model" AS ENUM('claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5');
  END IF;
END $$;

ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "ai_model" "enum_site_ai_model" DEFAULT 'claude-opus-5-5';

CREATE TABLE IF NOT EXISTS "site_ai_presets" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "_locale" "_locales" NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "question" varchar NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_ai_presets_parent_id_fk') THEN
    ALTER TABLE "site_ai_presets" ADD CONSTRAINT "site_ai_presets_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_ai_presets_order_idx" ON "site_ai_presets" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "site_ai_presets_parent_id_idx" ON "site_ai_presets" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "site_ai_presets_locale_idx" ON "site_ai_presets" USING btree ("_locale");

-- 5. The old notes-only index.
DROP TABLE IF EXISTS ai.post_chunks;

COMMIT;

-- Check: `answers` and `chunks` in schema ai, the vector extension, and the Site column.
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'ai' ORDER BY 1;
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'site' AND column_name = 'ai_model';
