# Upgrade Notes

A running log of notable dependency upgrades. Newest first.

## Monorepo conversion + Next.js 16 + Astro 6 frontend

The single-app project was restructured into a **Bun-workspaces monorepo** and the
public frontend was ported off Next.js. This landed several of the majors that
earlier entries deliberately held back. See [`AGENTS.md`](../AGENTS.md) for the
current architecture.

### Structure

- **`apps/cms`** — the former root app: Payload CMS 3 + Next.js 16 (admin +
  REST/GraphQL API, plus a legacy in-app frontend kept only for the bridge period).
- **`apps/web`** — new Astro 6 public frontend on `@astrojs/vercel` (SSR + ISR),
  consuming the CMS over REST. Tailwind CSS **v4** via `@tailwindcss/vite`.
- **`packages/shared`** — generated Payload types + cross-app constants
  (`CACHE_TAGS`, `DRAFT_COOKIE`, `COLLECTION_SLUGS`, `IMAGE_SIZES`).

### Landed majors (previously "held back")

| Package | From | To | Notes |
|---|---|---|---|
| `next` / `eslint-config-next` | 15.4.x | **16.x** | Payload 3 now supports Next 16. Build keeps `next build --webpack` (Next 16 defaults to Turbopack, which ignores the load-bearing webpack alias). |
| `tailwindcss` (web) | — | **4.x** | Only in `apps/web` (via `@tailwindcss/vite`). `apps/cms` stays on Tailwind **v3 + daisyUI v4**. |

`next lint` was removed in Next 16; the CMS lint script now calls `eslint .`
directly (flat config using `eslint-config-next`'s native flat exports). Re-run
`bun run generate:importmap` after upgrading any `@payloadcms/*` package.

### Database adapter

The CMS uses `@payloadcms/db-postgres` against **Neon** PostgreSQL (the earlier
`@payloadcms/db-vercel-postgres` adapter and `payloadCloudPlugin` are gone).

### Commands & deploy

All scripts moved to the repo root with workspace filters (`bun run dev:cms`,
`dev:web`, `build:cms`, `build:web`, `generate:types`, `generate:importmap`).
Deployment is now **two Vercel projects** (Root Directory `apps/cms` and
`apps/web`) from one repo — see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

> **Note:** the "held back (breaking majors)" table in the entry below is
> historical — `next` (→16) and `tailwindcss` (→4, web only) have since landed as
> described above.

## Payload CMS 3.69 → 3.85 + dependency refresh

Brought all dependencies to their latest versions that stay compatible with the
current stack (Payload 3 + Next.js 15). Breaking-change majors were intentionally
held back (see below).

### Updated

- **Payload CMS**: `3.69.0` → `3.85.1` (all `@payloadcms/*` packages).
- **React / React DOM**: `19.2.3` → `19.2.7`.
- **Sentry**: `@sentry/nextjs` `10.32` → `10.57`.
- **Radix UI**: checkbox/label/select/slot patch + minor bumps.
- **Others**: `cross-env`, `geist`, `graphql`, `react-hook-form`, `tailwind-merge`,
  `@tailwindcss/typography`, `autoprefixer`, `jiti`, `postcss`, `prettier`,
  `@eslint/eslintrc`, `@types/node` (within v24), `@types/react`, `checkly` (within v6),
  `eslint` (within v9).

### Held back (breaking majors)

| Package | Current | Latest | Why held |
|---|---|---|---|
| `next` / `eslint-config-next` | 15.4.10 | 16.x | `@payloadcms/next` peer-depends on `next@^15.2.3` |
| `tailwindcss` | 3.4.x | 4.x | v4 is a config/engine rewrite; daisyUI v4 needs Tailwind v3 |
| `daisyui` | 4.x | 5.x | Breaking; coupled to the Tailwind v4 migration |
| `typescript` | 5.9.x | 6.x | Major; deferred until the framework majors land |
| `eslint` | 9.x | 10.x | Major; `eslint-config-next@15` targets ESLint 9 |
| `lucide-react` | 0.562 | 1.x | Major (icon API surface) |

### Required config fix

The upgrade surfaced a build break. `config/next.config.mjs` now:

1. Wraps the config with `withPayload(...)`.
2. Aliases `'payload/internal': false` in the **client** webpack build.

The Vercel Blob client upload handler imports `getFileKey` from a barrel that also
re-exports server-only code (`resolveSignedURLKey` → `payload/internal` → undici),
which references `node:*` builtins webpack cannot bundle for the browser. The alias
keeps that dead code out of the client bundle. Without it, `bun run build` fails with
`UnhandledSchemeError: Reading from "node:console"`. The admin `importMap.js` was also
regenerated (`CollectionCards` moved from `@payloadcms/ui/rsc` to `@payloadcms/next/rsc`).

### Verification

- [x] `bun run build` succeeds.
- [x] `bun run lint` passes (pre-existing warnings only).
- [x] `bun run generate:types` produces no changes.

---

## Payload CMS 3.53 → 3.69 + Next.js 15.2.6 → 15.4.10

- **Payload CMS**: `3.53.0` → `3.69.0` (all `@payloadcms/*` packages).
- **Next.js**: `15.2.6` → `15.4.10` to satisfy the Payload 3.69 peer dependency.
- **Bun**: `1.2.19` → `1.3.5`.
- **React**: `19.1.4` → `19.2.3` (security fixes).
- **daisyUI**: added `v4` for UI component styling.
- **Sentry**: config updated for v10 (`disableLogger` → `treeshake`).
- Verified: full build, dev server, SSG for posts/pages, sitemap generation.
