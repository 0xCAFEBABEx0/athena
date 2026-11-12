# API Reference

Interfaces between the two apps and toward the outside world. For the
data shapes behind these endpoints see [CONTENT_MODEL.md](./CONTENT_MODEL.md).

> **Related**: [Architecture](./ARCHITECTURE.md) · [Content Model](./CONTENT_MODEL.md)

## 1. Web App Endpoints (`apps/web/src/pages`)

All `/api/*` routes are excluded from ISR caching.
Everything else carries the Vercel cache tag `content` (added by the
middleware) and stays cached until `/api/invalidate` marks that tag stale.

### `GET /search-index.json` (also `/ja/…`, `/zh/…`)

Data for the popup search (⌘K or `/`). Returns every published post (newest
first) and page of that language, untranslated fields falling back to English:
`{ "posts": [{ "title", "href", "tag", "text" }], "pages": [{ "title", "href", "text" }] }`.
`text` holds the slug, summary and tags the browser also matches against.
The popup loads it once per page view and filters locally, so typing sends no
requests. ISR-cached like a page; `503` (`no-store`) if the CMS fails.

### `GET /search?q=` (also `/ja/…`, `/zh/…`)

Full search page. ISR drops the query string, so the page is rendered once per
language with every published post (`data-search-text` on each row) and the
browser hides the rows that do not match `?q=` (every word must appear in the
title, slug, summary or tags). New queries and typing never reach a function
or the CMS. Enter updates `?q=` with `history.replaceState`.

### `GET /api/preview`

Entry point for draft preview. Target of the admin **Preview** button and of
Live Preview.

| Query param | Required | Meaning |
|---|---|---|
| `previewSecret` | yes | Must equal `PREVIEW_SECRET`. |
| `path` | yes | Path on this site to open (e.g. `/posts/hello`): one leading `/`, no `//host` or backslash. |
| `slug`, `collection` | no | Sent by the CMS; currently informational. |

| Result | Response |
|---|---|
| Valid | `307` → `path`, sets `athena-draft=1` and `__prerender_bypass=<ISR bypass token>` (HttpOnly, `SameSite=Lax`, `Secure` in production, `Path=/`). Pages serve drafts only when both are present and the token matches. |
| Bad or missing secret, or `PREVIEW_SECRET` unset | `401 Invalid preview secret` |
| Bad path | `400 Invalid path` |

### `GET /api/exit-preview`

Deletes the draft cookies and redirects (`307`) to `?path=` when it is a path
on this site (same rule as above), otherwise to `/`.

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
   `/posts-sitemap.xml`; `posts` → `/`, `/posts`, `/rss.xml`,
   `/search-index.json`; `pages` → `/search-index.json`; `global_site` → `/`,
   `/posts`, `/rss.xml`. Every path except the sitemaps is expanded to its
   `/ja` and `/zh` copies.
5. Call `invalidateByTag('content')` (`@vercel/functions`): every cached page,
   feed, sitemap and search result is marked stale and re-renders once, in the
   background, on its next request. This is how header, footer, site and
   redirect changes reach every page. A `429` (purge rate limit) is retried
   twice.
6. For each path, `GET ${WEB_URL}{path}` with
   `x-prerender-revalidate: <bypass token>` (10 s timeout), which makes Vercel
   re-render and re-cache it right away. The bypass token is
   `sha256("isr-bypass:" + REVALIDATE_SECRET)` (`src/lib/isr-bypass.mjs`).
   On a deployment behind Vercel Authentication, the request also carries
   `x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET` (set by
   Vercel when the project has a Protection Bypass for Automation).

The response is sent after the re-renders, so the changed pages are fresh by
the time the CMS logs `Web invalidated`.

Response `200`:

```json
{ "invalidated": true, "revalidated": ["/posts/hello"], "failed": [], "tags": ["posts", "sitemap"] }
```

### Content routes

| Route | Source | Notes |
|---|---|---|
| `/` | `index.astro` | Home: `site` global intro, recent posts, projects. |
| `/{slug}` | `[...slug].astro` | Page by slug (`/home` redirects to `/`). Multi-segment paths → 404. Draft-aware. |
| `/posts` | `posts/index.astro` | Page 1 of posts, 12 per page, newest `publishedAt` first. |
| `/posts/page/{n}` | `posts/page/[pageNumber].astro` | `n` must be a positive integer within range, otherwise 404. |
| `/posts/{slug}` | `posts/[slug].astro` | Post detail with related posts. Draft-aware. |
| `/search?q=` | `search.astro` | Every post, filtered in the browser (one ISR page per language). |
| `/sitemap.xml` | `sitemap.xml.ts` | Index pointing at the two sitemaps below. |
| `/pages-sitemap.xml`, `/posts-sitemap.xml` | | Published slugs with `lastmod = updatedAt`. `503` with `no-store` if the CMS fails. |
| `/robots.txt` | `robots.txt.ts` | Allow all, disallow `/api/`, link the sitemap index. |
| `/llms.txt` | `llms.txt.ts` | Site summary for LLM crawlers, built from the Site global, the 10 newest posts and `/work` (English). |
| `/rss.xml` | `rss.xml.ts` | 30 newest posts. |
| `/404`, `/500` | | `500` is standalone and does not call the CMS. |

Every route except `/api/*` and the sitemaps also exists under `/ja` and
`/zh` (`/ja/posts/x`). English has no prefix. Content falls back to English
where a translation is missing.

### Middleware

