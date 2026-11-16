-- /about page: the About global (2026-11-12)
--
-- Adds the `about` global (portrait in Media) and its localized fields
-- (heading, lead, portrait caption, story as Lexical JSON) in
-- `about_locales`. Run on the preview Neon branch first, then production,
-- BEFORE deploying the CMS. The web app answers 404 on /about until the
-- global has a lead or a story, so deploying the web app first is safe.
-- Requires docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum). Safe to
-- run more than once. DDL taken from a Drizzle push of the new config, diffed
-- against the previous one.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "about" (
  "id" serial PRIMARY KEY NOT NULL,
  "portrait_id" integer,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "about_locales" (
  "heading" varchar,
  "lead" varchar,
  "portrait_caption" varchar,
  "body" jsonb,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" integer NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'about_portrait_id_media_id_fk') THEN
    ALTER TABLE "about" ADD CONSTRAINT "about_portrait_id_media_id_fk"
      FOREIGN KEY ("portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'about_locales_parent_id_fk') THEN
    ALTER TABLE "about_locales" ADD CONSTRAINT "about_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "about_portrait_idx" ON "about" USING btree ("portrait_id");
CREATE INDEX IF NOT EXISTS "about_locales_parent_id_idx" ON "about_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "about_locales_locale_parent_id_unique" ON "about_locales" USING btree ("_locale", "_parent_id");

COMMIT;
