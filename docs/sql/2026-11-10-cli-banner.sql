-- CLI banner with Hoo the owl: Site global `banner` group, plus the Site
-- global's default share image `ogImage` (2026-11-10)
--
-- Adds banner.style, banner.mascot, the localized banner.tips list and
-- ogImage (an upload, media id) to the `site` global. Run on the preview Neon branch first, then production,
-- BEFORE deploying the CMS. Requires docs/sql/2026-11-10-whoa-i18n.sql (the
-- `_locales` enum). Safe to run more than once.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
  IF to_regtype('public.enum_site_banner_style') IS NULL THEN
    CREATE TYPE "public"."enum_site_banner_style" AS ENUM('fetch', 'off');
  END IF;
END $$;

ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "banner_style" "enum_site_banner_style" DEFAULT 'fetch';
ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "banner_mascot" boolean DEFAULT true;
ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "og_image_id" integer;

CREATE TABLE IF NOT EXISTS "site_banner_tips" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_banner_tips_locales" (
  "text" varchar NOT NULL,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" varchar NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_og_image_id_media_id_fk') THEN
    ALTER TABLE "site" ADD CONSTRAINT "site_og_image_id_media_id_fk"
      FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_banner_tips_parent_id_fk') THEN
    ALTER TABLE "site_banner_tips" ADD CONSTRAINT "site_banner_tips_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_banner_tips_locales_parent_id_fk') THEN
    ALTER TABLE "site_banner_tips_locales" ADD CONSTRAINT "site_banner_tips_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."site_banner_tips"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "site_og_image_idx" ON "site" USING btree ("og_image_id");
CREATE INDEX IF NOT EXISTS "site_banner_tips_order_idx" ON "site_banner_tips" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "site_banner_tips_parent_id_idx" ON "site_banner_tips" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "site_banner_tips_locales_parent_id_idx" ON "site_banner_tips_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "site_banner_tips_locales_locale_parent_id_unique" ON "site_banner_tips_locales" USING btree ("_locale", "_parent_id");

COMMIT;
