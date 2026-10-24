# API Reference

Interfaces between the two apps and toward the outside world. For the
data shapes behind these endpoints see [CONTENT_MODEL.md](./CONTENT_MODEL.md).

> **Related**: [Architecture](./ARCHITECTURE.md) · [Content Model](./CONTENT_MODEL.md)

## 1. Web App Endpoints (`apps/web/src/pages`)

All `/api/*` routes are excluded from ISR caching.

### `GET /api/preview`

Entry point for draft preview. Target of the admin **Preview** button and of
Live Preview.

| Query param | Required | Meaning |
|---|---|---|
| `previewSecret` | yes | Must equal `PREVIEW_SECRET`. |
| `path` | yes | Path to open, must start with `/` (e.g. `/posts/hello`). |
| `slug`, `collection` | no | Sent by the CMS; currently informational. |

| Result | Response |
|---|---|
| Valid | `307` → `path`, sets `athena-draft=1` (HttpOnly, `SameSite=Lax`, `Secure` in production, `Path=/`). |
| Bad or missing secret, or `PREVIEW_SECRET` unset | `401 Invalid preview secret` |
| Bad path | `400 Invalid path` |

### `GET /api/exit-preview`

Deletes the `athena-draft` cookie and redirects (`307`) to `?path=` when it
starts with `/`, otherwise to `/`.

### `POST /api/invalidate`

Cache-invalidation webhook called by the CMS (`invalidateWeb.ts`).

```http
POST /api/invalidate
Authorization: Bearer <REVALIDATE_SECRET>
Content-Type: application/json

{ "paths": ["/posts/hello", "/posts"], "tags": ["posts", "sitemap"] }
```

Processing:

1. Reject with `401` unless the bearer token equals `REVALIDATE_SECRET`.
2. Reject with `400` if the body is not JSON.
3. Keep `paths` entries that are strings starting with `/`.
4. Add paths for known tags: `sitemap` → `/pages-sitemap.xml`,
   `/posts-sitemap.xml`; `posts` → `/posts`. Other tags (`global_header`,
   `global_footer`, `redirects`, `pages`) add nothing and rely on the 300 s ISR
   expiration.
5. For each path, `GET ${WEB_URL}{path}` with `x-prerender-revalidate: <secret>`
   (10 s timeout), which makes Vercel re-render and re-cache it.

Response `200`:

```json
{ "revalidated": ["/posts/hello"], "failed": [], "tags": ["posts", "sitemap"] }
```

### Content routes

| Route | Source | Notes |
|---|---|---|
| `/` and `/{slug}` | `[...slug].astro` | Page by slug (`home` for `/`). Multi-segment paths → 404. Draft-aware. |
| `/posts` | `posts/index.astro` | Page 1 of posts, 12 per page, newest `publishedAt` first. |
| `/posts/page/{n}` | `posts/page/[pageNumber].astro` | `n` must be a positive integer within range, otherwise 404. |
| `/posts/{slug}` | `posts/[slug].astro` | Post detail with related posts. Draft-aware. |
| `/search?q=` | `search.astro` | Up to 12 matches from the `search` collection. |
| `/sitemap.xml` | `sitemap.xml.ts` | Index pointing at the two sitemaps below. |
| `/pages-sitemap.xml`, `/posts-sitemap.xml` | | Published slugs with `lastmod = updatedAt`. `503` with `no-store` if the CMS fails. |
| `/robots.txt` | `robots.txt.ts` | Allow all, disallow `/api/`, link the sitemap index. |
| `/llms.txt` | `public/llms.txt` | Static site summary for LLM crawlers. |
| `/404`, `/500` | | `500` is standalone and does not call the CMS. |

### Middleware

`src/middleware.ts` runs before content routes. If the pathname equals a
`redirects.from` value it answers `301` to the resolved target. Skipped for
`/api/*`, `/_*` and any path containing `.`.

## 2. CMS REST API Used by the Web App

Base: `${CMS_URL}/api`. All calls are made server-side by
`apps/web/src/lib/cms.ts`, except form submission (browser). Query objects are
encoded with `qs-esm`.

