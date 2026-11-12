# Upgrade Notes

A running log of notable dependency upgrades. Newest first.

## GitHub contribution graph on the home page — 2026-11-12

**CMS**

- Site global: new group `github` (`username`; `contributions` json, hidden;
  `syncedAt`, `syncError` read-only). `github/contributions.ts` reads the
  calendar with one GraphQL request (`GITHUB_TOKEN`, the same token as
  /builds) when the username is saved, and `syncGitHub` refreshes it every
  6 hours, saving the Site global only when the calendar changed.

**Web**

- `components/GitHubContributions.astro` on `/` (below the projects), from
  `site.contributions` (`lib/site.ts`).

**Database (manual, schema push is off)**

Run [`docs/sql/2026-11-12-github-contributions.sql`](./sql/2026-11-12-github-contributions.sql)
(four columns on `site`) on the preview Neon branch and then production,
before the CMS deploys. Checked: applied twice to a copy of the 1.1.0 schema,
it gives the same schema as a push of the new config.

**After deploying (content)**

- Globals → Site → GitHub contributions: enter the GitHub username and save.

## Sections renamed: `/notes`, `/builds`, `/stacks` — 2026-11-12

**Web**

- Posts moved from `/posts` to `/notes`, projects from `/work` to `/builds`,
  the Stack page from `/stack` to `/stacks` (the CLI, ADE, titles, feeds,
  sitemap and `llms.txt` follow). The paths live in `ROUTES`
  (`packages/shared/src/constants.ts`).
- `middleware.ts` answers the old paths in every language with a 308 to the
  new one (query string kept), cached at the CDN for a day.
- Links in the CMS typed with an old path (`/posts`, `/work`, `/stack`)
  resolve to the new route, so nothing breaks before they are edited.

**CMS**

- Invalidation paths and the draft preview path for posts use `ROUTES`.

**After deploying (content, no SQL)**

- Globals → Header: change the link labels (and, for tidiness, the URLs) to
  notes / builds / stacks, in each language.
- Search Console: nothing to do; the sitemap lists only the new URLs and the
  old ones redirect permanently.

## `/stack` page and the Stack global — 2026-11-12

**CMS**

- New global **`stack`** (`Stack/config.ts`): `intro`, `groups` (title,
  description) and their `items` (name, link, note, year, status, icon).
  Details in [CONTENT_MODEL.md](./CONTENT_MODEL.md#4-globals).
- On save, items with a link and no icon get the site's favicon, fetched by
  the CMS and stored in Media (Vercel Blob) as a 64×64 PNG, so visitors
  never request it from the tool's site or Google. Uses the existing `sharp`.
- New cache tag `global_stack` (`packages/shared/src/constants.ts`).

**Web**

- `/stack` (`pages/stack.astro`, `components/stack/StackList.astro`,
  `lib/stack.ts`) in both views and all three languages; listed in the pages
  sitemap while it has a tool. Add a `/stack` link to Globals → Header to
  show it in the menu.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-12-stack.sql`](./sql/2026-11-12-stack.sql) (creates
`stack`, `stack_locales`, `stack_groups`, `stack_groups_locales`,
`stack_groups_items`, `stack_groups_items_locales` and the
`enum_stack_groups_items_status` type) on the preview Neon branch and then
production, **before** the CMS deploy. Without it the CMS cannot load the
Stack global; the rest of the site is unaffected and `/stack` answers 404.
Idempotent; verified locally: applied twice to a copy of the previous
schema, it gives the same `pg_dump --schema-only` as a fresh push of the new
config.

## Security review of the 1.0.0 changes — 2026-11-11

Review of everything between `main` and `development` before the release.

**Web**

- `isDraft` (`lib/draft.ts`) requires `__prerender_bypass` to equal the ISR
  bypass token as well as the `athena-draft` cookie. Before, the presence of
  `athena-draft` was enough, so a request that reached a function with a
  hand-made cookie was rendered from drafts. Editors already in preview keep
  working (both cookies are set together); in production without
  `REVALIDATE_SECRET` draft mode is off.
- `/api/exit-preview` (no secret) and `/api/preview` accepted any `path`
  starting with `/`, including `//host`: an open redirect. Both now use
  `isLocalPath`.
- New `lib/safe-url.ts`: Site social links and project links, CMS custom
  link URLs, a /work entry's live URL (the CMS field or GitHub's homepage)
  and release link are dropped unless http(s), mailto, tel or an on-site
  path.
- `htmlToText` no longer throws on an out-of-range character reference.

**Scripts and docs**

