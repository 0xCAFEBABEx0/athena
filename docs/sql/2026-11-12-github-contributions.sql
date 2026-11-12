-- GitHub contribution graph on the home page: Site global `github` group, 2026-11-12
--
-- Adds the GitHub username, the stored calendar and its sync status to the
-- `site` table. Run on the preview Neon branch first, then production,
-- BEFORE deploying the CMS (Payload reads every column of `site`, so a
-- missing column breaks the Site global and the web app falls back to its
-- defaults). Safe to run more than once.
BEGIN;

ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "github_username" varchar;
ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "github_synced_at" timestamp(3) with time zone;
ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "github_sync_error" varchar;
ALTER TABLE "site" ADD COLUMN IF NOT EXISTS "github_contributions" jsonb;

COMMIT;
