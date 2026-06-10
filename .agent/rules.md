# Project Rules

> Quick reference. Full project guidance lives in [`../AGENTS.md`](../AGENTS.md);
> task-specific workflows live in [`./workflows/`](./workflows) and [`../docs/`](../docs).

## 🏗️ Project Structure

- **Backend**: Payload CMS 3 + PostgreSQL
- **Frontend**: Next.js 15 (App Router)
- **Database**: PostgreSQL (Neon cloud, via `@payloadcms/db-vercel-postgres`)
- **Styling**: Tailwind CSS v3 + daisyUI v4 + shadcn/ui pattern
- **Package Manager**: Bun (never `npm` or `pnpm`)

## 📝 Code Style

- **Language**: TypeScript (strict mode) for all new code.
- **Linting**: Follow ESLint and Prettier configurations (`bun run lint`).
- **Naming**:
    - Components: `PascalCase` (e.g., `UserProfile.tsx`)
    - Utilities: `camelCase` (e.g., `formatDate.ts`)
    - Types: `PascalCase`
- **Imports**: Use the `@/*` path alias for `src/*`. Use type-only imports for
  Payload generated types.

## ⚛️ Component Guidelines

- Server Components by default; add `'use client'` only when needed.
- Use functional components with hooks and proper TypeScript types.
- Style with Tailwind utilities; merge classes with `cn()` from `@/utilities/ui`.

## 🗄️ Database

- Model data with Payload CMS collections.
- Run migrations with `bun payload migrate` for schema changes.
- Never hand-edit `src/payload-types.ts`; regenerate with `bun run generate:types`.

## 🔒 Security

- Validate all user inputs.
- Use environment variables for sensitive data (see Required env vars in `AGENTS.md`).
