# Functional Specification

What Athena does today, from the point of view of visitors, editors and
operators. This describes implemented behaviour, not a wish list; planned work
is listed separately in [§6](#6-known-gaps-and-planned-work).

> **Related**: [Architecture](./ARCHITECTURE.md) · [Content Model](./CONTENT_MODEL.md) ·
> [API Reference](./API.md)

## 1. Purpose and Scope

Athena is a CMS-driven website (production: https://whoa.me). It
publishes block-based pages and a blog, with search, forms and SEO metadata,
all managed by editors without code changes.

| Actor | Uses | Authenticates with |
|---|---|---|
| Visitor | Public site (athena-web) | none |
| Editor / Admin | Payload admin (athena-cms `/admin`) | email + password |
| Web app (system) | CMS REST API | `web-frontend` API key (drafts only) |
| CMS (system) | Web `/api/invalidate` | `REVALIDATE_SECRET` |
| Vercel Schedules (system) | CMS jobs runner | `CRON_SECRET` |

## 2. Public Website

### 2.1 Pages

- **F-HOME-1** `/` shows the intro box from the `site` global (welcome line,
  author name, intro, post count, last update, social links), the 8 newest
  posts, the `site.projects` list and a search box. `/home` redirects there.
- **F-HOME-2** "Picks from X": up to 6 posts on X listed in the `site`
  global (`picks`) are shown on `/` as the site's own cards (author,
  @handle, day, text, optional localized note, link to the post on x.com),
  one column on phones and two from 768 px. The CMS reads text, author,
  handle, day and language from X's public oEmbed endpoint when the Site
  global is saved (no API key); visitors' browsers load nothing from X.
  Photos and videos are not shown (text only; the card links to the post).
- **F-HOME-3** GitHub contribution graph: when `site.github.username` is
  set, `/` shows that user's last year of GitHub contributions (one square
  per day, shaded 0–4 like GitHub's calendar, the yearly total; the whole
  block is one link to the profile) below the projects. The CMS reads the calendar from GitHub's
  GraphQL API when the username is saved and every 6 hours (`syncGitHub`);
  visitors load nothing from GitHub. Below 640 px only the last 26 weeks are
  drawn, below 360 px the last 17, with no horizontal scroll.
- **F-ABOUT-1** `/about` (and `/ja/about`, `/zh/about`) shows the About
  global: the heading (default "About") as the page's `h1` under a
  `cat about.md` prompt, the lead, the portrait with its caption (beside the
  lead from 640 px, below it on phones), the story as rich text, then the
  Site social links (`rel="me"`). It answers 404, and the sitemap leaves it
  out, until the lead or the story has text; when the CMS cannot answer it is
  the uncached 500 page. The lead is the meta description.
- **F-PAGE-1** A published page with slug `s` is served at `/s` (e.g.
  `/contact`). The CMS page with slug `home` is no longer routed, and a page
  with slug `about` is shadowed by F-ABOUT-1.
- **F-PAGE-2** A page shows its hero (none / low / medium / high impact) then
  its layout blocks in order: Call to Action, Content (1–4 columns), Media,
  Archive, Form.
- **F-PAGE-3** Unknown slugs, unpublished pages and multi-segment paths that
  are not redirects return the 404 page.

### 2.2 Blog

- **F-POST-1** `/notes` lists published posts as one-line rows (date, title,
  first category), newest `publishedAt` first, 12 per page, with pagination.
- **F-POST-2** `/notes/page/n` shows page `n`; `/notes/page/1` redirects to
  `/notes`; `n` below 1, non-numeric or past the last page returns 404.
- **F-POST-3** `/notes/{slug}` shows a breadcrumb, the title, date, reading
  time, authors and categories, the meta description as an "概要" box, the
  hero image, the rich-text body (headings, lists, links, banners, code
  blocks, images, horizontal rules), the editor-selected related posts and
  links to the previous and next post by `publishedAt`.