`src/middleware.ts` runs before content routes. It strips a `/ja` or `/zh`
prefix, stores the language in `Astro.locals.locale` and rewrites to the
unprefixed route (ISR still caches by the original URL). If the path equals a
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
| `getPosts({page})` | `GET /posts` | `depth=1`, `limit=12`, `page`, `sort=-publishedAt`, `select` title/slug/categories/meta/publishedAt |
| `getAdjacentPosts(publishedAt)` | `GET /posts` ×2 | `limit=1`, `where[publishedAt][less_than / greater_than]`, `sort` ±publishedAt |
| `getArchivePosts` | `GET /posts` | `depth=1`, `limit`, optional `where[categories][in]` |
| `getGlobal(slug)` | `GET /globals/site`, `/globals/header` or `/globals/footer` | `depth=1` |
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

### Form submission (browser → web → CMS)

```http
POST /api/form-submissions            (athena-web, same origin)
Content-Type: application/json

{ "form": "3", "submissionData": [{ "field": "email", "value": "a@example.com" }] }
```

`apps/web/src/pages/api/form-submissions.ts` checks the body (form id, at most
50 string fields, 32 KB), drops any other key, and posts it to
`${CMS_URL}/api/form-submissions` with `x-vercel-protection-bypass` when
`CMS_PROTECTION_BYPASS` is set, without following redirects. Payload's status
and JSON errors are passed back; a redirect (the Vercel login), a network
failure or a non-JSON error becomes `502`. There is no captcha, honeypot or
rate limit.

## 3. Other CMS Endpoints

| Endpoint | Purpose |
|---|---|
| `/admin` | Payload admin panel. |
| `/api/{collection}`, `/api/globals/{slug}` | Payload REST API (all collections). |
| `/api/graphql`, `/api/graphql-playground` | Payload GraphQL. |
| `/api/payload-jobs/run` | Jobs runner. Vercel Schedules hourly (`0 * * * *` UTC, Hobby adds up to 15 min jitter); needs a logged-in user or `Authorization: Bearer ${CRON_SECRET}`. Each run also queues due scheduled tasks (`syncGitHub`, every 6 hours). |
| `POST /api/translate` | Body `{ collection: 'posts' \| 'pages' \| 'projects', id, locales? }`. Logged-in users only. Translates the English version with Claude and saves `ja`/`zh` as drafts (projects have no drafts: saved directly). `503` without `ANTHROPIC_API_KEY`, `422` if the reply is unusable, `502` on API errors. `maxDuration` 300 s. |
| `/api/sentry-test` | Sentry smoke test route. |
| `/` | Redirects to `/admin`. Any other non-admin, non-API path redirects (308) to the same path on `WEB_URL`. |

## 4. Shared Constants (`packages/shared/src/constants.ts`)

| Constant | Value | Used by |
|---|---|---|
| `DRAFT_COOKIE` | `athena-draft` | `lib/draft.ts` |
| `CACHE_TAGS` | `pages`, `posts`, `projects`, `global_site`, `global_header`, `global_footer`, `redirects`, `sitemap` | CMS hooks, `/api/invalidate` |
| `COLLECTION_SLUGS` | REST collection slugs | both apps |
| `IMAGE_SIZES` | Media rendition names | web media helpers |
| `LOCALES`, `DEFAULT_LOCALE` | `en`, `ja`, `zh`; `en` | Payload localization, web routing |

Changing any of these is a contract change between the two deployments: ship
both apps together.

## 5. Environment Variables

| Variable | CMS | Web | Purpose |
|---|---|---|---|
| `POSTGRES_URL` | required | | Neon connection string. `DATABASE_URL` is a fallback. |
| `PAYLOAD_SECRET` | required | | JWT / encryption secret. |
| `CMS_URL` | yes | required on Vercel | CMS origin. `NEXT_PUBLIC_SERVER_URL` is a legacy alias in the CMS. |
| `WEB_URL` | yes | yes | Web origin (custom domain). Unset in the CMS = no invalidation webhook, no public-URL redirects, preview targets `localhost:4321`. |
| `PREVIEW_SECRET` | yes | yes | Must match. |
| `REVALIDATE_SECRET` | yes | yes | Must match, in Preview and in Production. The ISR bypass token is derived from it. Unset in the CMS = saves do not refresh the web cache (logged as `Web invalidation skipped`). |
| `WEB_PROTECTION_BYPASS` | optional | | athena-web Protection Bypass for Automation secret, so the invalidation call passes Vercel Authentication on a protected Preview. |
| `PAYLOAD_API_KEY` | | yes | `web-frontend` API key for draft reads. |
| `CMS_PROTECTION_BYPASS` | | optional | athena-cms Protection Bypass for Automation secret, sent on every server-side CMS request (reads and form forwarding). Required on any environment where athena-cms is protected. |
| `BLOB_READ_WRITE_TOKEN` | yes | | Vercel Blob. |
| `ANTHROPIC_API_KEY` | for translation | | Claude API key for the Translate button. Unset = button answers 503. |
| `TRANSLATION_MODEL` | optional | | Overrides the translation model (default `claude-opus-5-5`). |
| `GITHUB_TOKEN` | for /work | | Fine-grained token with read access to public repositories only, for the `syncGitHub` job. Unset = entries show `syncError` and stay off `/work`. |
| `CRON_SECRET` | yes | | Jobs runner auth for Vercel Schedules (sent as a bearer token, like Vercel Cron). |
| `DEPLOY_ENV` | optional | | Overrides `VERCEL_ENV` for stage detection (Sentry environment). |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | optional | | See [SENTRY_SETUP.md](./SENTRY_SETUP.md). |
