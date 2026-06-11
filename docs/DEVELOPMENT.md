# Development Guide

> Athena is a **Bun-workspaces monorepo** with two deployable apps. See
> [`AGENTS.md`](../AGENTS.md) for the canonical architecture overview.
>
> - **`apps/cms`** — Payload CMS 3 on Next.js 16 (admin panel + REST/GraphQL API).
> - **`apps/web`** — Astro 6 public frontend that consumes the CMS over REST.
> - **`packages/shared`** — generated Payload types + cross-app constants.

## 🚀 Getting Started

All commands are run **from the repo root** (Bun resolves the right workspace).

### Start the dev servers

```bash
bun run dev:cms      # CMS: admin + API at http://localhost:3000
bun run dev:web      # Astro frontend at http://localhost:4321
bun run dev          # both at once (filtered across all workspaces)
```

| Surface | URL |
|---|---|
| **Public frontend** (Astro) | http://localhost:4321 |
| **Admin Panel** (Payload) | http://localhost:3000/admin |
| **REST API** | http://localhost:3000/api |
| **GraphQL Playground** | http://localhost:3000/api/graphql-playground |

> The CMS still serves a **legacy in-app frontend** at `http://localhost:3000`
> during the bridge period, but the production public site is `apps/web`.

## 🔧 Development Commands (repo root)

```bash
# Dev servers
bun run dev:cms                 # CMS dev server (Next.js, :3000)
bun run dev:web                 # Astro dev server (:4321)

# Builds
bun run build                   # build all workspaces
bun run build:cms               # CMS production build (next build --webpack)
bun run build:web               # Astro production build

# Quality
bun run lint                    # ESLint (cms) + astro check (web)
bun run generate:types          # regenerate Payload types -> packages/shared
bun run generate:importmap      # regenerate the admin import map
```

CMS-only scripts (run via the workspace filter when you need them):

```bash
bun run --filter @athena/cms lint:fix      # eslint --fix
bun run --filter @athena/cms env:check     # print NODE_ENV / VERCEL_ENV
bun run --filter @athena/cms payload migrate
```

## 🗂️ Project Structure

```
apps/cms/src/
├── app/(frontend)/      # Legacy in-app public pages (bridge; replaced by apps/web)
├── app/(payload)/       # Payload admin panel + API routes
├── blocks/ collections/ fields/ heros/ hooks/ plugins/ providers/
├── utilities/           # invalidateWeb.ts, generatePreviewPath.ts, env.ts, getURL.ts
└── payload.config.ts    # Main Payload CMS configuration

apps/web/src/
├── pages/               # [...slug], posts/*, search, sitemaps, 404, api/* endpoints
├── components/          # Astro ports of the cms frontend (blocks/, heros/, ...)
├── lib/                 # cms.ts (REST client), richtext.ts, draft.ts, seo.ts, media.ts
├── layouts/Layout.astro # Theme init, meta tags, Header/Footer
└── middleware.ts        # Redirects-collection handling

packages/shared/src/
├── payload-types.ts     # Auto-generated — DO NOT EDIT (bun run generate:types)
└── constants.ts         # CACHE_TAGS, DRAFT_COOKIE, COLLECTION_SLUGS, IMAGE_SIZES
```

### Environment files

Each app has its own `.env` (both gitignored repo-wide):

```
apps/cms/.env            # copy from apps/cms/.env.example
apps/web/.env            # copy from apps/web/.env.example
```

See [Environment Variables in AGENTS.md](../AGENTS.md#environment-variables) for
the full list. The CMS↔web contract (`WEB_URL`/`CMS_URL`, `PREVIEW_SECRET`,
`REVALIDATE_SECRET`, `PAYLOAD_API_KEY`) is documented in
[the CMS ⇄ Web Contract section](../AGENTS.md#cms--web-contract).

## 🛠️ Tech Stack

- **CMS**: Payload CMS 3 + Next.js 16 (App Router), Tailwind CSS v3 + daisyUI v4
- **Web**: Astro 6 + `@astrojs/vercel` (SSR + ISR), Tailwind CSS v4 (`@tailwindcss/vite`)
- **Database**: PostgreSQL 16 via `@payloadcms/db-postgres` (Neon)
- **Media**: Vercel Blob (`BLOB_READ_WRITE_TOKEN`)
- **Rich text**: Lexical; the web app renders it via `convertLexicalToHTML` in
  `apps/web/src/lib/richtext.ts`
- **Monitoring**: Sentry, Checkly

## 🗄️ Database & Content

```bash
# Run migrations (from repo root)
bun run --filter @athena/cms payload migrate
bun run --filter @athena/cms payload migrate:status

# Seed demo content (CMS dev server must be running)
curl http://localhost:3000/next/seed
```

Access the admin panel at http://localhost:3000/admin to manage content.

## 🐛 Common Development Issues

### Port already in use

```bash
lsof -ti:3000 | xargs kill -9      # CMS
lsof -ti:4321 | xargs kill -9      # Astro
```

### TypeScript / stale types

```bash
bun run generate:types            # regenerate packages/shared/src/payload-types.ts
rm -rf apps/cms/.next             # clear the Next.js cache
```

### Payload admin issues

```bash
bun run generate:importmap        # regenerate the admin import map
rm -rf apps/cms/.next
```

> Re-run `bun run generate:importmap` after adding admin components **or after
> upgrading any `@payloadcms/*` package** — component import paths move between
> versions.

### Database connection issues

`POSTGRES_URL` is **required at startup** — the CMS throws without it. Verify
`apps/cms/.env`, then `bun run --filter @athena/cms payload migrate:status`.

## ⚠️ Things That Restart / Don't Hot-Reload

- **Payload config** (`apps/cms/src/payload.config.ts`) — restart the CMS dev server
- **Environment variable** changes — restart the affected dev server
- **`packages/shared`** changes — regenerate types and restart consumers

## 📝 Best Practices

- TypeScript strict mode (`noUncheckedIndexedAccess`, `strictNullChecks`); use
  type-only imports for Payload generated types.
- Path alias `@/*` → `./src/*` in both apps.
- Never edit `packages/shared/src/payload-types.ts` — regenerate it.
- CMS uses Server Components by default; add `'use client'` only when needed.
- Dark mode is driven by `data-theme="dark"` (stored under the `payload-theme`
  localStorage key), not the OS media query.
- Never commit `.env` files; copy from the `.env.example` templates.

## 🔄 Git Workflow

Three-branch linear promotion: `development` → `preview` → `main`. See
[`DEVELOPMENT_WORKFLOW.md`](./DEVELOPMENT_WORKFLOW.md) for the full flow.

## 🆘 Getting Help

- **Payload CMS**: https://payloadcms.com/docs
- **Next.js**: https://nextjs.org/docs
- **Astro**: https://docs.astro.build
- **Sentry**: https://docs.sentry.io
- **Tailwind**: https://tailwindcss.com/docs