| Function | Request | Key params |
|---|---|---|
| `getPage(slug)` | `GET /pages` | `where[slug][equals]`, `depth=2`, `limit=1`, `pagination=false` |
| `getPost(slug)` | `GET /posts` | same as above |
| `getPosts({page})` | `GET /posts` | `depth=1`, `limit=12`, `page`, `sort=-publishedAt`, `select` title/slug/categories/meta |
| `getArchivePosts` | `GET /posts` | `depth=1`, `limit`, optional `where[categories][in]` |
| `getGlobal(slug)` | `GET /globals/header` or `/globals/footer` | `depth=1` |
| `searchPosts(q)` | `GET /search` | `limit=12`, `or` of `like` on title, meta.title, meta.description, slug |
| `getRedirects()` | `GET /redirects` | `limit=0`, `pagination=false` |
| `getAllSlugs(c)` | `GET /pages` or `/posts` | `limit=0`, `pagination=false`, `select` slug/updatedAt, `where[_status][equals]=published` |

Request headers:

| Header | When |
|---|---|
| `Authorization: users API-Key <PAYLOAD_API_KEY>` | Draft reads only (`{ draft: true }`), which also add `draft=true`. Throws if the key is missing. |
| `x-vercel-protection-bypass: <CMS_PROTECTION_BYPASS>` | When that env var is set. |

Error handling (`parseCmsResponse`): network failure, any `3xx` (including the
Vercel SSO bounce), non-`2xx`, non-JSON content type and invalid JSON all
throw `CmsRequestError { status, path }`. Unit tests live in
`apps/web/src/lib/cms.test.ts` (`bun test` in `apps/web`).

### Form submission (browser → CMS)

```http
POST ${CMS_URL}/api/form-submissions
Content-Type: application/json

{ "form": "3", "submissionData": [{ "field": "email", "value": "a@example.com" }] }
```

Allowed cross-origin because `WEB_URL` is in the CMS `cors` and `csrf` lists.
There is no captcha, honeypot or rate limit.

## 3. Other CMS Endpoints

| Endpoint | Purpose |
|---|---|
| `/admin` | Payload admin panel. |
| `/api/{collection}`, `/api/globals/{slug}` | Payload REST API (all collections). |
| `/api/graphql`, `/api/graphql-playground` | Payload GraphQL. |
| `/api/payload-jobs/run` | Jobs runner. Vercel Cron daily at 00:00 UTC; needs a logged-in user or `Authorization: Bearer ${CRON_SECRET}`. |
| `/api/sentry-test` | Sentry smoke test route. |
| `/next/preview`, `/next/exit-preview`, `/next/seed` | Legacy frontend routes (bridge period). `POST /next/seed` (logged-in users only, called by the admin dashboard's Seed button) **deletes existing pages, posts, media, categories, forms, submissions, search entries and globals** and loads demo content. Never run it against production. |

## 4. Shared Constants (`packages/shared/src/constants.ts`)

| Constant | Value | Used by |
|---|---|---|
| `DRAFT_COOKIE` | `athena-draft` | `lib/draft.ts` |
| `CACHE_TAGS` | `pages`, `posts`, `global_header`, `global_footer`, `redirects`, `sitemap` | CMS hooks, `/api/invalidate` |
| `COLLECTION_SLUGS` | REST collection slugs | both apps |
| `IMAGE_SIZES` | Media rendition names | web media helpers |

Changing any of these is a contract change between the two deployments: ship
both apps together.

## 5. Environment Variables

| Variable | CMS | Web | Purpose |
|---|---|---|---|
| `POSTGRES_URL` | required | | Neon connection string. `DATABASE_URL` is a fallback. |
| `PAYLOAD_SECRET` | required | | JWT / encryption secret. |
| `CMS_URL` | yes | required on Vercel | CMS origin. `NEXT_PUBLIC_SERVER_URL` is a legacy alias in the CMS. |
| `WEB_URL` | yes | yes | Web origin (custom domain). Unset in the CMS = legacy behaviour. |
| `PREVIEW_SECRET` | yes | yes | Must match. |
| `REVALIDATE_SECRET` | yes | yes | Must match. Also the ISR bypass token. |
| `PAYLOAD_API_KEY` | | yes | `web-frontend` API key for draft reads. |
| `CMS_PROTECTION_BYPASS` | | optional | Vercel protection bypass for server-side fetches. |
| `BLOB_READ_WRITE_TOKEN` | yes | | Vercel Blob. |
| `CRON_SECRET` | yes | | Jobs runner auth for Vercel Cron. |
| `DEPLOY_ENV` | optional | | Overrides `VERCEL_ENV` for stage detection (Sentry environment). |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | optional | | See [SENTRY_SETUP.md](./SENTRY_SETUP.md). |
