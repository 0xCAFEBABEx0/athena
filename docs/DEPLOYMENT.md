# Deployment Guide

Athena is a **Bun-workspaces monorepo** that deploys as **two Vercel projects
from one repository** — `apps/cms` (Payload CMS + Next.js 16) and `apps/web`
(Astro 6 frontend) — both backed by Neon PostgreSQL and Vercel Blob. It follows a
**development → preview → main** branch promotion.

> **📚 Related**:
> - [CI/CD Pipeline](./CI_CD.md) — GitHub Actions + Vercel flow
> - [Development Workflow](./DEVELOPMENT_WORKFLOW.md) — branch strategy

## Two Vercel Projects, One Repo

Create **two** Vercel projects, both pointed at this repository, distinguished by
**Root Directory**:

| Vercel Project | Root Directory | Framework | Build Command | Output |
|---|---|---|---|---|
| **athena-cms** | `apps/cms` | Next.js | `bun run build` (`next build --webpack`) | `.next` |
| **athena-web** | `apps/web` | Astro | `bun run build` (`astro build`) | `@astrojs/vercel` |

Notes:

- Set the **Root Directory** in each project's *Settings → General*. Vercel then
  runs install/build scoped to that workspace while still seeing the monorepo
  lockfile.
- **Install command**: `bun install --frozen-lockfile` (Bun is the only supported
  package manager; a stray `package-lock.json` will be picked up before
  `bun.lock` — keep it deleted).
- The CMS build **must** keep the `--webpack` flag (Next 16 defaults to Turbopack,
  which ignores the load-bearing `webpack()` alias). See
  [Build Configuration in AGENTS.md](../AGENTS.md#build-configuration-appscmsconfignextconfigmjs).
- Each project deploys on the same branches; a push to `preview`/`main` builds
  **both** apps for that environment.

## Branch → Environment Mapping

| Branch | Environment | CMS | Web |
|---|---|---|---|
| `development` | Local only | http://localhost:3000 | http://localhost:4321 |
| `preview` | Vercel **Preview** | auto preview URL | auto preview URL |
| `main` | Vercel **Production** | production domain | production domain |

Vercel's Git integration deploys automatically on push. GitHub Actions runs lint +
type check (it does **not** deploy — see [CI_CD.md](./CI_CD.md)).

## Deployment Commands

```bash
# Promote development -> preview (deploys both apps to Preview)
bun run deploy:preview          # git checkout preview && git merge development && git push

# Promote preview -> main (production). main is PR-protected, so this opens a
# preview -> main PR and enables auto-merge (gh pr create + gh pr merge --auto)
bun run deploy:production
```

## CMS ⇄ Web Contract (must match across both deployments)

The two apps talk over HTTP, so several env vars must be **byte-identical** in
both Vercel projects:

- **`WEB_URL`** (set in CMS) / **`CMS_URL`** (set in web) — how each app reaches
  the other.
- **`PREVIEW_SECRET`** — gates the draft-preview cookie. The admin Preview button
  targets `${WEB_URL}/api/preview?...&previewSecret=...`.
- **`REVALIDATE_SECRET`** — bearer token for cache invalidation. On
  publish/unpublish the CMS POSTs `{ paths, tags }` to
  `${WEB_URL}/api/invalidate` with `Authorization: Bearer ${REVALIDATE_SECRET}`.
- **`PAYLOAD_API_KEY`** (web only) — the CMS `web-frontend` service-account API
  key the web app uses to fetch **draft** content over REST.

> Drift in `PREVIEW_SECRET` / `REVALIDATE_SECRET` shows up as **silent 401s** —
> `invalidateWeb` logs the error but never throws. Full contract:
> [AGENTS.md → CMS ⇄ Web Contract](../AGENTS.md#cms--web-contract).

## Environment Variables

Maintain env vars **per Vercel project** and per environment (Preview /
Production). Local templates: `apps/cms/.env.example` and `apps/web/.env.example`.

### CMS project (`apps/cms`)

```bash
POSTGRES_URL=              # Neon Postgres (required at startup)
PAYLOAD_SECRET=            # 32+ char JWT secret
CMS_URL=                   # this CMS origin (NEXT_PUBLIC_SERVER_URL is a legacy alias)
WEB_URL=                   # the Astro frontend origin
PREVIEW_SECRET=            # shared with web
REVALIDATE_SECRET=         # shared with web
BLOB_READ_WRITE_TOKEN=     # Vercel Blob
DEPLOY_ENV=                # development | preview | production (VERCEL_ENV is a fallback)
# Sentry (optional): SENTRY_DSN / SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN
```

### Web project (`apps/web`)

```bash
CMS_URL=                   # CMS admin + REST API origin
WEB_URL=                   # this app's own public origin
PREVIEW_SECRET=            # shared with CMS
REVALIDATE_SECRET=         # shared with CMS (also the ISR bypass token)
PAYLOAD_API_KEY=           # web-frontend service-account key (draft fetches)
```

Rotate/create the `web-frontend` service account with
`apps/cms/src/scripts/create-web-service-account.ts`.

## Best Practices

- **Branch protection** — require PR review + passing checks on `main`.
- **Database migrations** — test on `development`, run against `preview` (which
  points at the production DB), then promote. Use `DATABASE_URL_UNPOOLED` for
  migrations (no pgbouncer).
- **Rollback** — keep previous deployments available in each Vercel project; tag
  important releases; have a DB-migration rollback plan.
- **Monitoring** — watch Sentry per environment and Vercel Analytics.

## Troubleshooting

### Build failures

```bash
bun run build:cms        # reproduce the CMS build locally
bun run build:web        # reproduce the Astro build locally
bun run lint
bun run generate:types
```

### Wrong app deployed / both apps building together

Confirm each Vercel project's **Root Directory** (`apps/cms` vs `apps/web`) and
that "Include source files outside of the Root Directory" is enabled so the
monorepo lockfile and `packages/shared` resolve.

### Database connection issues

Verify `POSTGRES_URL` per environment, check the Neon user's permissions, and
confirm network access from Vercel.
