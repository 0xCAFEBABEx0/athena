# AGENTS.md

> Canonical guidance for AI coding agents working in this repo.
> `CLAUDE.md` imports this file, so there is a single source of truth.
> Deep-dive human docs live in [`docs/`](./docs).

## Project Overview

**Athena** is a content-driven website built on **Payload CMS 3 + Next.js 15 (App Router)**. It serves as a personal site/blog with a full headless CMS backend, admin panel, and public-facing frontend. Deployed on Vercel with Neon PostgreSQL and Vercel Blob for media storage.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + Payload CMS 3
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 22 (pinned to 22.22.0 via `.nvmrc`)
- **Package Manager**: Bun (always use `bun`, never `npm` or `pnpm`)
- **Database**: PostgreSQL 16 (Vercel/Neon adapter)
- **Styling**: Tailwind CSS v3 + daisyUI v4 + shadcn/ui pattern
- **Rich Text**: Lexical (via @payloadcms/richtext-lexical)
- **Monitoring**: Sentry, Vercel Analytics, Checkly

## Key Commands

```bash
bun dev                       # Dev server with Turbopack (localhost:3000)
bun run build                 # Production build
bun run lint                  # ESLint
bun run lint:fix              # ESLint with auto-fix
bun run generate:types        # Regenerate Payload TypeScript types
bun run generate:importmap    # Regenerate admin import map
bun payload migrate           # Run DB migrations
bun run deploy:preview        # Merge development -> preview and push
bun run deploy:production     # Merge preview -> main and push
```

## Directory Structure

```
src/
├── app/
│   ├── (frontend)/           # Public pages (homepage, posts, search, etc.)
│   └── (payload)/            # Payload admin panel + API routes
├── blocks/                   # Payload content blocks (ArchiveBlock, Banner, CTA, etc.)
├── collections/              # Payload collection configs (Pages, Posts, Media, Categories, Users)
├── components/               # Shared React components
│   └── ui/                   # shadcn/ui primitives
├── fields/                   # Reusable Payload field definitions
├── heros/                    # Hero section variants (HighImpact, LowImpact, etc.)
├── hooks/                    # Payload hooks (formatSlug, revalidate, etc.)
├── migrations/               # Database migrations
├── plugins/                  # Payload plugin configuration
├── providers/                # React context providers
├── utilities/                # Helper functions (cn(), getURL(), env detection)
├── payload.config.ts         # Main Payload CMS configuration
└── payload-types.ts          # Auto-generated types (DO NOT EDIT)

config/
└── next.config.mjs           # Real Next.js config (root next.config.mjs re-exports this)
```

## Code Conventions

- **TypeScript strict mode** with `noUncheckedIndexedAccess` and `strictNullChecks`
- **Path alias**: `@/*` maps to `./src/*` - use consistently
- **Never edit** `src/payload-types.ts` - regenerate with `bun run generate:types`
- **Server Components by default**; add `'use client'` only when needed
- **Styling**: Use Tailwind utility classes; use `cn()` from `@/utilities/ui` for class merging
- **Dark mode**: Controlled by `data-theme="dark"` attribute, not OS media query
- **Prefix unused vars** with `_` to suppress lint warnings
- **ESLint**: Flat config extending `next/core-web-vitals` + `next/typescript`

## Payload CMS Patterns

- Collections export a `CollectionConfig` typed with their slug
- Use `authenticatedOrPublished` access for public read, `authenticated` for write
- Versions/drafts with autosave enabled on Posts and Pages
- Hooks for revalidation (`afterChange`, `afterDelete`) trigger Next.js ISR
- Changing `src/payload.config.ts` requires a dev server restart
- Run `bun run generate:importmap` after adding new Payload admin components **or after upgrading any `@payloadcms/*` package** (component import paths can move between versions)

## Build Configuration (`config/next.config.mjs`)

The Next.js config is split out into `config/next.config.mjs`; the root `next.config.mjs`
just re-exports it. Two things there are load-bearing and easy to break:

1. **`withPayload(...)`** wraps the config so Payload's server-only packages are
   externalized correctly. Do not remove it.
2. **Client webpack alias `'payload/internal': false`** — the Vercel Blob client
   upload handler pulls `getFileKey` from a barrel that also re-exports
   server-only code (`resolveSignedURLKey` -> `payload/internal` -> undici, which
   references `node:*` builtins). That code never runs in the browser, so the alias
   keeps it out of the client bundle. Without it, `bun run build` fails with
   `UnhandledSchemeError: Reading from "node:console"`.

Sentry (`withSentryConfig`) wraps the result only when `SENTRY_DSN` +
`SENTRY_ORG`/`SENTRY_PROJECT` are set.

## Git Workflow

Three-branch linear promotion: `development` -> `preview` -> `main`

| Branch | Purpose | Deploys To |
|---|---|---|
| `development` | Active development | None |
| `preview` | Staging review | Vercel Preview |
| `main` | Production | Vercel Production |

CI (GitHub Actions) runs lint + type check on push to `main`/`preview` and PRs to `main`.

## Environment Variables (Required)

```bash
POSTGRES_URL=              # Neon/Vercel Postgres connection string
PAYLOAD_SECRET=            # 32+ char JWT secret
NEXT_PUBLIC_SERVER_URL=    # Base URL (no trailing slash)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob storage token
```

## Key URLs (Local Dev)

- `http://localhost:3000` - Frontend
- `http://localhost:3000/admin` - Payload admin panel
- `http://localhost:3000/api/graphql-playground` - GraphQL Playground

## Common Pitfalls

1. `POSTGRES_URL` is required at startup - app throws without it
2. Bun is the only supported package manager. A stray `package-lock.json` will be
   picked up by the Dockerfile's package-manager detection **before** `bun.lock`
   (`npm ci` wins), so keep it deleted.
3. Sentry wraps Next.js config only when `SENTRY_DSN` + `SENTRY_ORG`/`SENTRY_PROJECT` are set
4. Dockerfile uses Docker Hardened Images (`dhi.io/`), not standard Docker Hub
5. Use type-only imports for Payload generated types
6. Keep `withPayload` and the `'payload/internal': false` client alias in
   `config/next.config.mjs` (see [Build Configuration](#build-configuration-confignextconfigmjs))
7. Re-run `bun run generate:importmap` after upgrading `@payloadcms/*` packages
