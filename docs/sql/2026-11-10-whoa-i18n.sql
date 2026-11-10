-- whoa.me redesign + English/Japanese/Chinese content (2026-11-10)
--
-- Adds the `site` global, turns on Payload localization (en default, ja, zh)
-- and moves every existing localized value into the new *_locales tables
-- as English. Run on the preview Neon branch first, then production, BEFORE
-- deploying the CMS. Safe to run twice: the second run only prints a notice.
BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.posts_locales') IS NOT NULL THEN
    RAISE NOTICE 'Localization tables already exist; nothing to do.';
    RETURN;
  END IF;

  IF to_regclass('public.site') IS NOT NULL THEN
    RAISE EXCEPTION 'A "site" table already exists (from the earlier site-global SQL?). '
      'Drop site, site_social_links and site_projects first, or ask for a patched script.';
  END IF;

  EXECUTE $migration$
    CREATE TYPE "public"."_locales" AS ENUM('en', 'ja', 'zh');
    CREATE TYPE "public"."enum_site_default_view" AS ENUM('cli', 'modern');
    CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en', 'ja', 'zh');
    CREATE TYPE "public"."enum__posts_v_published_locale" AS ENUM('en', 'ja', 'zh');
    CREATE TABLE "pages_hero_links_locales" (
      	"link_label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "pages_locales" (
      	"title" varchar,
      	"hero_rich_text" jsonb,
      	"meta_title" varchar,
      	"meta_image_id" integer,
      	"meta_description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "_pages_v_version_hero_links_locales" (
      	"link_label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "_pages_v_locales" (
      	"version_title" varchar,
      	"version_hero_rich_text" jsonb,
      	"version_meta_title" varchar,
      	"version_meta_image_id" integer,
      	"version_meta_description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "posts_locales" (
      	"title" varchar,
      	"content" jsonb,
      	"meta_title" varchar,
      	"meta_image_id" integer,
      	"meta_description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "_posts_v_locales" (
      	"version_title" varchar,
      	"version_content" jsonb,
      	"version_meta_title" varchar,
      	"version_meta_image_id" integer,
      	"version_meta_description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "categories_locales" (
      	"title" varchar NOT NULL,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "forms_blocks_checkbox_locales" (
      	"label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_country_locales" (
      	"label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_email_locales" (
      	"label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_message_locales" (
      	"message" jsonb,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_number_locales" (
      	"label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_select_options_locales" (
      	"label" varchar NOT NULL,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_select_locales" (
      	"label" varchar,
      	"default_value" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_state_locales" (
      	"label" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_text_locales" (
      	"label" varchar,
      	"default_value" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_blocks_textarea_locales" (
      	"label" varchar,
      	"default_value" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_emails_locales" (
      	"subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL,
      	"message" jsonb,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "forms_locales" (
      	"submit_button_label" varchar,
      	"confirmation_message" jsonb,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "search_locales" (
      	"title" varchar,
      	"meta_title" varchar,
      	"meta_description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "site_social_links" (
      	"_order" integer NOT NULL,
      	"_parent_id" integer NOT NULL,
      	"id" varchar PRIMARY KEY NOT NULL,
      	"label" varchar NOT NULL,
      	"url" varchar NOT NULL
      );
    CREATE TABLE "site_projects" (
      	"_order" integer NOT NULL,
      	"_parent_id" integer NOT NULL,
      	"id" varchar PRIMARY KEY NOT NULL,
      	"name" varchar NOT NULL,
      	"url" varchar
      );
    CREATE TABLE "site_projects_locales" (
      	"description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "site" (
      	"id" serial PRIMARY KEY NOT NULL,
      	"site_name" varchar DEFAULT 'whoa.me' NOT NULL,
      	"author_name" varchar,
      	"default_view" "enum_site_default_view" DEFAULT 'cli' NOT NULL,
      	"updated_at" timestamp(3) with time zone,
      	"created_at" timestamp(3) with time zone
      );
    CREATE TABLE "site_locales" (
      	"welcome" varchar DEFAULT 'Welcome to whoa.me',
      	"intro" varchar,
      	"description" varchar,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" integer NOT NULL
      );
    CREATE TABLE "header_nav_items_locales" (
      	"link_label" varchar NOT NULL,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    CREATE TABLE "footer_nav_items_locales" (
      	"link_label" varchar NOT NULL,
      	"id" serial PRIMARY KEY NOT NULL,
      	"_locale" "_locales" NOT NULL,
      	"_parent_id" varchar NOT NULL
      );
    ALTER TABLE "pages" DROP CONSTRAINT "pages_meta_image_id_media_id_fk";
    ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_meta_image_id_media_id_fk";
    ALTER TABLE "posts" DROP CONSTRAINT "posts_meta_image_id_media_id_fk";
    ALTER TABLE "_posts_v" DROP CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk";
    DROP INDEX "pages_meta_meta_image_idx";
    DROP INDEX "_pages_v_version_meta_version_meta_image_idx";
    DROP INDEX "posts_meta_meta_image_idx";
    DROP INDEX "_posts_v_version_meta_version_meta_image_idx";
    DROP INDEX "pages_rels_pages_id_idx";
    DROP INDEX "pages_rels_posts_id_idx";
    DROP INDEX "pages_rels_categories_id_idx";
    DROP INDEX "_pages_v_rels_pages_id_idx";
    DROP INDEX "_pages_v_rels_posts_id_idx";
    DROP INDEX "_pages_v_rels_categories_id_idx";
    ALTER TABLE "pages_blocks_cta_links" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_cta" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_content_columns" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_content" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_media_block" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_archive" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_blocks_form_block" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_rels" ADD COLUMN "locale" "_locales";
    ALTER TABLE "_pages_v_blocks_cta_links" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_cta" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_content_columns" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_content" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_media_block" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_archive" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v_blocks_form_block" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "_pages_v" ADD COLUMN "snapshot" boolean;
    ALTER TABLE "_pages_v" ADD COLUMN "published_locale" "enum__pages_v_published_locale";
    ALTER TABLE "_pages_v_rels" ADD COLUMN "locale" "_locales";
    ALTER TABLE "_posts_v" ADD COLUMN "snapshot" boolean;
    ALTER TABLE "_posts_v" ADD COLUMN "published_locale" "enum__posts_v_published_locale";
    ALTER TABLE "categories_breadcrumbs" ADD COLUMN "_locale" "_locales";
    ALTER TABLE "pages_hero_links_locales" ADD CONSTRAINT "pages_hero_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_hero_links"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "_pages_v_version_hero_links_locales" ADD CONSTRAINT "_pages_v_version_hero_links_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_version_hero_links"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_checkbox_locales" ADD CONSTRAINT "forms_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_country_locales" ADD CONSTRAINT "forms_blocks_country_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_country"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_email_locales" ADD CONSTRAINT "forms_blocks_email_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_email"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_message_locales" ADD CONSTRAINT "forms_blocks_message_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_message"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_number_locales" ADD CONSTRAINT "forms_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_select_options_locales" ADD CONSTRAINT "forms_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_select_locales" ADD CONSTRAINT "forms_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_state_locales" ADD CONSTRAINT "forms_blocks_state_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_state"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_text_locales" ADD CONSTRAINT "forms_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_blocks_textarea_locales" ADD CONSTRAINT "forms_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_emails_locales" ADD CONSTRAINT "forms_emails_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_emails"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "forms_locales" ADD CONSTRAINT "forms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "search_locales" ADD CONSTRAINT "search_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "site_social_links" ADD CONSTRAINT "site_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "site_projects" ADD CONSTRAINT "site_projects_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "site_projects_locales" ADD CONSTRAINT "site_projects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_projects"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "site_locales" ADD CONSTRAINT "site_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "header_nav_items_locales" ADD CONSTRAINT "header_nav_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header_nav_items"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "footer_nav_items_locales" ADD CONSTRAINT "footer_nav_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_nav_items"("id") ON DELETE cascade ON UPDATE no action;
    CREATE UNIQUE INDEX "pages_hero_links_locales_locale_parent_id_unique" ON "pages_hero_links_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "pages_hero_links_locales_parent_id_idx" ON "pages_hero_links_locales" USING btree ("_parent_id");
    CREATE INDEX "pages_meta_meta_image_idx" ON "pages_locales" USING btree ("meta_image_id","_locale");
    CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "pages_locales_parent_id_idx" ON "pages_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "_pages_v_version_hero_links_locales_locale_parent_id_unique" ON "_pages_v_version_hero_links_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "_pages_v_version_hero_links_locales_parent_id_idx" ON "_pages_v_version_hero_links_locales" USING btree ("_parent_id");
    CREATE INDEX "_pages_v_version_meta_version_meta_image_idx" ON "_pages_v_locales" USING btree ("version_meta_image_id","_locale");
    CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "_pages_v_locales_parent_id_idx" ON "_pages_v_locales" USING btree ("_parent_id");
    CREATE INDEX "posts_meta_meta_image_idx" ON "posts_locales" USING btree ("meta_image_id","_locale");
    CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "posts_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "posts_locales_parent_id_idx" ON "posts_locales" USING btree ("_parent_id");
    CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v_locales" USING btree ("version_meta_image_id","_locale");
    CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "_posts_v_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "_posts_v_locales_parent_id_idx" ON "_posts_v_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "categories_locales_parent_id_idx" ON "categories_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_checkbox_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_checkbox_locales_parent_id_idx" ON "forms_blocks_checkbox_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_country_locales_locale_parent_id_unique" ON "forms_blocks_country_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_country_locales_parent_id_idx" ON "forms_blocks_country_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_email_locales_locale_parent_id_unique" ON "forms_blocks_email_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_email_locales_parent_id_idx" ON "forms_blocks_email_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_message_locales_locale_parent_id_unique" ON "forms_blocks_message_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_message_locales_parent_id_idx" ON "forms_blocks_message_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_number_locales_locale_parent_id_unique" ON "forms_blocks_number_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_number_locales_parent_id_idx" ON "forms_blocks_number_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_select_options_locales_locale_parent_id_unique" ON "forms_blocks_select_options_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_select_options_locales_parent_id_idx" ON "forms_blocks_select_options_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_select_locales_locale_parent_id_unique" ON "forms_blocks_select_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_select_locales_parent_id_idx" ON "forms_blocks_select_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_state_locales_locale_parent_id_unique" ON "forms_blocks_state_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_state_locales_parent_id_idx" ON "forms_blocks_state_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_text_locales_locale_parent_id_unique" ON "forms_blocks_text_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_text_locales_parent_id_idx" ON "forms_blocks_text_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_blocks_textarea_locales_locale_parent_id_unique" ON "forms_blocks_textarea_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_blocks_textarea_locales_parent_id_idx" ON "forms_blocks_textarea_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_emails_locales_locale_parent_id_unique" ON "forms_emails_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_emails_locales_parent_id_idx" ON "forms_emails_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "forms_locales_locale_parent_id_unique" ON "forms_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "forms_locales_parent_id_idx" ON "forms_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "search_locales_locale_parent_id_unique" ON "search_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "search_locales_parent_id_idx" ON "search_locales" USING btree ("_parent_id");
    CREATE INDEX "site_social_links_order_idx" ON "site_social_links" USING btree ("_order");
    CREATE INDEX "site_social_links_parent_id_idx" ON "site_social_links" USING btree ("_parent_id");
    CREATE INDEX "site_projects_order_idx" ON "site_projects" USING btree ("_order");
    CREATE INDEX "site_projects_parent_id_idx" ON "site_projects" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "site_projects_locales_locale_parent_id_unique" ON "site_projects_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "site_projects_locales_parent_id_idx" ON "site_projects_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "site_locales_locale_parent_id_unique" ON "site_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "site_locales_parent_id_idx" ON "site_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "header_nav_items_locales_locale_parent_id_unique" ON "header_nav_items_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "header_nav_items_locales_parent_id_idx" ON "header_nav_items_locales" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "footer_nav_items_locales_locale_parent_id_unique" ON "footer_nav_items_locales" USING btree ("_locale","_parent_id");
    CREATE INDEX "footer_nav_items_locales_parent_id_idx" ON "footer_nav_items_locales" USING btree ("_parent_id");
    CREATE INDEX "pages_blocks_cta_links_locale_idx" ON "pages_blocks_cta_links" USING btree ("_locale");
    CREATE INDEX "pages_blocks_cta_locale_idx" ON "pages_blocks_cta" USING btree ("_locale");
    CREATE INDEX "pages_blocks_content_columns_locale_idx" ON "pages_blocks_content_columns" USING btree ("_locale");
    CREATE INDEX "pages_blocks_content_locale_idx" ON "pages_blocks_content" USING btree ("_locale");
    CREATE INDEX "pages_blocks_media_block_locale_idx" ON "pages_blocks_media_block" USING btree ("_locale");
    CREATE INDEX "pages_blocks_archive_locale_idx" ON "pages_blocks_archive" USING btree ("_locale");
    CREATE INDEX "pages_blocks_form_block_locale_idx" ON "pages_blocks_form_block" USING btree ("_locale");
    CREATE INDEX "pages_rels_locale_idx" ON "pages_rels" USING btree ("locale");
    CREATE INDEX "_pages_v_blocks_cta_links_locale_idx" ON "_pages_v_blocks_cta_links" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_cta_locale_idx" ON "_pages_v_blocks_cta" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_content_columns_locale_idx" ON "_pages_v_blocks_content_columns" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_content_locale_idx" ON "_pages_v_blocks_content" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_media_block_locale_idx" ON "_pages_v_blocks_media_block" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_archive_locale_idx" ON "_pages_v_blocks_archive" USING btree ("_locale");
    CREATE INDEX "_pages_v_blocks_form_block_locale_idx" ON "_pages_v_blocks_form_block" USING btree ("_locale");
    CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
    CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
    CREATE INDEX "_pages_v_rels_locale_idx" ON "_pages_v_rels" USING btree ("locale");
    CREATE INDEX "_posts_v_snapshot_idx" ON "_posts_v" USING btree ("snapshot");
    CREATE INDEX "_posts_v_published_locale_idx" ON "_posts_v" USING btree ("published_locale");
    CREATE INDEX "categories_breadcrumbs_locale_idx" ON "categories_breadcrumbs" USING btree ("_locale");
    CREATE INDEX "pages_rels_pages_id_idx" ON "pages_rels" USING btree ("pages_id","locale");
    CREATE INDEX "pages_rels_posts_id_idx" ON "pages_rels" USING btree ("posts_id","locale");
    CREATE INDEX "pages_rels_categories_id_idx" ON "pages_rels" USING btree ("categories_id","locale");
    CREATE INDEX "_pages_v_rels_pages_id_idx" ON "_pages_v_rels" USING btree ("pages_id","locale");
    CREATE INDEX "_pages_v_rels_posts_id_idx" ON "_pages_v_rels" USING btree ("posts_id","locale");
    CREATE INDEX "_pages_v_rels_categories_id_idx" ON "_pages_v_rels" USING btree ("categories_id","locale");
    UPDATE "pages_blocks_cta_links" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_cta_links" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_cta" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_cta" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_content_columns" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_content_columns" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_content" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_content" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_media_block" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_media_block" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_archive" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_archive" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "pages_blocks_form_block" SET "_locale" = 'en';
    ALTER TABLE "pages_blocks_form_block" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_cta_links" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_cta_links" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_cta" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_cta" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_content_columns" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_content_columns" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_content" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_content" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_media_block" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_media_block" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_archive" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_archive" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "_pages_v_blocks_form_block" SET "_locale" = 'en';
    ALTER TABLE "_pages_v_blocks_form_block" ALTER COLUMN "_locale" SET NOT NULL;
    UPDATE "categories_breadcrumbs" SET "_locale" = 'en';
    ALTER TABLE "categories_breadcrumbs" ALTER COLUMN "_locale" SET NOT NULL;
    INSERT INTO "pages_hero_links_locales" ("link_label", "_locale", "_parent_id")
        SELECT "link_label", 'en', "id" FROM "pages_hero_links";
    INSERT INTO "pages_locales" ("title", "hero_rich_text", "meta_title", "meta_image_id", "meta_description", "_locale", "_parent_id")
        SELECT "title", "hero_rich_text", "meta_title", "meta_image_id", "meta_description", 'en', "id" FROM "pages";
    INSERT INTO "_pages_v_version_hero_links_locales" ("link_label", "_locale", "_parent_id")
        SELECT "link_label", 'en', "id" FROM "_pages_v_version_hero_links";
    INSERT INTO "_pages_v_locales" ("version_title", "version_hero_rich_text", "version_meta_title", "version_meta_image_id", "version_meta_description", "_locale", "_parent_id")
        SELECT "version_title", "version_hero_rich_text", "version_meta_title", "version_meta_image_id", "version_meta_description", 'en', "id" FROM "_pages_v";
    INSERT INTO "posts_locales" ("title", "content", "meta_title", "meta_image_id", "meta_description", "_locale", "_parent_id")
        SELECT "title", "content", "meta_title", "meta_image_id", "meta_description", 'en', "id" FROM "posts";
    INSERT INTO "_posts_v_locales" ("version_title", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", "_locale", "_parent_id")
        SELECT "version_title", "version_content", "version_meta_title", "version_meta_image_id", "version_meta_description", 'en', "id" FROM "_posts_v";
    INSERT INTO "categories_locales" ("title", "_locale", "_parent_id")
        SELECT "title", 'en', "id" FROM "categories";
    INSERT INTO "forms_blocks_checkbox_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_checkbox";
    INSERT INTO "forms_blocks_country_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_country";
    INSERT INTO "forms_blocks_email_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_email";
    INSERT INTO "forms_blocks_message_locales" ("message", "_locale", "_parent_id")
        SELECT "message", 'en', "id" FROM "forms_blocks_message";
    INSERT INTO "forms_blocks_number_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_number";
    INSERT INTO "forms_blocks_select_options_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_select_options";
    INSERT INTO "forms_blocks_select_locales" ("label", "default_value", "_locale", "_parent_id")
        SELECT "label", "default_value", 'en', "id" FROM "forms_blocks_select";
    INSERT INTO "forms_blocks_state_locales" ("label", "_locale", "_parent_id")
        SELECT "label", 'en', "id" FROM "forms_blocks_state";
    INSERT INTO "forms_blocks_text_locales" ("label", "default_value", "_locale", "_parent_id")
        SELECT "label", "default_value", 'en', "id" FROM "forms_blocks_text";
    INSERT INTO "forms_blocks_textarea_locales" ("label", "default_value", "_locale", "_parent_id")
        SELECT "label", "default_value", 'en', "id" FROM "forms_blocks_textarea";
    INSERT INTO "forms_emails_locales" ("subject", "message", "_locale", "_parent_id")
        SELECT "subject", "message", 'en', "id" FROM "forms_emails";
    INSERT INTO "forms_locales" ("submit_button_label", "confirmation_message", "_locale", "_parent_id")
        SELECT "submit_button_label", "confirmation_message", 'en', "id" FROM "forms";
    INSERT INTO "search_locales" ("title", "meta_title", "meta_description", "_locale", "_parent_id")
        SELECT "title", "meta_title", "meta_description", 'en', "id" FROM "search";
    INSERT INTO "header_nav_items_locales" ("link_label", "_locale", "_parent_id")
        SELECT "link_label", 'en', "id" FROM "header_nav_items";
    INSERT INTO "footer_nav_items_locales" ("link_label", "_locale", "_parent_id")
        SELECT "link_label", 'en', "id" FROM "footer_nav_items";
    UPDATE "pages_rels" SET "locale" = 'en' WHERE "path" LIKE 'layout.%';
    UPDATE "_pages_v_rels" SET "locale" = 'en' WHERE "path" LIKE 'version.layout.%';
    ALTER TABLE "pages_hero_links" DROP COLUMN "link_label";
    ALTER TABLE "pages" DROP COLUMN "title";
    ALTER TABLE "pages" DROP COLUMN "hero_rich_text";
    ALTER TABLE "pages" DROP COLUMN "meta_title";
    ALTER TABLE "pages" DROP COLUMN "meta_image_id";
    ALTER TABLE "pages" DROP COLUMN "meta_description";
    ALTER TABLE "_pages_v_version_hero_links" DROP COLUMN "link_label";
    ALTER TABLE "_pages_v" DROP COLUMN "version_title";
    ALTER TABLE "_pages_v" DROP COLUMN "version_hero_rich_text";
    ALTER TABLE "_pages_v" DROP COLUMN "version_meta_title";
    ALTER TABLE "_pages_v" DROP COLUMN "version_meta_image_id";
    ALTER TABLE "_pages_v" DROP COLUMN "version_meta_description";
    ALTER TABLE "posts" DROP COLUMN "title";
    ALTER TABLE "posts" DROP COLUMN "content";
    ALTER TABLE "posts" DROP COLUMN "meta_title";
    ALTER TABLE "posts" DROP COLUMN "meta_image_id";
    ALTER TABLE "posts" DROP COLUMN "meta_description";
    ALTER TABLE "_posts_v" DROP COLUMN "version_title";
    ALTER TABLE "_posts_v" DROP COLUMN "version_content";
    ALTER TABLE "_posts_v" DROP COLUMN "version_meta_title";
    ALTER TABLE "_posts_v" DROP COLUMN "version_meta_image_id";
    ALTER TABLE "_posts_v" DROP COLUMN "version_meta_description";
    ALTER TABLE "categories" DROP COLUMN "title";
    ALTER TABLE "forms_blocks_checkbox" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_country" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_email" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_message" DROP COLUMN "message";
    ALTER TABLE "forms_blocks_number" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_select_options" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_select" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_select" DROP COLUMN "default_value";
    ALTER TABLE "forms_blocks_state" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_text" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_text" DROP COLUMN "default_value";
    ALTER TABLE "forms_blocks_textarea" DROP COLUMN "label";
    ALTER TABLE "forms_blocks_textarea" DROP COLUMN "default_value";
    ALTER TABLE "forms_emails" DROP COLUMN "subject";
    ALTER TABLE "forms_emails" DROP COLUMN "message";
    ALTER TABLE "forms" DROP COLUMN "submit_button_label";
    ALTER TABLE "forms" DROP COLUMN "confirmation_message";
    ALTER TABLE "search" DROP COLUMN "title";
    ALTER TABLE "search" DROP COLUMN "meta_title";
    ALTER TABLE "search" DROP COLUMN "meta_description";
    ALTER TABLE "header_nav_items" DROP COLUMN "link_label";
    ALTER TABLE "footer_nav_items" DROP COLUMN "link_label";
  $migration$;

  RAISE NOTICE 'Localization applied: existing content is now the English version.';
END
$guard$;

COMMIT;
