---
description: Development workflow for the Bun-workspaces monorepo — server startup, linting, types, and git
---

# Development Workflow

> Monorepo: `apps/cms` (Payload + Next.js 16), `apps/web` (Astro 6),
> `packages/shared`. Run everything from the repo root. See
> [`AGENTS.md`](../../AGENTS.md).

## 🚀 Getting Started

```bash
bun run dev:cms      # CMS admin + API at http://localhost:3000
bun run dev:web      # Astro frontend at http://localhost:4321
bun run dev          # both at once
```

- Admin Panel: http://localhost:3000/admin
- Public frontend (Astro): http://localhost:4321

## 🛠️ Common Commands (repo root)

```bash
bun run lint                  # ESLint (cms) + astro check (web)
bun run generate:types        # regenerate Payload types -> packages/shared
bun run generate:importmap    # regenerate the admin import map
bun run build                 # build all workspaces

# CMS-only helpers (workspace filter)
bun run --filter @athena/cms lint:fix
bun run --filter @athena/cms env:check
```

### Database & Migrations

```bash
bun run --filter @athena/cms payload migrate     # run migrations
curl http://localhost:3000/next/seed             # seed (CMS dev server running)
```

## 🔄 Git Workflow

Three-branch promotion: `development` → `preview` → `main`.

1. Work on `development` (feature branches off it are fine).
2. Promote to staging: `bun run deploy:preview` (merge + push `preview`).
3. Release: open a PR `preview → main` (main is protected).

## 🐛 Troubleshooting

```bash
lsof -ti:3000 | xargs kill -9      # CMS port
lsof -ti:4321 | xargs kill -9      # Astro port

rm -rf apps/cms/.next              # clear Next.js cache
bun run generate:types             # refresh generated types
```
