# Testing

Two automated suites live in `apps/web`, unit tests for CMS helpers in
`apps/cms`, plus a short list of checks that only
a Vercel deployment can answer (response headers, cache status).

```bash
bun run --filter @athena/web test        # unit tests (bun test, src/**/*.test.ts)
bun run --filter @athena/cms test        # CMS unit tests (bun test, src/**/*.test.ts)
bun run build:web                        # optional: enables TC-E-23
bun run dev:web                          # or point E2E_BASE_URL at a deployment
E2E_BASE_URL=http://localhost:4321 bun run --filter @athena/web test:e2e
```

The E2E suite (Playwright, `apps/web/e2e`) drives a running site. Cases that
need posts skip themselves when the CMS has none; TC-E-23 skips without a
production build in `apps/web/.vercel/output`.

## Unit tests (`apps/web/src/lib/*.test.ts`)

| ID | Area | Case |
|---|---|---|
| TC-U-01 | Banner activity | Posts and projects mixed, newest first, at most three |
| TC-U-02 | Banner activity | A release at (or up to an hour before) the last push is shown as the release |
| TC-U-03 | Banner activity | An old release loses to a newer push |
| TC-U-04 | Banner activity | Entries without a date or slug are skipped |
| TC-U-05 | Banner activity | A post without a title shows its slug |
| TC-U-06 | llms.txt | Starts with the site name and summary; no template name or old domain |
| TC-U-07 | llms.txt | Sections, posts and projects with absolute URLs; languages listed |
| TC-U-08 | llms.txt | Empty sections are left out |
| TC-U-09 | llms.txt | Line helper flattens whitespace and brackets |
| TC-U-10 | Site global | Defaults when the CMS is empty or unreachable |
| TC-U-11 | Site global | `ogImage` prefers the `og` rendition, made absolute; an unpopulated id is ignored |
| TC-U-12 | Site global | Banner off / no owl / trimmed tips |
| TC-U-13 | Share image | Built-in image is `/og.png` |
| TC-U-14 | Share image | The Site global image replaces it |
| TC-U-15 | Share image | A page's own image beats both |
| TC-U-16 | Hoo sprite | Four frames: sleep, awake, wave, wink |
| TC-U-17 | Hoo sprite | Every frame is 30 × 27 |
| TC-U-18 | Hoo sprite | One path per colour, valid path data |
| TC-U-19 | SEO | Description falls back: SEO field → intro → welcome; none when all empty |
| TC-U-20 | SEO | A route's own description beats the site one |
| TC-U-21 | SEO | Summaries stop at 155 characters (on a word in English, at a character in CJK) |
| TC-U-22 | SEO | A post without an SEO description uses its text (entities decoded); `og:type` article with dates |
| TC-U-23 | SEO | JSON-LD: WebSite (author `sameAs` only http links), BlogPosting (`zh-Hans`), SoftwareSourceCode |
| TC-U-24 | SEO | JSON-LD text cannot close its `<script>` |
| TC-U-25 | SEO | Home title is `site — tagline`, or the site name when the tagline is empty; the Site global trims it |
| TC-U-32 | SEO | An out-of-range character reference in post HTML stays as text instead of throwing (a post page would answer 500) |
| TC-U-33 | Links | `safeHref` keeps http(s), mailto, tel and on-site paths and drops `javascript:`, `data:`, `//host` and control characters; `httpUrl` only absolute http(s); `isLocalPath` refuses `//host`, `/\host` and absolute URLs |
| TC-U-34 | Draft mode | `athena-draft` alone, or with a wrong `__prerender_bypass`, is not draft mode; the two cookies `/api/preview` sets are |
| TC-U-30 | Site global | X picks: only `https://x.com/<handle>/status/<id>` links with text reach the page; fields trimmed, `@` dropped from the handle, day in Japan time, odd `lang` values dropped |
| TC-U-35 | CMS cache | A published CMS response is loaded once and then served from the Runtime Cache (tag `cms-data`, with a TTL); a failed load is not cached; a cache that errors falls back to the CMS; fresh reads (re-renders after a CMS change) skip the cache and refresh it; `expireCmsData` drops everything; a CMS read that started before an expiry and finishes after the re-render does not bring the old data back (the next read reloads); with no cache (local dev) every call reads the CMS |
| TC-U-36 | Form forwarding | `/api/form-submissions` keeps only `form` (an id) and `submissionData` (at most 50 string fields) and refuses other bodies with 400 and bodies over 32 KB with 413, without calling the CMS; it posts to `${CMS_URL}/api/form-submissions` with `x-vercel-protection-bypass` and no redirect following; Payload's status and JSON errors come back as they are; a redirect (Vercel login), a network failure, a body that fails mid-read or any non-JSON answer (even a 200) becomes 502; a body without `Content-Length` stops being read past 32 KB |
| TC-U-42 | Stack | Groups without tools give no groups, so `/stack` answers 404; a CMS that cannot answer makes `/stack` throw (the uncached 500 page, never a 404 the CDN keeps for a day), while the sitemap just leaves `/stack` out |
| TC-U-43 | Stack | Names and notes trimmed; links only absolute http(s); years only whole numbers 1970–2100; the icon is the Media URL with its `updatedAt`; former tools of every group are gathered at the end and not counted; groups left with no tools are dropped |
| TC-U-44 | Stack | Initials for the icon tile: first letters of up to two words (`Claude Code` → `CC`, `TypeScript` → `T`, `cal.com` → `CC`) |
| (14 more) | i18n, cms | Existing `i18n.test.ts` and `cms.test.ts` |

