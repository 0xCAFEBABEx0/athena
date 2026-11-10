# AGENTS.md

> Canonical guidance for AI coding agents working in this repo.
> `CLAUDE.md` imports this file, so there is a single source of truth.
> Deep-dive human docs live in [`docs/`](./docs).

## Working Rules

- **Code wins over docs**: when documentation and the existing code disagree,
  follow the code's conventions, and list every discrepancy you found in your
  final reply.

## Project Overview

**Athena** is a content-driven website, organized as a Bun-workspaces monorepo:

- **`apps/cms`** — Payload CMS 3 on Next.js 16 (App Router): admin panel and REST/GraphQL API. It serves no public pages; old public URLs redirect to `WEB_URL`.
- **`apps/web`** — Astro 7 public frontend consuming the CMS over its REST API.
- **`packages/shared`** — generated Payload types + cross-app constants (cache tags, the draft cookie name, collection slugs).

Both apps deploy to **Vercel** (two projects, one repo) with Neon PostgreSQL and Vercel Blob for media storage.

## Tech Stack

- **CMS**: Payload CMS 3 + Next.js 16 (App Router); admin styling is Payload's own SCSS (no Tailwind)
- **Web**: Astro 7 + `@astrojs/vercel` (SSR + ISR), Tailwind CSS v4 (`@tailwindcss/vite`) + daisyUI v5 (terminal-inspired light/dark themes in `src/styles/global.css`: warm paper, one orange accent, mono for dates/nav/labels)
- **Language**: TypeScript (strict mode). `apps/cms` is on TypeScript 7 (native `tsc`); `apps/web` stays on 6 until `astro check` supports 7
- **Runtime**: Vercel Functions of both apps run on **Bun 1.4** (`"bunVersion": "1.4.x"` in each `vercel.json`, Vercel's Bun runtime, beta), and both production builds run under Bun (`bun --bun next build` / `bun --bun astro build`; the Astro adapter derives `bun1.x` from the build process, which Vercel maps to Bun 1.3, so `apps/web/scripts/pin-bun-runtime.mjs` rewrites it to `bunVersion` after the build). Do not add `engines.node` to the app `package.json` files: it overrides `bunVersion` and puts functions back on Node. Node.js 24 LTS (pinned to 24.22.1 via `.nvmrc`, Vercel project setting 24.x) still runs tooling (`astro check`, Payload CLI, CI) and the CMS dev server (`next dev` under Bun fails to resolve Turbopack's hashed externals)
- **Package Manager**: Bun (always use `bun`, never `npm` or `pnpm`)
- **Database**: PostgreSQL 16 (`@payloadcms/db-postgres`, Neon)
- **Rich Text**: Lexical (`@payloadcms/richtext-lexical`; the web app renders it via `convertLexicalToHTML` in `apps/web/src/lib/richtext.ts`)
- **Monitoring**: Sentry, Checkly

## Key Commands (run from the repo root)

```bash
bun run dev:cms               # CMS dev server (localhost:3000)
bun run dev:web               # Astro dev server (localhost:4321)
bun run build                 # Build all workspaces
bun run build:cms             # CMS production build (next build, Turbopack)
bun run build:web             # Astro production build
bun run lint                  # Biome (cms) + astro check (web)
bun run typecheck             # tsc --noEmit (cms)
bun run generate:types        # Regenerate Payload types -> packages/shared
bun run generate:importmap    # Regenerate admin import map
bun run deploy:preview        # Merge development -> preview and push
bun run deploy:production     # Open a preview -> main PR and enable auto-merge
```

## Directory Structure

```
apps/cms/src/
├── app/(payload)/            # Payload admin panel + API routes
├── blocks/ collections/ fields/ heros/ hooks/ plugins/   # configs only; rendering lives in apps/web
├── Site/ Header/ Footer/     # globals (Site = name, intro, links, projects shown by the web app)
├── utilities/                # invalidateWeb.ts, generatePreviewPath.ts, env.ts, getURL.ts
└── payload.config.ts         # Main Payload CMS configuration

apps/cms/config/next.config.mjs   # Real Next.js config (root next.config.mjs re-exports it)

apps/web/src/
├── pages/                    # [...slug], posts/*, search, sitemaps, 404, api/* endpoints
├── components/               # Block/hero renderers (blocks/, heros/, ...)
├── lib/                      # cms.ts (REST client), site.ts (site global), richtext.ts, draft.ts, seo.ts, media.ts
├── layouts/Layout.astro      # Theme init, meta tags, Header/Footer
└── middleware.ts             # Redirects-collection handling

packages/shared/src/
├── payload-types.ts          # Auto-generated (DO NOT EDIT; bun run generate:types)
└── constants.ts              # CACHE_TAGS, DRAFT_COOKIE, COLLECTION_SLUGS, IMAGE_SIZES
```

