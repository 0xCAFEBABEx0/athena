-- /stack page: the Stack global (2026-11-12)
--
-- Adds the `stack` global (intro), its `groups` (title, description) and
-- their `items` (name, link, note, year, status, favicon in Media). Localized
-- fields live in the `_locales` tables. Run on the preview Neon branch first,
-- then production, BEFORE deploying the CMS. The web app answers 404 on
-- /stack until the global has an item, so deploying the web app first is safe.
-- Requires docs/sql/2026-11-10-whoa-i18n.sql (the `_locales` enum). Safe to
-- run more than once. DDL taken from a Drizzle push of the new config, diffed
-- against the previous one.
BEGIN;

DO $$
BEGIN
  IF to_regtype('public._locales') IS NULL THEN
    RAISE EXCEPTION 'Run docs/sql/2026-11-10-whoa-i18n.sql first (type _locales is missing).';
  END IF;
  IF to_regtype('public.enum_stack_groups_items_status') IS NULL THEN
    CREATE TYPE "public"."enum_stack_groups_items_status" AS ENUM ('current', 'trying', 'former');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "stack" (
  "id" serial PRIMARY KEY NOT NULL,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

CREATE TABLE IF NOT EXISTS "stack_locales" (
  "intro" varchar,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "stack_groups" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS "stack_groups_locales" (
  "title" varchar NOT NULL,
  "description" varchar,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "stack_groups_items" (
  "_order" integer NOT NULL,
  "_parent_id" varchar NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "url" varchar,
  "since" numeric,
  "status" "enum_stack_groups_items_status" DEFAULT 'current' NOT NULL,
  "icon_id" integer
);

CREATE TABLE IF NOT EXISTS "stack_groups_items_locales" (
  "note" varchar,
  "id" serial PRIMARY KEY NOT NULL,
  "_locale" "_locales" NOT NULL,
  "_parent_id" varchar NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_locales_parent_id_fk') THEN
    ALTER TABLE "stack_locales" ADD CONSTRAINT "stack_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."stack"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_groups_parent_id_fk') THEN
    ALTER TABLE "stack_groups" ADD CONSTRAINT "stack_groups_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."stack"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_groups_locales_parent_id_fk') THEN
    ALTER TABLE "stack_groups_locales" ADD CONSTRAINT "stack_groups_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."stack_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_groups_items_parent_id_fk') THEN
    ALTER TABLE "stack_groups_items" ADD CONSTRAINT "stack_groups_items_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."stack_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_groups_items_icon_id_media_id_fk') THEN
    ALTER TABLE "stack_groups_items" ADD CONSTRAINT "stack_groups_items_icon_id_media_id_fk"
      FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stack_groups_items_locales_parent_id_fk') THEN
    ALTER TABLE "stack_groups_items_locales" ADD CONSTRAINT "stack_groups_items_locales_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."stack_groups_items"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "stack_locales_parent_id_idx" ON "stack_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stack_locales_locale_parent_id_unique" ON "stack_locales" USING btree ("_locale", "_parent_id");
CREATE INDEX IF NOT EXISTS "stack_groups_order_idx" ON "stack_groups" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "stack_groups_parent_id_idx" ON "stack_groups" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "stack_groups_locales_parent_id_idx" ON "stack_groups_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stack_groups_locales_locale_parent_id_unique" ON "stack_groups_locales" USING btree ("_locale", "_parent_id");
CREATE INDEX IF NOT EXISTS "stack_groups_items_order_idx" ON "stack_groups_items" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "stack_groups_items_parent_id_idx" ON "stack_groups_items" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "stack_groups_items_icon_idx" ON "stack_groups_items" USING btree ("icon_id");
CREATE INDEX IF NOT EXISTS "stack_groups_items_locales_parent_id_idx" ON "stack_groups_items_locales" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "stack_groups_items_locales_locale_parent_id_unique" ON "stack_groups_items_locales" USING btree ("_locale", "_parent_id");

COMMIT;
