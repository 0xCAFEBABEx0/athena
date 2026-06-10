# Upgrade Notes

A running log of notable dependency upgrades. Newest first.

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