- `warm-cache.sh` sends the protection-bypass secret only to the given host.
- `apps/cms/.env.example` and `apps/web/.env.example` added (the docs
  referred to them; `.gitignore` now lets them through).
- Docs corrected: Preview has its own Neon branch (DATABASE, SPECIFICATION
  said it shares production); cache timings (ARCHITECTURE, F-REDIR-2); ADR
  0002 / 0003 updates; warm-cache workflow in CI_CD; Testing and Versioning
  in the docs index.

No schema change.

## X picks on the home page — 2026-11-10

**CMS**

- The `site` global gains **`picks`** (max 6): a link to a post on X, an
  optional localized `note`, and `text`, `authorName`, `authorHandle`,
  `postedAt`, `lang`, filled on save from
  `publish.twitter.com/oembed?omit_script=1&dnt=true` (no API key, 10 s
  timeout). Links are stored as `https://x.com/<handle>/status/<id>`.
- `invalidateWeb` warns when `WEB_URL` or `REVALIDATE_SECRET` is unset (it
  returned silently), sends `x-vercel-protection-bypass` from the optional
  `WEB_PROTECTION_BYPASS`, and no longer follows redirects (a 302 to the
  Vercel login was counted as success). Found on Preview: athena-cms had
  `REVALIDATE_SECRET` for Production only, so saving the Site global left
  `preview.whoa.me` cached.
- `bun run --filter @athena/cms test` runs CMS unit tests (`bun test src`);
  `*.test.ts` is excluded from `tsc`.

**Web**

- `components/XPicks.astro` on the home page, after the projects. Plain HTML
  from the stored fields: no widget script, images or requests to X.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-10-site-picks.sql`](./sql/2026-11-10-site-picks.sql)
(creates `site_picks` and `site_picks_locales`) after
`2026-11-10-site-tagline.sql`, on the preview Neon branch and then
production, **before** the CMS deploy. Without it the CMS cannot read the
`site` global and the web app falls back to defaults. Idempotent; verified
locally: applied twice to a copy without the tables, it gives the same
schema as a fresh push of the new config.

## Performance and load: search, scanners, CSS, tests — 2026-11-10

**Web**

- `/search` is ISR-cached again (one page per language) and filters every
  post in the browser; it no longer queries the CMS `search` collection per
  `?q=`. `searchPosts` was removed from `lib/cms.ts`.
- Middleware: dotted paths that are not routes get a plain 404 without CMS
  requests (scanner traffic); `404.astro` sets
  `Vercel-CDN-Cache-Control: max-age=86400` (not for drafts).
- daisyUI `include:` list in `global.css` (add a component there before using
  it); fonts are Latin-only and never inlined as base64. CSS: 52.5 KB -> 20.7
  KB brotli.
- `Prompt.astro` exposes `data-prompt-line`, `data-prompt-question`,
  `data-prompt-heading`, `data-prompt-count` (used by `/search`).
- Tests: `bun run --filter @athena/web test` (unit, `src/**/*.test.ts`) and
  `test:e2e` (Playwright, `apps/web/e2e`, against `E2E_BASE_URL`). Case list:
  [`docs/TESTING.md`](./TESTING.md).

## Search metadata and home tagline — 2026-11-10

**CMS**

- The `site` global gains **`tagline`** (text, localized): the home page
  title becomes `<site name> — <tagline>` in tabs and search results. Empty =
  the site name alone (as before).
- The public nav no longer drops links to `/admin` in code; keep them out of
  Globals → Header / Footer (Master's call: the CMS controls it).

**Web**

- Search metadata per Google Search Central (SPECIFICATION F-SEO-1):
  descriptions everywhere, `noindex, follow` on `/search` and 404s, posts as
  `og:type=article` with dates, `og:locale`, JSON-LD (WebSite, BlogPosting,
  SoftwareSourceCode), and a pages sitemap with `/`, without `/search` and
  without invented `<lastmod>` values.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-10-site-tagline.sql`](./sql/2026-11-10-site-tagline.sql)
(adds `site_locales.tagline`) after `2026-11-10-cli-banner.sql`, on the
preview Neon branch and then production, **before** the CMS deploy.
Idempotent; verified locally: applied twice to a copy without the column, it
gives the same `site_locales` as a fresh push of the new config.

## CLI banner with Hoo the owl — 2026-11-10

**CMS**

- The `site` global gains a **CLI banner** group: `banner.style` (`fetch` =
  owl + details, `off` = the plain intro box), `banner.mascot` (show Hoo)
  and `banner.tips` (localized lines Hoo says when woken, in order; empty =
  built-in greeting and keyboard tips).
- The `site` global gains **`ogImage`** (upload): the default share image
  for pages without their own. Empty = the built-in `/og.png` with Hoo,
  which replaces the template's `website-template-OG.webp`.
