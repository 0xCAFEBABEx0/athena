-- AI search: answer model, suggested questions and kept answers (2026-11-13, after 2026-11-13-ai-search.sql)
--
-- 0. `site.ai_model`: the Site global's "AI search: answer model" select
--    (Payload column and enum; changing the model needs no deploy).
-- 1. `site_ai_presets`: the Site global's localized "AI search: suggested
--    questions" list (Payload table; DDL from a Drizzle push of the new
--    config, diffed against the previous one).
-- 2. `ai.answers`: answers Claude wrote, kept per question and reused while
--    the excerpts they cite are unchanged (outside Payload, like
--    ai.post_chunks; docs/AI_SEARCH.md).
-- Run on the preview Neon branch first, then production, BEFORE deploying
-- the CMS (the Site global reads site_ai_presets). Requires
-- docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum) and
-- docs/sql/2026-11-13-ai-search.sql (pgvector, schema `ai`). Safe to run
-- more than once.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
  IF to_regtype('vector') IS NULL OR to_regnamespace('ai') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-13-ai-search.sql first (pgvector or schema ai is missing).';
  END IF;
END $$;

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

COMMIT;
