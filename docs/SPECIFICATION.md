# Functional Specification

What Athena does today, from the point of view of visitors, editors and
operators. This describes implemented behaviour, not a wish list; planned work
is listed separately in [§6](#6-known-gaps-and-planned-work).

> **Related**: [Architecture](./ARCHITECTURE.md) · [Content Model](./CONTENT_MODEL.md) ·
> [API Reference](./API.md)

## 1. Purpose and Scope

Athena is a CMS-driven website (production: https://www.findb.uk). It
publishes block-based pages and a blog, with search, forms and SEO metadata,
all managed by editors without code changes.

| Actor | Uses | Authenticates with |
|---|---|---|
| Visitor | Public site (athena-web) | none |
| Editor / Admin | Payload admin (athena-cms `/admin`) | email + password |
| Web app (system) | CMS REST API | `web-frontend` API key (drafts only) |
| CMS (system) | Web `/api/invalidate` | `REVALIDATE_SECRET` |
| Vercel Cron (system) | CMS jobs runner | `CRON_SECRET` |

## 2. Public Website

### 2.1 Pages

- **F-PAGE-1** A published page with slug `s` is served at `/s`; slug `home`
  is served at `/`.
- **F-PAGE-2** A page shows its hero (none / low / medium / high impact) then
  its layout blocks in order: Call to Action, Content (1–4 columns), Media,
  Archive, Form.
- **F-PAGE-3** Unknown slugs, unpublished pages and multi-segment paths that
  are not redirects return the 404 page.

### 2.2 Blog

- **F-POST-1** `/posts` lists published posts, newest `publishedAt` first, 12
  per page, with a "Showing X–Y of Z" range and pagination.
- **F-POST-2** `/posts/page/n` shows page `n`; `n` below 1, non-numeric or past
  the last page returns 404.
- **F-POST-3** `/posts/{slug}` shows the post hero (title, categories,
  authors, publish date, hero image), the rich-text body (headings, lists,
  links, banners, code blocks, images, horizontal rules) and up to
  the editor-selected related posts.
- **F-POST-4** Author names come from `populatedAuthors`; no other user data
  is public.

### 2.3 Archive block

- **F-ARCH-1** In *collection* mode it lists up to `limit` posts, optionally
  filtered to selected categories. The CMS field defaults to 10; the renderer
  falls back to 3 when the stored value is empty or 0.
- **F-ARCH-2** In *selection* mode it lists the hand-picked posts in order.

### 2.4 Search

- **F-SRCH-1** `/search?q=term` returns up to 12 published posts whose title,
  meta title, meta description or slug contains the term.
- **F-SRCH-2** An empty query lists the first 12 indexed posts; no matches
  shows "No results found."

### 2.5 Forms

- **F-FORM-1** A Form block renders the selected form's fields (text, email,
  number, textarea, select, checkbox, country, state, message) with their
  widths, labels, defaults and required flags.
- **F-FORM-2** Submitting posts the values to the CMS and then shows the
  form's confirmation message or redirects to its redirect URL.
- **F-FORM-3** Submissions are stored in `form-submissions` and visible in the
  admin. No email is sent.

### 2.6 Navigation, theme and layout

- **F-NAV-1** Header and footer show up to 6 links each from the Header and
  Footer globals; the header always has a search link.
- **F-NAV-2** If the CMS cannot be reached, header and footer render without
  links instead of failing the page.
- **F-THEME-1** Light and dark themes. Initial theme comes from
  `localStorage['payload-theme']`, else the OS preference; the footer theme
  selector changes and stores it. No flash of the wrong theme (inline script
  in `<head>`).
- **F-A11Y-1** Every page has a single `<main>` landmark.

### 2.7 Redirects

- **F-REDIR-1** A request whose path exactly matches a redirect's `from` gets
  a `301` to the redirect target (a page, a post or a custom URL).
- **F-REDIR-2** Redirect changes take effect within about 60 s per function
  instance, and cached HTML within 300 s.

### 2.8 SEO and crawlers

- **F-SEO-1** Each page and post emits `<title>`, meta description, Open Graph
  (`og:title`, `og:description`, `og:image`, `og:url`, `og:site_name`) and
  `twitter:card=summary_large_image` from its SEO fields. Missing images fall
  back to `/website-template-OG.webp`; the `og` rendition is preferred.
- **F-SEO-2** `/sitemap.xml` indexes `/pages-sitemap.xml` and
  `/posts-sitemap.xml`, which list every published page and post with
  `lastmod`.
- **F-SEO-3** `/robots.txt` allows everything except `/api/` and links the
  sitemap. `/llms.txt` describes the site for LLM crawlers.

## 3. Editing (CMS Admin)

- **F-ED-1** Editors log in at `/admin` and can create, edit and delete pages,
  posts, media, categories, forms, redirects, users and the header/footer.
- **F-ED-2** Pages and posts are versioned (up to 50 versions each) with
  drafts and autosave. Saving a draft never changes the public site.
- **F-ED-3** **Preview** opens the draft on the real public site; **Live
  Preview** shows it inside the admin at mobile (375), tablet (768) and desktop
  (1440) widths.
- **F-ED-4** **Publish** makes the document public. The affected public URLs
  are refreshed within seconds; listings and navigation that cannot be
  targeted refresh within 5 minutes.
- **F-ED-5** **Unpublish** or delete removes the document from the public site
  and refreshes its old URL.
- **F-ED-6** **Schedule publish** queues a publish; it runs on the next daily
  jobs run (00:00 UTC).
- **F-ED-7** Slugs are generated from the title until the editor unlocks and
  edits the slug field.
- **F-ED-8** SEO tab: meta title (with a generate button), description, image
  and a search-result preview.
- **F-ED-9** Media uploads accept a focal point; seven renditions are created
  automatically.
- **F-ED-10** Seeding demo content from the dashboard replaces existing
  content. It is meant for empty development databases only.

## 4. Non-Functional Requirements

| ID | Requirement | How it is met |
|---|---|---|
| NF-PERF-1 | Public pages are served from cache in the common case. | Vercel ISR, 300 s expiration plus webhook re-render. |
| NF-PERF-2 | Responsive images. | `srcset` from renditions, lazy loading, `decoding=async`. |
| NF-AVAIL-1 | A CMS outage degrades the site rather than taking it down. | Cached HTML keeps serving; header/footer/redirects fail open; sitemaps return 503; standalone 500 page. |
| NF-AVAIL-2 | A web outage never blocks publishing. | `invalidateWeb` logs and never throws; 5 s timeout. |
| NF-SEC-1 | Drafts are never publicly visible or cached. | Draft reads need the API key; draft responses are `private, no-store`; cookie is HttpOnly. |
| NF-SEC-2 | Secrets never reach the browser. | All CMS reads with credentials run server-side; only the public CMS origin is embedded in form markup. |
| NF-OBS-1 | Errors are reported. | Sentry in the CMS (client, server, edge); Vercel Analytics and Speed Insights on the web. |
| NF-MAINT-1 | Both apps agree on types and constants. | `packages/shared`, regenerated with `bun run generate:types`. |
| NF-COMPAT-1 | Runtime | Node.js 22.23.4, Bun 1.4.x. |

## 5. Environments

| Environment | Branch | Web | CMS | Database |
|---|---|---|---|---|
| Local | any | http://localhost:4321 | http://localhost:3000 | local Postgres (dev container) or Neon |
| Preview | `preview` | preview deployment (SSO-protected) | preview deployment | **production** Neon database |
| Production | `main` | https://www.findb.uk | athena-cms production domain | production Neon database |

Because Preview shares the production database, content edited on the preview
CMS is live data, and schema changes affect production immediately.

## 6. Known Gaps and Planned Work

From the 2026-10 review; none of these are implemented yet.

- **Roles**: no admin/editor split; every user has full rights.
- **Email**: no email adapter, so forms send no notification or auto-reply,
  and password reset emails are not delivered.
- **Spam protection**: no captcha, honeypot or rate limit on form posts.
- **Corporate content types**: no Services, Team, Case Studies, Careers,
  Testimonials or Locations.
- **Template branding**: `SITE_NAME` and SEO titles still read "Payload
  Website Template"; admin welcome/login components are the template's.
- **Legacy frontend**: the CMS's `(frontend)` route group is still deployed.
- **Schema migrations**: production schema changes are applied by hand (see
  [DATABASE.md](./DATABASE.md)).
- **Testing**: one unit-test file in `apps/web`; no end-to-end tests; the
  Checkly checks are still the CLI scaffold examples.
- **Compliance**: no privacy policy or cookie consent.