## CMS ⇄ Web Contract

The CMS knows the web app via `WEB_URL`; the web app reaches the CMS via `CMS_URL`.

- **Cache invalidation**: on publish/unpublish, `apps/cms/src/utilities/invalidateWeb.ts` POSTs `{ paths, tags }` to `${WEB_URL}/api/invalidate` with `Authorization: Bearer ${REVALIDATE_SECRET}`. The Astro endpoint marks the Vercel cache tag `content` stale (every cached page, feed, sitemap and `/search-index.json` carries it, added in `middleware.ts`) and re-renders the affected paths right away. ISR expiration is 7 days, only a safety net. The ISR bypass token is derived from `REVALIDATE_SECRET` (`apps/web/src/lib/isr-bypass.mjs`); draft preview sets it as the `__prerender_bypass` cookie.
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
- **Lint (cms)**: Biome (`apps/cms/biome.json`, `react` + `next` domains), not ESLint: typescript-eslint has no TypeScript 7 support. Suppress with `// biome-ignore lint/<group>/<rule>: reason`. Prettier still formats

## Payload CMS Patterns

- Collections export a `CollectionConfig` typed with their slug
- Use `authenticatedOrPublished` access for public read, `authenticated` for write
- Versions/drafts with autosave enabled on Posts and Pages
- Revalidation hooks (`afterChange`, `afterDelete`) call `invalidateWeb()`, which POSTs to the web app's `/api/invalidate`
- Changing `src/payload.config.ts` requires a dev server restart
- Run `bun run generate:importmap` after adding new Payload admin components **or after upgrading any `@payloadcms/*` package** (component import paths can move between versions)

## Build Configuration (`apps/cms/config/next.config.mjs`)

Three things there are load-bearing and easy to break:

1. **`withPayload(...)`** wraps the config so Payload's server-only packages are
   externalized correctly. Do not remove it.
2. **Browser alias for `payload/internal`** — the Vercel Blob client upload
   handler pulls `getFileKey` from a barrel that also re-exports server-only code
   (`resolveSignedURLKey` -> `payload/internal` -> undici, which references
   `node:*` builtins). That code never runs in the browser. Production builds use
   Turbopack, where `turbopack.resolveAlias` maps it (browser condition only) to
   `config/empty-module.mjs`; Turbopack currently tree-shakes the chain anyway,
   so the alias is a safety net. The `webpack()` callback keeps the original
   `'payload/internal': false` alias for a `next build --webpack` fallback, which
   otherwise fails with `UnhandledSchemeError: Reading from "node:console"`.
3. **Turbopack builds** (`next build`, no `--webpack`) — about half the build
   time of webpack. Turbopack ignores the `webpack()` callback, so any new
   client alias must go in `turbopack.resolveAlias` too.

Sentry (`withSentryConfig`) wraps the result only when `SENTRY_DSN` +
`SENTRY_ORG`/`SENTRY_PROJECT` are set. With Turbopack, source maps are uploaded
by Sentry's after-production-compile hook (needs `SENTRY_AUTH_TOKEN`), and only
when `VERCEL_ENV=production` (it adds ~10 s to every build); the
options under `webpack` (`treeshake`, `automaticVercelMonitors`) are no-ops.

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

**Versioning** ([`docs/VERSIONING.md`](./docs/VERSIONING.md)): one SemVer for
the whole site in the root `package.json` `version`. Bump it and add a
`CHANGELOG.md` section on `development` before promoting a code change
(content edits never bump it). On push to `main`,
`.github/workflows/release.yml` tags `vX.Y.Z` and publishes a GitHub Release
from that section when the tag does not exist yet. The web app shows the
version beside the site name and in its `/status` panel, with a
`-preview.<sha>` / `-dev.<sha>` suffix outside Production
(`apps/web/src/lib/build-info.mjs`).
CodeRabbit (`.coderabbit.yaml`) reviews PRs to `main`, `development`, and
`preview` in English; when a rule in this file changes, update the matching
`path_instructions` entry there too.

Vercel deploy triggers are declared in each app's `vercel.json` (read from the
project's Root Directory) to avoid duplicate builds:

- `git.deploymentEnabled` is a **whitelist**: `"**": false` plus `main`/`preview`
  `true`. Unspecified branches default to enabled, so listing only `development:
  false` still deploys every `cursor/*` PR branch and burns Hobby (1 concurrent
  build, 100 deploys/day). GitHub Actions still runs on PRs to `main`.
