-- User roles (1.9.0): `users.role`, editor or service (2026-11-25)
--
-- Every existing user becomes an editor (full rights, as before), except the
-- web app's `web-frontend@service.local` account, which becomes `service`:
-- its API key (PAYLOAD_API_KEY on athena-web) can still read drafts, but can
-- no longer open the admin, manage users or change content. Run on the
-- preview Neon branch first, then production, BEFORE deploying the CMS
-- (Payload reads every users column on login and on each API-key request).
-- Safe to run more than once. DDL from a Drizzle push of the config.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public.enum_users_role') IS NULL THEN
    CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'service');
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'editor' NOT NULL;

UPDATE "users" SET "role" = 'service' WHERE "email" = 'web-frontend@service.local';

COMMIT;
