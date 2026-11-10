-- /work portfolio: `projects` collection + scheduled GitHub sync (2026-11-10)
--
-- Adds the `projects` collection (repositories shown at /work), the
-- `syncGitHub` job task and Payload's job-scheduling table. Run on the
-- preview Neon branch first, then production, BEFORE deploying the CMS.
-- Requires docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum).
-- Safe to run more than once: every statement checks before it creates.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
  IF to_regtype('public.enum_projects_status') IS NULL THEN
    CREATE TYPE "public"."enum_projects_status" AS ENUM('auto', 'working', 'idle', 'done');
  END IF;
END $$;

-- Job task slugs (Payload stores them as enums).
ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'syncGitHub';
ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'syncGitHub';

-- Job scheduling (tasks with a `schedule`).
ALTER TABLE "payload_jobs" ADD COLUMN IF NOT EXISTS "meta" jsonb;
CREATE TABLE IF NOT EXISTS "payload_jobs_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "stats" jsonb,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "repo" varchar NOT NULL,
  "title" varchar,
  "live_url" varchar,
  "status" "enum_projects_status" DEFAULT 'auto' NOT NULL,
  "order" numeric DEFAULT 0,
  "pinned" boolean DEFAULT false,
  "hidden" boolean DEFAULT false,
  "slug" varchar,
  "synced_at" timestamp(3) with time zone,
  "sync_error" varchar,
  "github" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects_locales" (
  "description" varchar,
  "brief" varchar,
  "notes" varchar,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" integer NOT NULL
);

ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "projects_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_locales_parent_id_fk') THEN
    ALTER TABLE "projects_locales" ADD CONSTRAINT "projects_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_projects_fk') THEN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk"
      FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_repo_idx" ON "projects" USING btree ("repo");
CREATE INDEX IF NOT EXISTS "projects_slug_idx" ON "projects" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "projects_created_at_idx" ON "projects" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_locales_locale_parent_id_unique" ON "projects_locales" USING btree ("_locale", "_parent_id");
CREATE INDEX IF NOT EXISTS "projects_locales_parent_id_idx" ON "projects_locales" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");

COMMIT;
