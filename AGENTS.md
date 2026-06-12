# AGENTS.md

> Canonical guidance for AI coding agents working in this repo.
> `CLAUDE.md` imports this file, so there is a single source of truth.
> Deep-dive human docs live in [`docs/`](./docs).

## Project Overview

**Athena** is a content-driven website, organized as a Bun-workspaces monorepo:

- **`apps/cms`** — Payload CMS 3 on Next.js 16 (App Router): admin panel, REST/GraphQL API, and the legacy in-app public frontend (bridge period only).
- **`apps/web`** — Astro 6 public frontend consuming the CMS over its REST API.
- **`packages/shared`** — generated Payload types + cross-app constants (cache tags, the draft cookie name, collection slugs).

Both apps deploy to **Vercel** (two projects, one repo) with Neon PostgreSQL and Vercel Blob for media storage.

## Tech Stack

- **CMS**: Payload CMS 3 + Next.js 16 (App Router), Tailwind CSS v3 + daisyUI v4
- **Web**: Astro 6 + `@astrojs/vercel` (SSR + ISR), Tailwind CSS v4 (`@tailwindcss/vite`) + daisyUI v5 (Linear-inspired light/dark themes in `src/styles/global.css`)
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 22 (pinned to 22.22.0 via `.nvmrc`)
- **Package Manager**: Bun (always use `bun`, never `npm` or `pnpm`)
- **Database**: PostgreSQL 16 (`@payloadcms/db-postgres`, Neon)
- **Rich Text**: Lexical (`@payloadcms/richtext-lexical`; the web app renders it via `convertLexicalToHTML` in `apps/web/src/lib/richtext.ts`)
- **Monitoring**: Sentry, Checkly

## Key Commands (run from the repo root)

```bash
bun run dev:cms               # CMS dev server (localhost:3000)
bun run dev:web               # Astro dev server (localhost:4321)
bun run build                 # Build all workspaces
bun run build:cms             # CMS production build (next build --webpack)
bun run build:web             # Astro production build
bun run lint                  # ESLint (cms) + astro check (web)
bun run generate:types        # Regenerate Payload types -> packages/shared
bun run generate:importmap    # Regenerate admin import map
bun run deploy:preview        # Merge development -> preview and push
bun run deploy:production     # Open a preview -> main PR and enable auto-merge
```

## Directory Structure

```
apps/cms/src/
├── app/(frontend)/           # Legacy in-app public pages (bridge; being replaced by apps/web)
├── app/(payload)/            # Payload admin panel + API routes
├── blocks/ collections/ fields/ heros/ hooks/ plugins/ providers/
├── utilities/                # invalidateWeb.ts, generatePreviewPath.ts, env.ts, getURL.ts
└── payload.config.ts         # Main Payload CMS configuration

apps/cms/config/next.config.mjs   # Real Next.js config (root next.config.mjs re-exports it)

apps/web/src/
├── pages/                    # [...slug], posts/*, search, sitemaps, 404, api/* endpoints
├── components/               # Astro ports of the cms frontend (blocks/, heros/, ...)
├── lib/                      # cms.ts (REST client), richtext.ts, draft.ts, seo.ts, media.ts
├── layouts/Layout.astro      # Theme init, meta tags, Header/Footer
└── middleware.ts             # Redirects-collection handling

packages/shared/src/
├── payload-types.ts          # Auto-generated (DO NOT EDIT; bun run generate:types)
└── constants.ts              # CACHE_TAGS, DRAFT_COOKIE, COLLECTION_SLUGS, IMAGE_SIZES
```

## CMS ⇄ Web Contract

The CMS knows the web app via `WEB_URL`; the web app reaches the CMS via `CMS_URL`.

- **Cache invalidation**: on publish/unpublish, `apps/cms/src/utilities/invalidateWeb.ts` POSTs `{ paths, tags }` to `${WEB_URL}/api/invalidate` with `Authorization: Bearer ${REVALIDATE_SECRET}`. The Astro endpoint re-renders the affected ISR-cached paths.
- **Draft preview**: the admin Preview button targets `${WEB_URL}/api/preview?slug&collection&path&previewSecret` (`generatePreviewPath.ts`). The endpoint validates `PREVIEW_SECRET`, sets the HttpOnly `athena-draft` cookie, and redirects; draft-aware pages then fetch with `draft=true` using the `web-frontend` service account's API key (`PAYLOAD_API_KEY`). Create/rotate that account with `apps/cms/src/scripts/create-web-service-account.ts`.
- **Forms**: the web `FormBlock` posts JSON to `${CMS_URL}/api/form-submissions`; CMS CORS already allows the web origin.

`PREVIEW_SECRET` and `REVALIDATE_SECRET` must be identical in both deployments — drift shows up as silent 401s (`invalidateWeb` logs errors but never throws).

## Code Conventions

- **TypeScript strict mode** with `noUncheckedIndexedAccess` and `strictNullChecks`
- **Path alias**: `@/*` maps to `./src/*` in both apps - use consistently
- **Never edit** `packages/shared/src/payload-types.ts` - regenerate with `bun run generate:types`
- **CMS**: Server Components by default; add `'use client'` only when needed
- **Dark mode**: Controlled by `data-theme="dark"` attribute, not OS media query (theme stored under the `payload-theme` localStorage key in both apps)
- **Prefix unused vars** with `_` to suppress lint warnings
- **ESLint (cms)**: flat config using `eslint-config-next`'s native flat exports (`next lint` is gone in Next 16; scripts call `eslint .`)

