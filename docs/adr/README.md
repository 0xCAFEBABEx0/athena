# Architecture Decision Records

Short records of decisions that shape the codebase. Each one states the
context, the decision and its consequences, so a future change can tell
whether the original reasons still hold.

| # | Title | Status |
|---|---|---|
| [0001](./0001-separate-astro-frontend.md) | Serve the public site from a separate Astro app | Accepted |
| [0002](./0002-isr-with-webhook-invalidation.md) | On-demand rendering with ISR and webhook invalidation | Accepted |
| [0003](./0003-draft-preview-service-account.md) | Draft preview through a cookie and a service-account API key | Accepted |
| [0004](./0004-monorepo-two-vercel-projects.md) | Bun monorepo deployed as two Vercel projects | Accepted |
| [0005](./0005-manual-production-schema-changes.md) | Apply production schema changes by hand for now | Accepted (interim) |

To add one, copy the structure of an existing record, number it sequentially
and add it to this table. Do not rewrite an accepted record; supersede it with
a new one.
