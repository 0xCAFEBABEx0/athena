# @athena/web

Astro frontend for Athena. Renders content from the Payload CMS (`apps/cms`)
over its REST API and deploys to Vercel (`@astrojs/vercel`, on-demand
rendering + ISR).

## Commands

```bash
bun run dev:web      # from repo root — dev server at http://localhost:4321
bun run build:web    # production build
bun run --filter @athena/web check   # astro check (types)
```

## Environment variables

`.env*` files are gitignored repo-wide; create `apps/web/.env` locally.

| Variable | Purpose |
|---|---|
| `CMS_URL` | Origin of the Payload CMS admin + REST API (e.g. `http://localhost:3000`). Required on Vercel — there is no localhost fallback. |
| `WEB_URL` | This app's own public origin (e.g. `https://www.findb.uk`). Use the custom domain, not the `*.vercel.app` URL. |
| `PREVIEW_SECRET` | Shared with the CMS; validates `/api/preview` requests before the draft cookie is set. |
| `REVALIDATE_SECRET` | Shared with the CMS; bearer token for `POST /api/invalidate`, also used as the ISR bypass token. |
| `PAYLOAD_API_KEY` | API key of the CMS `web-frontend` service-account user (Users collection, "Enable API Key"). Lets draft preview fetch unpublished content over REST. Server-side only. |
| `CMS_PROTECTION_BYPASS` | Optional. Copy of the athena-cms **Protection Bypass for Automation** secret. Sent as `x-vercel-protection-bypass` so server-side REST fetches still work if the CMS deployment is SSO-protected. Browser form posts to the CMS still need a public API. |

`PREVIEW_SECRET` and `REVALIDATE_SECRET` must be byte-identical to the CMS
deployment's values — drift shows up as silent 401s (the CMS's
`invalidateWeb` logs errors but never throws).

## CMS contract

- `GET /api/preview?slug&collection&path&previewSecret` — target of the admin
  Preview button (`generatePreviewPath` in apps/cms). Sets the HttpOnly
  `athena-draft` cookie and redirects to `path`.
- `GET /api/exit-preview?path=/...` — clears the draft cookie.
- `POST /api/invalidate` with `Authorization: Bearer $REVALIDATE_SECRET` and
  body `{ paths?: string[], tags?: CacheTag[] }` — called by the CMS on
  publish/unpublish; re-renders the affected ISR-cached paths.

Draft-aware pages check the cookie via `isDraft(Astro.cookies)` and pass
`{ draft: true }` to the `src/lib/cms.ts` fetchers.
