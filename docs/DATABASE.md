# Database

Athena stores everything in PostgreSQL through `@payloadcms/db-postgres`
(Drizzle under the hood). Production runs on **Neon**; the dev container
ships a local PostgreSQL 16.

> **Related**: [Content Model](./CONTENT_MODEL.md) · [Upgrade Notes](./UPGRADE_NOTES.md)

## 1. Connection

`payload.config.ts` reads `POSTGRES_URL`, falling back to `DATABASE_URL`. The
CMS refuses to start without `POSTGRES_URL` unless it is generating types,
running in CI (`CI=true`) or under `NODE_ENV=test`, where a dummy URL is used
so the config can load.

| Environment | Database |
|---|---|
| Local (dev container) | `postgres://postgres:postgres@postgres:5432/payload_db` (`docker-compose.yml`) |
| Local (direct) | Any Postgres 16, or a Neon branch |
| Preview deployment | **Production Neon database** |
| Production | Production Neon database |

Preview and Production share one database. Treat the preview CMS as
production data, and remember that anything that changes the schema on a
preview deploy changes it for production too.

## 2. Schema Ownership

Payload derives the schema from the collection, global and plugin configs
(see [CONTENT_MODEL.md](./CONTENT_MODEL.md)). Table naming follows Payload's
conventions: one table per collection (`pages`, `posts`, ...), child tables
for arrays and blocks (`pages_blocks_cta`, `pages_hero_links`, ...), `_rels`
tables for relationships, `_v` tables for versions (`_pages_v`, `_posts_v`),
plus Payload's internal tables (`payload_migrations`, `payload_preferences`,
`payload_locked_documents`, `payload_jobs`, `payload_kv`, `users_sessions`).

## 3. How Schema Changes Reach Each Environment

| Environment | Mechanism |
|---|---|
| Development (`next dev`) | Drizzle **push**: the adapter syncs the live schema to the config on startup and marks it with a `batch = -1` row in `payload_migrations`. |
| Production / Preview | **No automatic change.** Push is disabled outside development and the config does not set `prodMigrations`, so nothing runs at build or boot. |

### Current state of migrations

`apps/cms/src/migrations/` contains two migrations from May 2025
(`20250522_154847_initial` and an empty `20250527_122842`). Since then the
production schema has been kept in step through dev-mode push and hand-written
SQL, so those files **do not describe the current schema** (for example
`users_sessions`, `payload_kv` and the API-key columns arrived later). Do not
run `payload migrate` against production expecting it to catch up.

### Procedure for a schema change today

1. Make the config change and run it locally against a scratch database to
   let push create the new columns.
2. Work out the exact DDL. The reliable way is to push the old and new
   versions to two empty databases and diff `pg_dump --schema-only`.
3. Write idempotent SQL (`ADD COLUMN IF NOT EXISTS`, ...) and record it in
   [UPGRADE_NOTES.md](./UPGRADE_NOTES.md) next to the change.
4. Apply it to the production Neon database **before or together with** the
   deploy. Deploying first makes queries on the affected tables fail.

Example from the Payload 3.92 upgrade:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
```

### Planned: automated migrations

A draft exists (not merged) for moving to tracked migrations: a baseline
migration that captures the current production schema, and a deploy-time
runner that clears the dev-push marker, records the 2025 migrations as applied
and then runs `payload migrate` with the unpooled Neon URL. Because Preview
shares the production database, enabling it means preview deploys migrate
production. It should be tested on a Neon branch and against the real contents
of `payload_migrations` first.

## 4. Seeding

- **Admin dashboard → Seed** (`POST /next/seed`, logged-in users only) and
  `bun run --filter @athena/cms seed:standalone` both **delete** existing
  content in pages, posts, media, categories, forms, form submissions, search
  and the globals before loading demo data. Development databases only.
- Seeding sets `context.disableRevalidate` so it does not fire invalidation
  webhooks.

## 5. Backups and Recovery

Neon provides point-in-time restore and branching. Before a risky manual
migration, create a Neon branch from production to test the SQL, and note the
restore point. Media files live in Vercel Blob, not in the database; the
database stores their URLs and metadata only.

## 6. Maintenance Scripts (`apps/cms/src/scripts`)

| Script | Purpose |
|---|---|
| `create-web-service-account.ts` | Create the `web-frontend@service.local` user or rotate its API key. Prints the key once. Run with `bun run --filter @athena/cms payload run src/scripts/create-web-service-account.ts`. |
| `check-media.ts` | Print the first 10 media rows for debugging (`bun run --filter @athena/cms check:media`). |
| `seed-standalone.ts` | Seed without a running server (destructive, see above). |