- The seed no longer adds the template's footer links (Source Code, Payload).
  Existing databases keep them until they are deleted in Globals → Footer.

**Web**

- In the CLI view the home intro box becomes the banner: Hoo, a 30 × 27
  pixel owl drawn as inline SVG (`apps/web/src/lib/owl.ts`), beside the
  welcome line, name, intro and a `posts / updated / langs / links` list.
  From 48rem it has two panes: owl and profile centered on the left; "Tips
  for getting started" (buttons for `/`, `/status`, `v`, `t`) and "Recent
  activity" (three newest posts, pushes or releases) on the right.
  Hoo is a button: it waves, looks up and winks (300 ms a frame; straight to
  awake with Reduce motion) and says the next tip. The ADE view keeps its
  intro card.
- `/llms.txt` is generated from the CMS (Site global, newest posts, `/work`)
  instead of the template's static file, which named the site "Payload
  Website Template" and linked the old domain.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-10-cli-banner.sql`](./sql/2026-11-10-cli-banner.sql)
after `2026-11-10-whoa-i18n.sql`, on the preview Neon branch and then
production, **before** the CMS deploy (without it the CMS cannot read the
`site` global and the web app falls back to defaults). It also adds
`site.og_image_id`. Idempotent; verified
locally: applied twice to a database built by the previous code, it gives the
same schema as a fresh push of the new config.

## `/work`: GitHub repositories as threads — 2026-11-10

**CMS**

- New `projects` collection (admin label **Work**): one entry per public
  repository, with a localized summary, brief and write-up, a status override,
  Pinned and Hidden. The Translate button works on it too.
- New scheduled task `syncGitHub` (every 6 hours, run by the existing hourly
  jobs schedule) fetches all entries in one GitHub GraphQL request and writes
  only the changed ones. Needs **`GITHUB_TOKEN`** on athena-cms: a
  fine-grained token with public-repository read access only.

**Web**

- `/work` lists the entries by status (Waiting on you / Working / Idle /
  Resolved), with an open-PR count and the repository's social preview image
  when one was uploaded: a session
  picker in the CLI view (filter, ↑/↓, Enter, 1–9, `/`), a thread list in the
  ADE view. `/work/<slug>` shows one repository as a thread: brief, write-up,
  latest release, recent commits, details. Pinned entries replace the home
  page's project list (the Site global's projects remain the fallback).
  A repository that is private on GitHub can still be listed when it has a
  live URL ("Private on GitHub"): only the CMS text and the live link are
  shown.
