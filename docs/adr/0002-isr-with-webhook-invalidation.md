# 0002. On-demand rendering with ISR and webhook invalidation

- **Status**: Accepted
- **Area**: `apps/web/astro.config.mjs`, `apps/web/src/pages/api/invalidate.ts`,
  `apps/cms/src/utilities/invalidateWeb.ts`

## Context

Content changes must appear within seconds of publishing, drafts must be
previewable on the real site, and the Vercel Hobby plan limits builds
(1 concurrent, 100 deploys a day). A static build per publish is too slow and
would burn the build quota; rendering every request without caching would put
the CMS on the hot path for every visitor.

## Decision

- Astro `output: 'server'` with the Vercel adapter's ISR.
- `isr.expiration = 300` as a safety net.
- On publish, unpublish or delete, CMS hooks POST `{ paths, tags }` to the web
  app's `/api/invalidate`. The endpoint re-requests each path with the
  `x-prerender-revalidate` bypass token so Vercel re-renders it.
- Tags that cannot be mapped to a finite set of paths (header, footer,
  redirects) rely on the expiration.
- `invalidateWeb` never throws, so a web outage cannot block publishing.

## Consequences

- Targeted pages update in seconds; navigation, paginated archives and pages
  with Archive blocks can be up to five minutes stale.
- `REVALIDATE_SECRET` doubles as the ISR bypass token and must match in both
  projects. A mismatch fails silently (logged `401`s).
- Draft responses must opt out of the shared cache (`Cache-Control: private,
  no-store`).
