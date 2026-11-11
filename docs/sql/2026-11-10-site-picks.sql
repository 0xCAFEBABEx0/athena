-- X picks on the home page: Site global `picks` list (2026-11-10)
--
-- Adds the `site_picks` list (link plus the post text, author, handle, date
-- and language read from X on save) and its localized `note`. Run on the
-- preview Neon branch first, then production, BEFORE deploying the CMS.
-- Requires docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum). Safe to
-- run more than once.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "site_picks" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "url" varchar NOT NULL,
  "text" varchar,
  "author_name" varchar,
  "author_handle" varchar,
  "posted_at" timestamp(3) with time zone,
  "lang" varchar
);

CREATE TABLE IF NOT EXISTS "site_picks_locales" (
  "note" varchar,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" varchar NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_picks_parent_id_fk') THEN
    ALTER TABLE "site_picks" ADD CONSTRAINT "site_picks_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_picks_locales_parent_id_fk') THEN
    ALTER TABLE "site_picks_locales" ADD CONSTRAINT "site_picks_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."site_picks"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_picks_order_idx" ON "site_picks" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "site_picks_parent_id_idx" ON "site_picks" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "site_picks_locales_parent_id_idx" ON "site_picks_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "site_picks_locales_locale_parent_id_unique" ON "site_picks_locales" USING btree ("_locale", "_parent_id");

COMMIT;