- Relative times ("32m", "2 years ago") are written in the browser, so cached
  pages never go stale.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-10-work-projects.sql`](./sql/2026-11-10-work-projects.sql)
after `2026-11-10-whoa-i18n.sql`, on the preview Neon branch and then
production, **before** the CMS deploy. It adds the `projects` tables, the
`syncGitHub` job enum value and Payload's job scheduling table/column; every
statement is idempotent, so re-run the whole file where an earlier version
of it (without the `waiting` status or `private_repo`) was applied. Verified locally: applying it twice to a database
built by the previous code gives the same schema as a fresh push of the new
config (0 differences).

## whoa.me redesign, `site` global and en/ja/zh content — 2026-11-10

**CMS**

- New `site` global (`apps/cms/src/Site/config.ts`): site name, author name,
  default view (CLI or modern), welcome line, intro, description, social
  links and projects. The web app falls back to defaults while it is missing.
- Payload localization is on: `en` (default), `ja`, `zh`, with fallback to
  English. Localized: post/page titles, content, layouts, hero, SEO meta,
  category titles, nav labels, form labels, the site intro texts.
- Translate button in the post/page sidebar (`/api/translate`): Claude
  translates the English version and saves ja/zh as drafts for review. Needs
  `ANTHROPIC_API_KEY` on athena-cms (`TRANSLATION_MODEL` optional).

**Web**

- `/`, `/ja/…`, `/zh/…` routes (middleware strips the prefix), hreflang,
  per-language RSS and sitemaps, UI strings in `src/lib/i18n.ts`.
- CLI ⇄ ADE view switch (`v`, stored in localStorage `athena-view`; the value
  is `modern` in code and in the CMS), popup search (⌘K / `/`, filters
  `/search-index.json` in the browser).
- Caching: every response carries the Vercel cache tag `content`;
  `/api/invalidate` calls `invalidateByTag` on any CMS change. ISR expiration
  went from 5 minutes to 7 days. `/search` left ISR (it ignored `?q=`) and is
  CDN-cached per URL. Draft preview now sets `__prerender_bypass`, so editors
  see drafts on pages that are already cached. No new env vars.

**Database (manual, push is off)**

Run [`docs/sql/2026-11-10-whoa-i18n.sql`](./sql/2026-11-10-whoa-i18n.sql) on
the preview Neon branch, then production, **before** the CMS deploy. It
creates the site tables, the `*_locales` tables and `_locale` columns, copies
every existing value in as English, then drops the old columns, all in one
transaction. A second run only prints a notice; if a `site` table already
exists it stops without changing anything.

Verified locally: a database seeded by the previous code plus this script has
the same columns, indexes, constraints and enums as a fresh push of the new
config (0 differences), and the existing posts, pages, forms, nav labels and
search entries read back intact in English. This replaces the earlier
site-only SQL, which was never run.

## Dependabot round 1, Biome, TypeScript 7 (cms) — 2026-11-03

First Dependabot run (config in `.github/dependabot.yml`). Applied as one
commit to `development` because every PR rewrites `bun.lock`:

| Package | From | To |
|---|---|---|
| `payload` + `@payloadcms/*` | 3.92.0 | 3.92.1 (must move together) |
| `@sentry/nextjs` / `geist` / `lucide-react` | 11.9 / 1.8 / 1.61 | 11.10 / 1.9 / 1.66 |
| `astro` / `@astrojs/vercel` | 7.4.2 / 11.0.16 | 7.4.5 / 11.0.18 |
| `autoprefixer` / `postcss` | 10.6.1 / 8.5.31 | 10.6.2 / 8.5.32 |
| `checkly` | 9.5 | 10.1 |
| `actions/checkout` / `actions/setup-node` | v6 | v7 |

Follow-ups for the majors Dependabot proposed:

- **ESLint → Biome (cms)**. ESLint 10 itself worked (`eslint-config-next` 16.4
  added support, so the "held back" row below is outdated), but typescript-eslint
  cannot run on TypeScript 7 until the 7.1 API ships. `apps/cms` now lints with
  Biome 2.6 (`biome.json`: recommended preset + `react` / `next` domains).
  Template-era patterns that ESLint only warned about (array-index keys,
  exhaustive deps, shadowed `Error`/`Number` component names) stay warnings.
  Not covered by Biome: the React Compiler rules (`react-hooks/set-state-in-effect`,
  `react-hooks/refs`). Prettier still formats.
- **TypeScript 7 (cms only)**. `next build` (16.4) runs the project-local `tsc`
  CLI by default (`experimental.useTypeScriptCli`), so TS 7 works for builds;
  the native binary comes from a per-platform optional dependency. `apps/web`
  stays on TS 6 because `astro check` refuses TS 7; the root `package.json`
  pins `typescript@^6` so hoisted Astro tooling resolves TS 6 while cms gets
  TS 7 nested. CI now runs
  `bun run typecheck` (`tsc --noEmit` in cms); before this, CI ran no `tsc`.
- **graphql**: removed from `apps/cms` dependencies (no app code imports it;
  Payload's docs advise against a separate copy). Bun still installs 16.x as
  Payload's peer, so there is a single copy and Dependabot no longer proposes 17.
- **Tailwind 4 / daisyUI 5 (cms)**: not migrated; retiring the legacy
  `(frontend)` removes them instead.

## Node.js 22 → 24 LTS (24.22.1)

Moved the runtime to the Active LTS line. **v24.22.1** is the 24.x build of the
[2026-10-21 security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases),
so this keeps every fix that 22.23.4 shipped.

| Where | From | To |
|---|---|---|
| `.nvmrc` | `22.23.4` | `24.22.1` |
| root `engines.node` | `>=22.23.4 <23` | `>=24.22.1 <25` |
| `apps/cms` / `apps/web` `engines.node` | — | `24.x` |
| CI `setup-node` | `22.23.4` | `24.22.1` |
| `apps/cms/vercel.json` `NODE_VERSION` | `22.23.4` | `24.22.1` |
| Dockerfile dev image | `dhi.io/node:22-debian13-sfw-dev` | `dhi.io/node:24-debian13-sfw-dev` |
| `@types/node` (cms) | `^22.20.5` | `^24.19.2` (`undici-types` 6.21 → 7.24) |

Vercel reads `engines.node` from the `package.json` in each project's Root
Directory and only accepts a major (`24.x`); it overrides the project's
"Node.js Version" setting, so both projects build and run on the latest 24.x
Vercel provides. `@astrojs/vercel` derives the function runtime from the build's
Node major, so athena-web functions now deploy as `nodejs24.x`.

### Compatibility

- No installed package (1,291 checked) declares an `engines.node` range that
  excludes 24.22.1.
- Native addons (`sharp`, `bufferutil`, `utf-8-validate`, rolldown, Tailwind
  oxide, the Astro compiler) are N-API prebuilds, so no rebuild is needed.
- No other dependency changes were needed.

### Verification (Node 24.22.1)

- [x] `bun run lint` passes (warnings only, same as before).
- [x] `tsc --noEmit` passes in `apps/cms` against `@types/node` 24; `bun run generate:types` produces no diff.
- [x] `bun run build:cms` and `bun run build:web` succeed with no new warnings; web functions emit `"runtime": "nodejs24.x"`.
- [x] `bun test` in `apps/web` passes.
- [x] `next start` smoke test: `/admin/login`, `/api/pages`, `/api/posts` return 200.

---

## Node.js 22.23.4 (October 2026 security release) + dependency refresh

Node.js shipped security releases on 2026-10-21
([advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)).
The 22.x fix is **v22.23.4** (high: Brotli decoder OOB write in `node:zlib`, TLS
hostname-check bypasses for non-canonical IPv4 hosts, `dns.resolve*` NUL
truncation; medium: keep-alive response smuggling; plus c-ares, OpenSSL, SQLite,
Undici and CA-store updates). Pinned everywhere: `.nvmrc`, root `engines`
(`>=22.23.4 <23`), CI `setup-node`, `apps/cms/vercel.json` `NODE_VERSION`.
Bun moved to `1.4.4` (`packageManager`, CI).

### Updated

| Package | From | To | Notes |
|---|---|---|---|
| `payload` / `@payloadcms/*` | 3.89.0 | 3.92.0 | Adds `users.reset_password_requested_at` (nullable). Import map regenerated. |
| `next` / `eslint-config-next` | 16.3.3 | 16.4.3 | |
| `astro` | 6.4 | **7.4** | `compressHTML: true` set to keep v6 whitespace handling (v7 defaults to `'jsx'`). Requires Node `>=22.23.4`. |
| `@astrojs/vercel` | 10.0 | **11.0** | Peer of Astro 7. |
| `@sentry/nextjs` | 10.57 | **11.9** | `withSentryConfig` now from `@sentry/nextjs/config`; `enableLogs` removed; `dataCollection` set to the v10 defaults (v11 collects cookies/bodies by default); the webpack options that sat in an ignored third argument moved under `webpack`. |
| `typescript` | 5.9 | **6.0** | `baseUrl` removed from both tsconfigs (deprecated in 6.0); bare `src/...` imports in cms switched to `@/...`. |
| `checkly` | 6.9 | **9.5** | |
| `sharp` | 0.34 | 0.35 | |
| `lucide-react` | 0.562 | **1.x** | Icons used (`Check`, `Chevron*`, `MoreHorizontal`, `SearchIcon`) still exported. |
| `@types/node` | 24.x | 22.x | Aligned with the Node 22 runtime. |
| Others | | | React 19.3, Radix, geist, react-hook-form, tailwind-merge, postcss, prettier, autoprefixer, daisyUI 5.7 / Tailwind 4.3 (web), fontsource, qs-esm. |

### Held back

| Package | Current | Latest | Why held |
|---|---|---|---|
| `typescript` | 6.0 | 7.x | `@astrojs/check` peer-depends on `^5 \|\| ^6` |
| `eslint` | 9.x | 10.x | `eslint-plugin-react`, `-import`, `-jsx-a11y` (via `eslint-config-next`) cap at ESLint 9 |
| `graphql` | 16.x | 17.x | `payload` peer-depends on `graphql@^16.8.1` |
| `tailwindcss` / `daisyui` (cms) | 3.x / 4.x | 4.x / 5.x | Legacy bridge frontend only; a config rewrite not worth doing before it is retired |
| Node.js major | 22 | 24 / 26 | Out of scope for a security patch; 22 is in maintenance LTS (moved to 24 in the entry above) |

### Database

Payload 3.92 adds one nullable column. With push disabled in production, apply it
before (or together with) the deploy, or `users` queries fail:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
```

Verified by pushing the 3.89 and 3.92 schemas to empty databases and diffing
`pg_dump --schema-only`: that column is the only difference.

### Verification

- [x] `bun run lint` passes (warnings only).
- [x] `tsc --noEmit` passes in both apps; `bun run generate:types` regenerated.
- [x] `bun run build:cms` and `bun run build:web` succeed on Node 22.23.4.
- [x] `bun test` in `apps/web` passes.
- [x] `next start` smoke test: `/admin/login`, `/api/pages`, `/api/users/forgot-password` respond.

---

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