CMS (`apps/cms/src/**/*.test.ts`; X's oEmbed and the favicon fetches are mocked, so no network):

| ID | Area | Case |
|---|---|---|
| TC-U-26 | X link | x.com, twitter.com, mobile and `statuses` links become `https://x.com/<handle>/status/<id>`; other hosts, look-alike hosts, profiles and non-numeric ids are refused |
| TC-U-27 | oEmbed | Text (line breaks kept, entities decoded, `pic.twitter.com` links dropped), author, handle, day and language read from the oEmbed HTML; `zxx` / unparsable dates give null; no text gives null |
| TC-U-28 | oEmbed | Asks `publish.twitter.com/oembed` for the canonical link with `omit_script=1&dnt=true`; a bad link, an error status or a network failure gives null |
| TC-U-29 | Site hook | A new pick is filled and its link normalized; edited text is kept without asking X; a changed link replaces the old post; no answer and no text rejects the save with a message; no answer with typed text keeps it |
| TC-U-37 | Favicon | Only public http(s) hosts are fetched: localhost, `.local` / `.internal` (also with a trailing dot, `localhost.`), private, documentation, benchmarking (`198.18.0.0/15`) and reserved IPv4 (neighbouring public addresses still pass), IPv6 literals and links with credentials are refused; a name whose DNS answers include a private, loopback, link-local or mapped address (`127.0.0.1.nip.io`), or that does not resolve, is not fetched, also after a redirect, and gets no Google lookup either |
| TC-U-38 | Favicon | Icons declared in the page's `<link>` tags, best first (SVG, then the largest PNG, then apple-touch-icon), `.ico` skipped, relative links resolved |
| TC-U-39 | Favicon | The site's own icon is used when it converts; otherwise Google's favicon service for the host; a redirect to a private host is not followed; a body without `Content-Length` stops being read past the size cap; a page or image that fails gives null, never an error; the whole lookup (DNS, page, candidates, redirects) stops after its time budget (20 s), a stalled DNS lookup included, and each request's timeout is cut to what is left |
| TC-U-40 | Favicon | PNG and SVG become a 64×64 PNG; unreadable data gives null |
| TC-U-41 | Stack hook | A tool saved with a link and no icon gets one; a hand-picked icon is kept; a link moved to another site (or removed) replaces an icon fetched for the old one (Media `favicon-<old host>.png`), while a hand-picked icon stays; two tools on one host share one fetch and one Media file; no icon, a failed lookup or a failed upload leaves the icon empty and the save goes through; at most 4 sites are looked up at once, all within one 25 s deadline per save (sites not reached get no icon and are tried on the next save), and icons are stored only within the next 15 s |
| TC-U-31 | Invalidation | A missing `REVALIDATE_SECRET` / `WEB_URL` logs a warning; the request carries the bearer secret and `x-vercel-protection-bypass`, does not follow redirects, and a 302 is logged as a failure with its target; paths the web app reports in `failed` are logged as a warning, not as `Web invalidated`; outside a request (no Next `after()` scope) the call runs right away |

## End-to-end tests (`apps/web/e2e`)

| ID | File | Case |
|---|---|---|
| TC-E-01 | banner | CLI home shows the banner; ADE home shows the intro card |
| TC-E-02 | banner | ≥768px: tips (4 commands) and up to 3 activity rows with relative times, right of the owl |
| TC-E-03 | banner | `/` command opens the search popup; Esc closes it |
| TC-E-04 | banner | `/status` command opens the status panel |
| TC-E-05 | banner | `t` and `v` commands switch theme and view |
| TC-E-06 | banner | Clicking Hoo wakes it with a tip; clicking again puts it to sleep |
| TC-E-07 | banner | Reduce motion: straight to the awake frame |
| TC-E-08 | banner | Side pane visible at 768px, hidden at 767px |
| TC-E-09 | layout | No horizontal scroll: home in en/ja/zh at 320/390/768/1280px in both views; other pages at 320px |
| TC-E-10 | banner | Phone (320px, ja): owl beside the name, no side pane |
| TC-E-11 | layout | ja/zh take "…" from a CJK font; en does not; utilities still use Geist Mono |
| TC-E-12 | search | `/search?q=` filters to matching posts; command line and count follow |
| TC-E-13 | search | Typing filters with no network request; no match shows "Nothing found" and 0 |
| TC-E-14 | search | Enter updates `?q=` without loading a page |
| TC-E-15 | search | `/status` in the page prompt opens the panel; the suggestion keeps its text |
| TC-E-16 | search | `/ja/search` is Japanese and lists every post when empty |
| TC-E-17 | files | `og:image` is absolute and not the template image; `/og.png` is a PNG |
| TC-E-18 | files | `/website-template-OG.webp` is gone (404) |
| TC-E-19 | files | `/llms.txt` is text/plain, generated, no template name |
| TC-E-20 | files | Footer has no Payload template links (content: delete them in Globals → Footer) |
| TC-E-21 | files | `/ja/rss.xml` in Japanese; robots.txt links the sitemap; pages sitemap has `/work` |
| TC-E-22 | files | Unknown paths answer 404, in the page language |
| TC-E-23 | build | One stylesheet under 30 KB brotli, no `data:font`; no Cyrillic/Vietnamese/symbol font files |
| TC-E-24 | network | Pages make no requests outside the site, Vercel scripts and image hosts; no CMS API calls |
| TC-E-25 | network | The status panel loads the search index at most once |
| TC-E-26 | network | The popup search filters locally after one index load |
| TC-E-27 | status | `/status` in the bottom prompt opens the panel |
| TC-E-28 | status | The panel stays open after changing the language |
| TC-E-29 | layout | Phones: ADE top bar search ≥40px, tabs (view, theme, language) ≥36px; search inputs 16px |
| TC-E-30 | files | Scanner paths (`/wp-login.php`, `/.env`) get a plain 404; real dotted routes still 200 |
| TC-E-31 | seo | Indexable pages (home, lists, a post, a work entry; en/ja/zh): title unique per language, description 1–160 chars, self canonical = `og:url`, hreflang en/ja/zh-Hans/x-default, no robots tag |
| TC-E-32 | seo | hreflang is reciprocal across the three versions, each lists itself under its own `lang`, `x-default` is the English URL |
| TC-E-33 | seo | `/search`, `/search?q=`, `/ja/search`: `noindex, follow`, no canonical, no hreflang |
| TC-E-34 | seo | 404 (en, ja): status 404, `noindex, follow`, no canonical / `og:url` / hreflang, localized title |
| TC-E-35 | seo | Posts (en, ja): `og:type` article, `article:published_time`, BlogPosting whose headline is the h1, `inLanguage` = page lang, `url` = canonical |
| TC-E-36 | seo | Home: WebSite JSON-LD (`url` = canonical, `name` = site name); /work entry: SoftwareSourceCode without "Other"; lists: none |
| TC-E-37 | seo | `og:locale` en_US / ja_JP / zh_CN with the other two as alternates |
| TC-E-38 | seo | Every URL in the pages and posts sitemaps answers 200, is indexable and canonical to itself; `/` listed, `/search` not; fixed routes have no `<lastmod>` |
| TC-E-39 | files | No link to `/admin` in the header, sidebar or footer (`/`, `/ja/posts`); content check: keep such links out of Globals → Header / Footer |
| TC-E-40 | seo | Home title (en/ja/zh) is the site name or `site name — tagline`, never a dangling ` — `; `og:title` matches |
| TC-E-45 | banner | ADE: the site avatar in the sidebar, the phone top bar and the home intro card is the favicon's ❯_ mark (an SVG, no letter); the account avatar at the sidebar foot keeps the author's initial |
| TC-E-46 | layout | CLI header (320px, en/ja/zh): the language menu reads `[en]` / `[jp]` / `[zh]` in the same font, size and colour as `[ade]` and `[dark]`, ≥44px tall; its menu items stay plain `en` / `jp` / `zh` |
| TC-E-47 | layout | ADE below 1024px (320 ja, 375 en, 390 zh, 1023 en): sun \| moon tabs in the top bar, the current theme selected; the moon tab sets dark and stores it, clicking it again keeps dark, the sun tab sets light; the bar stays one row with no horizontal scroll; at 1024px they are hidden and the sidebar has the switch |
| TC-E-48 | layout | Switches in one order, view → language → theme: CLI header (`[ade] [en] [dark]`), ADE top bar (CLI \| ADE, EN \| JP \| ZH, sun \| moon) and the status panel config rows; the CLI language menu stays on screen when opened at 320 / 340 / 390 / 768px (en/ja/zh) |
| TC-E-44 | files | `/api/exit-preview?path=`: `/posts` redirects there; `//example.com`, `/%5Cexample.com`, an absolute URL and an empty path redirect to `/`; `/api/preview` with a wrong secret is 401 |
| TC-E-41 | picks | Home "Picks from X": ≤ 6 cards, count in the heading, each with text, `@handle`, a `YYYY-MM-DD` date when known and a link to `https://x.com/<handle>/status/<id>`; no request to x.com / twitter.com / twimg.com / t.co, no widget script or iframe (section absent without picks) |
| TC-E-42 | picks | 320px (CLI light, ADE dark): no horizontal scroll, cards inside the viewport, one column; two columns at 1024px |
| TC-E-43 | picks | `/ja`: heading and link text in Japanese; each text keeps the post's own `lang` |
| TC-E-49 | stack | `/pages-sitemap.xml` lists `/stack`, `/ja/stack` and `/zh/stack` only while the page answers 200 (404 with no tools; the other cases then skip; any status other than 200 or 404 fails) |
| TC-E-50 | stack | CLI: each group's rows start with `├─` and the last with `└─`; the heading count is the number of current and trying tools; links are absolute http(s), open in a new tab with `noopener`; the former group starts folded |
| TC-E-51 | stack | ADE: every tool has an icon tile, either an image that loads from Media (never the tool's own host) or one or two letters; no request to google.com / gstatic.com |
| TC-E-52 | stack | 320 and 390px (CLI light ja, ADE dark en, ADE light zh): no horizontal scroll and every row inside the viewport |

## Deployment checks (Preview, then Production)

Run after a deploy; the warm-cache workflow should have filled the cache.

| ID | Check | Expect |
|---|---|---|
| TC-P-01 | `GET /` twice | `x-vercel-cache: HIT` (or `STALE`), `content-encoding: br`, `cache-control: public, max-age=0, must-revalidate` |
| TC-P-02 | `GET /_astro/*.css`, `*.js` | `cache-control: public, max-age=31536000, immutable`, `content-encoding: br` |
| TC-P-03 | `GET /search?q=a`, then `?q=b` | Both HIT the same cached page |
| TC-P-04 | `GET /wp-login.php` twice | 404 text/plain; second response HIT |
| TC-P-05 | `GET /no-such-page` twice | 404 page; second response HIT |
| TC-P-06 | `GET /llms.txt`, `/og.png` | 200; llms.txt names the site and the current domain |
| TC-P-07 | Warm-cache workflow run | Succeeds for the deployment's commit, with 200 responses (no "Cache not warmed" warning; Preview needs the `VERCEL_AUTOMATION_BYPASS_SECRET` repository secret) |
| TC-P-08 | E2E suite with `E2E_BASE_URL` set to the deployment | All pass (TC-E-20 needs the footer rows deleted) |
| TC-P-10 | CMS on the deployment: add a public X post under Site → Picks from X with only the link, save | Text, author, handle, date and language are filled; the card shows on `/` after the save (cache invalidated) |
| TC-P-09 | Schema Markup Validator (validator.schema.org) on `/`, a post, a /work entry; Google Rich Results Test on the post | WebSite / BlogPosting / SoftwareSourceCode parsed without errors; the post is eligible as an Article |
| TC-P-11 | CMS on the deployment: select three posts in the list and publish or unpublish them at once | athena-cms logs `Web invalidated` once per post and no `Web invalidation unreachable`; `/`, `/posts` and the sidebar no longer list unpublished posts (or list newly published ones) on the first request. Preview needs `WEB_PROTECTION_BYPASS` on athena-cms (else `Web invalidation failed: 401`) |
| TC-P-12 | After a few pages have been viewed, `GET /no-such-page-<random>`, `/posts/no-such-post-<random>` and `/posts/page/9999` | 404 page; athena-cms runtime logs show no `/api/*` request for them (layout data and the slug lists come from the Runtime Cache) |
| TC-P-13 | CMS on the deployment: change a header link (or publish a post) and save | The new link shows on `/` and on a page not visited since, on the first request (the Runtime Cache was expired by `/api/invalidate`) |
| TC-P-15 | CMS on the deployment: Globals → Stack, add a group and a tool with only a name and a link (e.g. `https://astro.build`), save; add a second tool on the same site, save | The tool's Icon shows the site's favicon (Media `favicon-<host>.png`, 64×64); the second save adds no Media file; `/stack` (and `/ja/stack`) show the tool with its icon in the ADE view on the first request; `/pages-sitemap.xml` lists `/stack` |
| TC-P-14 | Send the `/contact` form on the deployment (en, then `/ja/contact`) | The confirmation message shows; the browser's only request is `POST /api/form-submissions` on the web origin (none to the CMS origin); the submission is listed in the admin under Form Submissions. With athena-cms protected, this needs `CMS_PROTECTION_BYPASS` on athena-web (else the form shows an error and athena-web logs `CMS redirected 302`) |

## Results

| Date | Target | Unit | E2E | Notes |
|---|---|---|---|---|
| 2026-11-12 | local dev (same mock CMS), review fixes on #75 | web 68/68, cms 42/42 | 72/72 (4 skipped) | Favicon lookup: resolved-address check, 20 s budget (DNS included), one 25 s deadline per save, trailing-dot names, IANA special-purpose IPv4, at most 4 sites at once, failed upload (TC-U-37, -39, -41). With the mock CMS stopped, `/stack` and `/ja/stack` answered 500 with no `Vercel-CDN-Cache-Control`, and 200 again once it was back (TC-U-42). DNS itself is stubbed in the tests: the container has no resolver, so the real lookup is checked on Preview (TC-P-15). |
| 2026-11-12 | Preview bfa2e78 (via Vercel share link) | — | not run | TC-P-15 (first half): after the SQL on the preview branch, a tool saved with only `https://claude.ai/` got `favicon-claude.ai.png` (64×64 PNG in Blob); athena-cms logged `Web invalidated: paths=[/stack] tags=[global_stack, sitemap]` and no warnings or errors; `/stack` and `/ja/stack` showed it on the first request with the Blob image; `/pages-sitemap.xml` lists the three `/stack` URLs. The same-host second tool was not tried. |
| 2026-11-12 | local dev (mock CMS with 3 groups, 13 tools incl. trying, former, no link and no icon; local Postgres 16 for the CMS hook), local builds | web 68/68, cms 32/32 | 72/72 (4 skipped) | `/stack` (TC-U-37–44, TC-E-49–52). The hook against a real Payload + Postgres (favicon lookup stubbed): two tools on astro.build got one `favicon-astro.build.png` (64×64), one Media row, and the second save made no fetch. `docs/sql/2026-11-12-stack.sql` applied twice to a copy of the previous schema gives the same schema as a push of the new config. Checked by eye: CLI and ADE at 1440 / 768 / 390 / 320px, en/ja/zh, light and dark, no horizontal scroll. Real favicons are not reachable from the test container, so the fetch on save is checked on Preview (TC-P-15). |
| 2026-11-12 | local dev (mock CMS that answers `/api/form-submissions` with a Vercel-login 302 unless `x-vercel-protection-bypass` matches) | web 62/62 | 61/61 (6 skipped) | Form forwarding (TC-U-36): in Chromium, `/contact` and `/ja/contact` showed the confirmation and the browser's only POST went to the web origin; the mock CMS received the cleaned body with the bypass header; a submission without the required email came back as Payload's 400 message. |
| 2026-11-11 | local dev (mock CMS) | web 47/47 | 61/61 (6 skipped) | Switch order unified (TC-E-48) after a survey of 9 sites (Vue, Astro, VitePress, Docusaurus, React, Nuxt, MDN, GitHub Docs, Svelte): language and theme always sit side by side, search comes first, and the language/theme order is split 3–3, so view → theme → language (the status panel order) was tried first; Master found the theme tabs between view and language odd, so the order is view → language → theme everywhere, status panel included. Opened the CLI language menu at every 5px from 320 to 800px and every 40px to 1440px (en/ja/zh): with `dropdown-end` only it ran 13px off the left edge where `[en]` wraps to a row start (320–355px); with start alignment only it ran off the right edge at 360–370px and 535–785px. The menu now picks its side on the click that opens it: no overflow at any width. |
| 2026-11-11 | local dev (mock CMS) | web 47/47 | 56/56 (6 skipped) | ADE top bar sun \| moon tabs (TC-E-47; an icon button first, then tabs like CLI \| ADE as Master asked). Checked by eye at 320 / 375 / 390 / 768 / 1023 / 1280px, light and dark: below 640px the top bar tabs use 6px side padding (4px and 4px gaps at 320px) so the bar stays on one row. |
| 2026-11-11 | local dev (mock CMS) | web 47/47 | 51/51 (6 skipped) | CLI language menu as `[en]` / `[jp]` / `[zh]` (TC-E-46). Checked by eye at 1280 / 390 / 320px, light and dark, menu open: same look and hover as `[ade]` / `[dark]`, no horizontal scroll; at 320px the nav wraps as before. |
| 2026-11-11 | Preview c4d40e5 | cms 19/19 | not run | TC-P-11 again: re-renders now run (the web app passes its automation bypass). Bulk unpublish: `/`, `/posts` and the feeds re-rendered in ~5 s; only the unpublished posts' own pages were reported as failed because they answer 404, now counted as done. Bulk publish on the freshly reset (cold) preview database: the save took ~20 s and the API function hit its 30 s limit while waiting; some post pages missed the 10 s re-render timeout. maxDuration is now 60 s and the CMS waits 25 s. |
| 2026-11-11 | Preview 5efebfa (after Neon "Reset from parent") | cms 18/18 | not run | TC-P-11: bulk publish of 3 posts logged `Web invalidation failed: 401` 3 times (athena-cms Preview had no `WEB_PROTECTION_BYPASS`); after Master set it, bulk unpublish logged `Web invalidated` 3 times and no `unreachable`, and `/posts` showed 0 posts. That page was a cache MISS though, so the background re-render (`waitUntil`) had not cached it; CodeRabbit also flagged the stale window before it finishes. The endpoint now waits for the re-renders again (CMS timeout 30 s, sent after the response). |
| 2026-11-11 | local dev (security review of `main`…`development`) | web 47/47, cms 15/15 | 55/55 | Found and fixed: `athena-draft` alone turned on draft fetches; `/api/exit-preview?path=//host` redirected off-site; CMS / GitHub URLs were used as `href` unchecked; warm-cache sent the bypass secret to the sitemap's host; an out-of-range character reference threw in `htmlToText`. |
| 2026-11-10 | Preview ecb2321 (via Vercel share link) | — | not run (proxy) | TC-P-10 ✓ oEmbed from Vercel: a pick saved with only its link got text, author, handle, day and language. ✗ The home page stayed cached: athena-cms Preview has no `REVALIDATE_SECRET` (Production only), so `invalidateWeb` returned without a word. Fixed the silence in code (TC-U-31). After Master set `REVALIDATE_SECRET` on athena-cms Preview and redeployed (90506df), the card showed on preview.whoa.me (checked by Master). |
| 2026-11-10 | local dev (3 sample picks: long Japanese name and URL, one without a date or language; ja note), local build | web 40/40, cms 12/12 | 54/54 | X picks. Saving a pick without text while X is unreachable is refused with the message (checked over REST); a 26-character handle is refused by the link check. oEmbed itself is not reachable from the test container, so the live fetch is checked on Preview (TC-P-10). |
| 2026-11-10 | Preview 083e6da (via Vercel share link) | — | not run (proxy blocks direct access) | TC-P-01 HIT + br ✓; P-02 immutable + br ✓; P-03 `?q=b` HIT on the page cached for `?q=a` ✓; P-04 second hit HIT ✓; P-05 first hit MISS (second not checked); P-06 ✓; P-07 ✗: every request got 302 (preview behind Vercel Authentication), fixed in b965bdf, needs the bypass secret; SEO head (canonical, hreflang, noindex on /search and 404, BlogPosting, WebSite) ✓. |
| 2026-11-10 | local dev (tagline set in en/ja, empty in zh), local build | 39/39 | 50/50 | `/admin` nav filter removed (Master: controlled in the CMS); TC-E-39 stays as a content check. |
| 2026-11-10 | local dev (SEO changes), local build | 38/38 | 48/48 | First TC-E-31 run flagged `/ja` sharing the home title with `/` (the site name); language versions may share a title, so uniqueness is now checked per language. Found and fixed: `programmingLanguage` listed GitHub's "Other". |
| 2026-11-10 | local dev (5aa41a2 + working tree), local build | 32/32 | 40/40 | Found and fixed: `/search` rewrote the `/status` suggestion text (attribute name clash); the 500 page still pulled every font subset. TC-P-* pending the preview deploy (needs the banner SQL). |
