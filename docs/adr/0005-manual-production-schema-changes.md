# 0005. Apply production schema changes by hand for now

- **Status**: Accepted (interim)
- **Area**: `apps/cms/src/migrations`, production Neon database

## Context

Production was kept in step with the config through dev-mode push during
2025, so the checked-in migrations stopped describing the real schema.
Turning on `payload migrate` at deploy time needs a baseline migration and a
runner that reconciles `payload_migrations`, and Preview shares the
production database, so any automated migration on a preview deploy changes
production.

## Decision

Until automated migrations are in place, every schema change ships with
idempotent SQL recorded in `docs/UPGRADE_NOTES.md`, applied to production
before or together with the deploy.

## Consequences

- Each Payload upgrade and schema edit needs a schema diff (push old and new to
  empty databases, compare `pg_dump --schema-only`).
- Forgetting the SQL breaks queries on the affected tables in production.
- Revisit this when the baseline migration and deploy-time runner are ready;
  a draft exists (see [DATABASE.md](../DATABASE.md#planned-automated-migrations)).