- **F-POST-5** `/rss.xml` is an RSS 2.0 feed of the 30 newest posts.
- **F-POST-4** Author names come from `populatedAuthors`; no other user data
  is public.

### 2.3 Archive block

- **F-ARCH-1** In *collection* mode it lists up to `limit` posts, optionally
  filtered to selected categories. The CMS field defaults to 10; the renderer
  falls back to 3 when the stored value is empty or 0.
- **F-ARCH-2** In *selection* mode it lists the hand-picked posts in order.

### 2.4 Search

- **F-SRCH-1** `/search?q=term` shows the published posts whose title, slug,
  meta title, meta description or tags contain every word of the term. It is
  one cached page per language, filtered in the browser as you type.
- **F-SRCH-2** An empty query lists every post; no matches shows "Nothing
  found" (translated).
- **F-SRCH-3** Popup search: ⌘K / Ctrl+K, `/`, or the search button opens a
  dialog. Typing searches posts and page titles (keyword match, no AI);
  ↑/↓ select, Enter opens, Esc closes, Enter with nothing selected opens
  `/search`. The dialog fits the screen down to 320 px wide.

### 2.5 Forms

- **F-FORM-1** A Form block renders the selected form's fields (text, email,
  number, textarea, select, checkbox, country, state, message) with their
  widths, labels, defaults and required flags.
- **F-FORM-2** Submitting posts the values to the web app, which forwards them
  to the CMS server-side, and then shows the
  form's confirmation message or redirects to its redirect URL.
- **F-FORM-3** Submissions are stored in `form-submissions` and visible in the
  admin. No email is sent.

### 2.6 Navigation, theme and layout

- **F-NAV-1** Header and footer show up to 6 links each from the Header and
  Footer globals. With no Header links set, the header shows `home` and
  `posts`. The footer always links to `/rss.xml`.
- **F-NAV-3** Keyboard shortcuts outside text fields: `/` opens the popup
  search, `j`/`k` move through the page's list (note rows, build rows, the
  open Stacks rows, the home project list), `h`/`l` go to the previous / next
  section of the header nav (on a page outside the nav, `l` goes to the first
  and `h` to the last; no wrap-around), `t` toggles the theme, `v` switches
  between the CLI and ADE views, `s` opens the `/status` panel. Inside an open
  dialog (search, `/status`) these keys belong to the dialog.
- **F-NAV-4** The site version (`docs/VERSIONING.md`) is shown next to the
  site name and in the footer. Clicking it, pressing `s`, or running
  `/status` in the popup search opens a `/status` panel: version, commit,
  environment, build and render time, cache, content counts (Status tab),
  a searchable settings list (Config tab: View, Theme, Language, Reduce
  motion, Keyboard shortcuts, Reset to defaults; ↑/↓ select, Enter changes,
  stored in `localStorage` and applied before paint) and shortcuts (Keys
  tab).
- **F-VIEW-1** Two looks for the same content: CLI (terminal-style) and
  ADE (agent-app style, called `modern` in code and in the CMS: sidebar, question bubbles, ✓ step pills, composer
  search box, "On this page" panel on posts at ≥1280 px). The site default
  comes from the `site` global; the visitor's choice is stored in
  `localStorage['athena-view']` and applied before paint. Switch labels
  (CLI / ADE, Dark / Light, EN / JP / ZH) are English in every language;
  the CLI header writes them, and its nav links, in lowercase (`posts`,
  `[ade]`, `[dark]`, `en`).
  All other UI text, including the `/status` panel, follows the page
  language; post and page content falls back to English per field.
- **F-I18N-1** English at `/…`, Japanese at `/ja/…`, Chinese at `/zh/…`.
  UI strings are translated; content falls back to English per field. Pages
  declare `hreflang` alternates, and each language has its own RSS feed.