- `ignoreCommand` runs `scripts/vercel-ignore-build.sh` (shared by both apps).
  It skips Preview builds on the `preview` branch when HEAD is a
  `preview -> main` release merge commit (`Merge pull request #N from .../preview`):
  that exact tree was just built for Production, so rebuilding it after the
  post-release branch sync is redundant. Caveat: if `main` ever gets hotfix
  commits of its own, the staging URL lags until the next real `preview` push.
  It also skips an app when nothing it depends on (its own folder,
  `packages/`, root `package.json`, `bun.lock`, `.nvmrc`) changed since
  `$VERCEL_GIT_PREVIOUS_SHA`, so a web-only change does not queue a CMS build
  on Hobby's single build slot. If the comparison fails, it builds.
- `apps/web` uses Astro's passthrough image service (no `astro:assets`), which
  keeps sharp out of the server functions (26 MB -> 7 MB each). Switch it back
  before using `<Image>`.

## Environment Variables

CMS (`apps/cms/.env`):

```bash
POSTGRES_URL=              # Neon Postgres connection string (required at startup)
PAYLOAD_SECRET=            # 32+ char JWT secret
CMS_URL=                   # CMS origin (NEXT_PUBLIC_SERVER_URL is a legacy alias)
WEB_URL=                   # Astro frontend origin; unset = no invalidation webhook, preview targets localhost:4321
PREVIEW_SECRET=            # Shared with web: gates the draft cookie
REVALIDATE_SECRET=         # Shared with web: bearer token for /api/invalidate
BLOB_READ_WRITE_TOKEN=     # Vercel Blob storage token
ANTHROPIC_API_KEY=         # Translate button (Claude); TRANSLATION_MODEL optional
```

Web (`apps/web/.env` — see `apps/web/README.md`):

```bash
CMS_URL= WEB_URL= PREVIEW_SECRET= REVALIDATE_SECRET=
PAYLOAD_API_KEY=           # web-frontend service account key (draft fetches)
CMS_PROTECTION_BYPASS=     # optional; athena-cms Protection Bypass for Automation
```

## Key URLs (Local Dev)

- `http://localhost:4321` - Astro frontend
- `http://localhost:3000` - CMS (redirects to `/admin`)
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
6. Keep `withPayload` and the browser `payload/internal` alias (in both
   `turbopack.resolveAlias` and `webpack()`) in apps/cms (see [Build Configuration](#build-configuration-appscmsconfignextconfigmjs))
7. Re-run `bun run generate:importmap` after upgrading `@payloadcms/*` packages
8. Astro excludes underscore-prefixed files from routing — the invalidation
   endpoint is `/api/invalidate` (no underscore); keep `invalidateWeb.ts` in sync
9. Payload REST defaults to `limit=10`, and drafts require auth — the web app's
   `lib/cms.ts` always sets `depth`/`limit` explicitly and authenticates draft fetches
10. Vercel `git.deploymentEnabled` unspecified keys default to `true`. Keep the
    `"**": false` whitelist or Hobby Preview will build every `cursor/*` branch.
11. The root `package.json` pins `typescript@^6` on purpose: hoisted tooling
    (`astro check` via `@volar/kit`) resolves TypeScript from the repo root and
    crashes on TS 7. `apps/cms` gets TS 7 nested in its own `node_modules`.
    Don't remove the root pin until `astro check` supports TS 7.
12. **New tables or columns need manual SQL in production and on the preview
    Neon branch** (schema push is off there). Write idempotent SQL and record it
    in `docs/UPGRADE_NOTES.md` (procedure: `docs/DATABASE.md`). The web app
    falls back to defaults while the `site` table is missing.
13. **Content is localized** (`en` default, `ja`, `zh`). Localized fields live
    in `*_locales` tables, so adding `localized: true` to an existing field is
    a schema change (see pitfall 12). The web app passes `locale` +
    `fallback-locale=en` on every CMS fetch and must keep `/ja`/`/zh` links
    via `localizePath` (`apps/web/src/lib/i18n.ts`).
14. **Never enable Vercel Deployment Protection on athena-cms Production.** It
    302s `/api/*` to Vercel SSO, and athena-web HTML routes 500. Protect
    Preview only; Payload already gates `/admin`. If Production must stay
    protected, set `CMS_PROTECTION_BYPASS` on athena-web (server-side fetches
    only — browser form posts to the CMS still fail).
15. **Bun runtime caveats**: Vercel's automatic source maps and bytecode
    caching are Node-only; `engines.node` in an app `package.json` silently
    switches its functions back to Node. To roll back, remove `bunVersion`
    and the `--bun` flags and restore `engines.node: "24.x"`.
