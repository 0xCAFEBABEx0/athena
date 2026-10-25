# Athena

A content-driven website: editors manage pages, posts, media, navigation and
forms in **Payload CMS**, and an **Astro** frontend renders the public site.
Production: https://www.findb.uk

| Workspace | What it is |
|---|---|
| [`apps/cms`](./apps/cms) | Payload CMS 3 on Next.js 16: admin panel, REST/GraphQL API, form intake, cache-invalidation webhooks. |
| [`apps/web`](./apps/web) | Astro 7 public site on Vercel (on-demand rendering + ISR), reading the CMS over REST. |
| [`packages/shared`](./packages/shared) | Generated Payload types and constants shared by both apps. |

Infrastructure: Vercel (two projects, one repo), Neon PostgreSQL, Vercel Blob
for media, Sentry for errors.

## Quick start

Requires Node.js 24.22.1 (`.nvmrc`) and Bun 1.4.x. Bun is the only supported
package manager.

```bash
bun install
# create apps/cms/.env and apps/web/.env (see docs/API.md#5-environment-variables)
bun run dev:cms   # http://localhost:3000/admin
bun run dev:web   # http://localhost:4321
```

Other commands: `bun run build`, `bun run lint`, `bun run generate:types`,
`bun run generate:importmap`. See the [Development Guide](./docs/DEVELOPMENT.md).

## Branches and releases

`development` → `preview` (Vercel Preview) → `main` (Vercel Production, PR
only). See [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md).

## Documentation

Everything lives in [`docs/`](./docs/README.md):

- [Architecture](./docs/ARCHITECTURE.md)
- [Functional Specification](./docs/SPECIFICATION.md)
- [Content Model](./docs/CONTENT_MODEL.md)
- [API Reference](./docs/API.md)
- [Database](./docs/DATABASE.md)
- [Decision Records](./docs/adr/README.md)
- [Deployment](./docs/DEPLOYMENT.md) · [CI/CD](./docs/CI_CD.md) · [Sentry](./docs/SENTRY_SETUP.md) · [Upgrade Notes](./docs/UPGRADE_NOTES.md)

Guidance for AI coding agents is in [`AGENTS.md`](./AGENTS.md).

## License

MIT