- **F-SEO-1** Search metadata follows Google Search Central
  (`apps/web/src/lib/seo.ts`, `Layout.astro`): every indexable page has its
  own title (the home page: site name, plus ` — <tagline>` when the Site
  global sets one) and a description of at most ~155 characters (SEO field, else
  the post text, else the Site description → intro → welcome line; lists
  and /builds have localized descriptions), a self-referencing canonical,
  `hreflang` for en / ja / zh-Hans plus `x-default`, and Open Graph with
  `og:locale`. Posts are `og:type=article` with published/modified times.
  JSON-LD: `WebSite` on the home page, `BlogPosting` on posts,
  `SoftwareSourceCode` on /builds entries. `/search`, 404 pages and drafts
  are `noindex, follow` with no canonical or hreflang. The pages sitemap
  always lists `/`, never `/search`, and gives `<lastmod>` only where the
  date is real (CMS pages, /builds entries from GitHub, posts).
- **F-NAV-2** If the CMS cannot be reached, header and footer render without
  links instead of failing the page.
- **F-THEME-1** Light and dark themes. Initial theme comes from
  `localStorage['payload-theme']`, else the OS preference; the header
  `[dark]`/`[light]` toggle changes and stores it. No flash of the wrong theme (inline script
  in `<head>`).
- **F-A11Y-1** Every page has a single `<main>` landmark.

### 2.7 Redirects

- **F-REDIR-1** A request whose path exactly matches a redirect's `from` gets
  a `301` to the redirect target (a page, a post or a custom URL).
- **F-REDIR-2** A redirect change invalidates the `content` cache tag, so
  cached pages pick it up on their next request; a function instance keeps
  the redirect list for at most 5 s.
- **F-REDIR-3** The pre-1.2.0 section paths `/posts`, `/work`, `/stack`
  (with `/ja`, `/zh` and any subpath) answer `308` to `/notes`, `/builds`,
  `/stacks` with the same language, subpath and query string. On Vercel
  they are served by the plain function, not ISR, so the query reaches the
  redirect and the CDN caches each full URL separately. A Redirects entry
  whose `from` is an old section path wins over this `308`, and also answers
  the renamed path (`from: /posts/x` redirects `/notes/x` too, since CMS
  links typed with `/posts/x` render as `/notes/x`); an entry for the exact
  path wins.

### 2.8 SEO and crawlers

- **F-SEO-1** Each page and post emits `<title>`, meta description, Open Graph
  (`og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`) and
  `twitter:card=summary_large_image` from its SEO fields. Missing images fall
  back to the Site global's `ogImage`, then to the built-in `/og.png` (Hoo);
  the `og` rendition is preferred.
- **F-SEO-2** `/sitemap.xml` indexes `/pages-sitemap.xml` and
  `/posts-sitemap.xml`, which list every published page and post with
  `lastmod`.
- **F-SEO-3** `/robots.txt` allows everything except `/api/` and links the
  sitemap. `/llms.txt` describes the site for LLM crawlers (generated from the
  CMS: Site global, newest posts, `/builds`).

## 3. Editing (CMS Admin)

- **F-ED-1** Editors log in at `/admin` and can create, edit and delete pages,
  posts, media, categories, forms, redirects, users and the header/footer.
- **F-ED-2** Pages and posts are versioned (up to 50 versions each) with
  drafts and autosave. Saving a draft never changes the public site.
- **F-ED-3** **Preview** opens the draft on the real public site; **Live
  Preview** shows it inside the admin at mobile (375), tablet (768) and desktop
  (1440) widths.
- **F-ED-4** **Publish** makes the document public. The affected public URLs
  are refreshed within seconds; every other cached page refreshes on its next
  request.
- **F-ED-5** **Unpublish** or delete removes the document from the public site
  and refreshes its old URL.
- **F-ED-6** **Schedule publish** queues a publish; it runs on the next hourly
  jobs run (Vercel Schedule `0 * * * *` UTC, starting up to 15 minutes late).
- **F-ED-7** Slugs are generated from the title until the editor unlocks and
  edits the slug field.
- **F-ED-8** SEO tab: meta title (with a generate button), description, image
  and a search-result preview.
- **F-ED-9** Media uploads accept a focal point; seven renditions are created
  automatically.
