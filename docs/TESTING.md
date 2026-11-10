# Testing

Two automated suites live in `apps/web`, plus a short list of checks that only
a Vercel deployment can answer (response headers, cache status).

```bash
bun run --filter @athena/web test        # unit tests (bun test, src/**/*.test.ts)
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
| (14 more) | i18n, cms | Existing `i18n.test.ts` and `cms.test.ts` |

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
| TC-E-29 | layout | Phones: ADE top bar search ≥40px, tabs ≥36px; search inputs 16px |
| TC-E-30 | files | Scanner paths (`/wp-login.php`, `/.env`) get a plain 404; real dotted routes still 200 |

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
| TC-P-07 | Warm-cache workflow run | Succeeds for the deployment's commit |
| TC-P-08 | E2E suite with `E2E_BASE_URL` set to the deployment | All pass (TC-E-20 needs the footer rows deleted) |

## Results

| Date | Target | Unit | E2E | Notes |
|---|---|---|---|---|
| 2026-11-10 | local dev (5aa41a2 + working tree), local build | 32/32 | 40/40 | Found and fixed: `/search` rewrote the `/status` suggestion text (attribute name clash); the 500 page still pulled every font subset. TC-P-* pending the preview deploy (needs the banner SQL). |