## Payload CMS Patterns

- Collections export a `CollectionConfig` typed with their slug
- Use `authenticatedOrPublished` access for public read, `authenticated` for write
- Versions/drafts with autosave enabled on Posts and Pages
- Revalidation hooks (`afterChange`, `afterDelete`) call `invalidateWeb()` — legacy next/cache revalidation for the bridge frontend plus the web webhook
- Changing `src/payload.config.ts` requires a dev server restart
- Run `bun run generate:importmap` after adding new Payload admin components **or after upgrading any `@payloadcms/*` package** (component import paths can move between versions)

## Build Configuration (`apps/cms/config/next.config.mjs`)

Three things there are load-bearing and easy to break:

1. **`withPayload(...)`** wraps the config so Payload's server-only packages are
   externalized correctly. Do not remove it.
2. **Client webpack alias `'payload/internal': false`** — the Vercel Blob client
   upload handler pulls `getFileKey` from a barrel that also re-exports
   server-only code (`resolveSignedURLKey` -> `payload/internal` -> undici, which
   references `node:*` builtins). That code never runs in the browser, so the alias
   keeps it out of the client bundle. Without it, the build fails with
   `UnhandledSchemeError: Reading from "node:console"`.
3. **`next build --webpack`** in the cms build script — Next 16 defaults to
   Turbopack, which ignores the `webpack()` callback above and the Sentry
   webpack plugin. Keep the flag until the alias is ported to `turbopack.resolveAlias`.

Sentry (`withSentryConfig`) wraps the result only when `SENTRY_DSN` +
`SENTRY_ORG`/`SENTRY_PROJECT` are set.

## Git Workflow

Three-branch linear promotion: `development` -> `preview` -> `main`

| Branch | Purpose | Deploys To |
|---|---|---|
| `development` | Active development | None |
| `preview` | Staging review | Vercel Preview |
| `main` | Production | Vercel Production |

`main` is branch-protected — direct pushes are rejected. Production ships via a
PR from `preview` to `main`; `bun run deploy:production` opens it with `gh` and
enables auto-merge. `preview` still accepts direct pushes (`bun run deploy:preview`).

CI (GitHub Actions) runs lint + type check on push to `main`/`preview` and PRs to `main`.

Vercel deploy triggers are declared in each app's `vercel.json` (read from the
project's Root Directory) to avoid duplicate builds:

- `git.deploymentEnabled` turns off deployments from `development` in both
  projects — only `preview` and `main` pushes deploy.
- `ignoreCommand` skips Preview builds on the `preview` branch when HEAD is a
  `preview -> main` release merge commit (`Merge pull request #N from .../preview`):
  that exact tree was just built for Production, so rebuilding it after the
  post-release branch sync is redundant. Caveat: if `main` ever gets hotfix
  commits of its own, the staging URL lags until the next real `preview` push.

## Environment Variables

CMS (`apps/cms/.env`):

```bash
POSTGRES_URL=              # Neon Postgres connection string (required at startup)
PAYLOAD_SECRET=            # 32+ char JWT secret
CMS_URL=                   # CMS origin (NEXT_PUBLIC_SERVER_URL is a legacy alias)
WEB_URL=                   # Astro frontend origin; unset = legacy in-app behavior
PREVIEW_SECRET=            # Shared with web: gates the draft cookie
REVALIDATE_SECRET=         # Shared with web: bearer token for /api/invalidate
BLOB_READ_WRITE_TOKEN=     # Vercel Blob storage token
```

Web (`apps/web/.env` — see `apps/web/README.md`):

```bash
CMS_URL= WEB_URL= PREVIEW_SECRET= REVALIDATE_SECRET=
PAYLOAD_API_KEY=           # web-frontend service account key (draft fetches)
```

## Key URLs (Local Dev)

- `http://localhost:4321` - Astro frontend
- `http://localhost:3000` - CMS (admin + API + legacy frontend)
- `http://localhost:3000/admin` - Payload admin panel
- `http://localhost:3000/api/graphql-playground` - GraphQL Playground

## Common Pitfalls

1. `POSTGRES_URL` is required at startup - the cms throws without it
2. Bun is the only supported package manager. A stray `package-lock.json` will be
   picked up by the Dockerfile's package-manager detection **before** `bun.lock`
   (`npm ci` wins), so keep it deleted.
3. Sentry wraps Next.js config only when `SENTRY_DSN` + `SENTRY_ORG`/`SENTRY_PROJECT` are set
4. Dockerfile uses Docker Hardened Images (`dhi.io/`), not standard Docker Hub
5. Use type-only imports for Payload generated types
6. Keep `withPayload`, the `'payload/internal': false` client alias, and the
   `--webpack` build flag in apps/cms (see [Build Configuration](#build-configuration-appscmsconfignextconfigmjs))
7. Re-run `bun run generate:importmap` after upgrading `@payloadcms/*` packages
8. Astro excludes underscore-prefixed files from routing — the invalidation
   endpoint is `/api/invalidate` (no underscore); keep `invalidateWeb.ts` in sync
9. Payload REST defaults to `limit=10`, and drafts require auth — the web app's
   `lib/cms.ts` always sets `depth`/`limit` explicitly and authenticates draft fetches