- **F-ED-11** Translate (post/page sidebar): Claude translates the English
  version into Japanese and Chinese and saves them as drafts. Code, inline
  code and slugs are left as they are.
- **F-ED-10** Seeding demo content from the dashboard replaces existing
  content. It is meant for empty development databases only.

## 4. Non-Functional Requirements

| ID | Requirement | How it is met |
|---|---|---|
| NF-PERF-1 | Public pages are served from cache in the common case. | Vercel ISR plus cache tag `content`, invalidated by the publish webhook; 7-day expiration as a safety net. Popup search filters a cached index in the browser. |
| NF-PERF-3 | Page-to-page navigation feels instant. | Speculation rules prefetch a page when a link is hovered or pressed (Chrome, Edge); a 120 ms cross-document view transition replaces the blank flash (off with reduced motion). The CLI / ADE and theme switches change attributes in place without a reload. |
| NF-PERF-2 | Responsive images. | `srcset` from renditions, lazy loading, `decoding=async`. |
| NF-AVAIL-1 | A CMS outage degrades the site rather than taking it down. | Cached HTML keeps serving; header/footer/redirects fail open; sitemaps return 503; standalone 500 page. |
| NF-AVAIL-2 | A web outage never blocks publishing. | `invalidateWeb` logs and never throws; it runs after the admin response (`after()`), 25 s timeout. |
| NF-SEC-1 | Drafts are never publicly visible or cached. | Draft reads need the API key; draft responses are `private, no-store`; cookie is HttpOnly. |
| NF-SEC-2 | Secrets never reach the browser. | All CMS reads with credentials run server-side; only the public CMS origin is embedded in form markup. |
| NF-OBS-1 | Errors are reported. | Sentry in the CMS (client, server, edge); Vercel Analytics and Speed Insights on the web. |
| NF-MAINT-1 | Both apps agree on types and constants. | `packages/shared`, regenerated with `bun run generate:types`. |
| NF-COMPAT-1 | Runtime | Node.js 24.x LTS (24.22.1 locally and in CI), Bun 1.4.x. |
| NF-COMPAT-2 | Browsers | Works in every browser with Baseline Widely available features (floor: Safari 16.4, Chrome 111, Firefox 128 for Tailwind v4); newer features only as progressive enhancement. See `docs/BASELINE.md`. |

## 5. Environments

| Environment | Branch | Web | CMS | Database |
|---|---|---|---|---|
| Local | any | http://localhost:4321 | http://localhost:3000 | local Postgres (dev container) or Neon |
| Preview | `preview` | https://preview.whoa.me (Vercel Authentication) | https://preview.cms.whoa.me | its own Neon branch (child of production) |
| Production | `main` | https://whoa.me | https://cms.whoa.me | production Neon database |

Preview has its own database branch: content edited on the preview CMS stays
there, and schema SQL is run on the branch first, then on production
([DATABASE.md](./DATABASE.md)). The public domain moved from findb.uk to
whoa.me with the 1.0.0 release; the findb.uk domains are still attached
(canonical URLs point to whoa.me) and may be reused later.

## 6. Known Gaps and Planned Work

From the 2026-10 review; none of these are implemented yet.

- **Roles**: no admin/editor split; every user has full rights.
- **Email**: no email adapter, so forms send no notification or auto-reply,
  and password reset emails are not delivered.
- **Spam protection**: no captcha, honeypot or rate limit on form posts.
- **Corporate content types**: no Services, Team, Case Studies, Careers,
  Testimonials or Locations.
- **Template branding**: the admin welcome/login components and the seed's
  sample home page are still the template's.
- **Schema migrations**: production schema changes are applied by hand (see
  [DATABASE.md](./DATABASE.md)).
- **Testing**: unit tests (`bun test`) and a Playwright E2E suite in
  `apps/web`, run by hand before pushing ([TESTING.md](./TESTING.md)); not in
  CI yet. No uptime monitoring (the Checkly scaffold was removed).
- **Compliance**: no privacy policy or cookie consent.
