-- Home page title tagline: Site global `tagline` (localized), 2026-11-10
--
-- The home page title becomes "<site name> — <tagline>" when it is set.
-- Run on the preview Neon branch first, then production, BEFORE deploying the
-- CMS (Payload reads every column of site_locales, so a missing column breaks
-- the Site global). Requires docs/sql/2026-11-10-whoa-i18n.sql. Safe to run
-- more than once.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.site_locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (table site_locales is missing).';
  END IF;
END $$;

ALTER TABLE "site_locales" ADD COLUMN IF NOT EXISTS "tagline" varchar;

COMMIT;
