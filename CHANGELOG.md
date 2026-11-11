# Changelog

All notable changes to the site are listed here. The version rules are in
[`docs/VERSIONING.md`](docs/VERSIONING.md); the release workflow publishes the
section of each new version as a GitHub Release.

## [1.0.3] - 2026-11-11

### Fixed

- Unpublished posts could stay listed on `/posts` and the home page: the
  CMS asked the site to re-render before its own save was committed, so the
  re-render read the old data. The CMS now notifies the site after the save
  has finished.
- Publishing or unpublishing several posts at once no longer logs
  "Web invalidation unreachable" in the CMS: `/api/invalidate` answers as
  soon as the cache is marked stale and re-renders the changed pages in the
  background.

## [1.0.2] - 2026-11-11

### Changed

- ADE view: the site avatar (sidebar, top bar, home intro, project replies)
  is now the favicon's ❯_ mark instead of the site name's first letter.

## [1.0.1] - 2026-11-11

### Changed

- The production site moved to https://whoa.me (CMS: https://cms.whoa.me);
  `www.whoa.me` redirects there, and canonical URLs, feeds and sitemaps
  name whoa.me. Docs and the
  cache warm-up workflow's default production URL follow.

## [1.0.0] - 2026-11-11

First versioned release: the portfolio and blog redesign for whoa.me.

### Added

- Two views of the same site, switched from the header or with `v`: a
  terminal-style CLI view and an agent-app style ADE view.
- English, Japanese and Chinese content under `/`, `/ja` and `/zh`, with an
  EN / JP / ZH switch.
- Popup search (`/` or `⌘K`) that searches posts and pages in the browser from
  a cached index, plus `/status` as a command (also in the inline prompt at
  the bottom of the page, which suggests it as you type `/`).
- Site version next to the site name, and a settings panel (click the
  version, press `s`, or run `/status`) with build and cache details and a
  searchable Config list, including Reduce motion and an option to turn off
  single-key shortcuts. The panel stays open when you change the language
  or reset the settings.
- Site name, intro, links, projects and the default view are editable in the
  CMS (Site global).
- A prompt-style favicon, and a share image with Hoo for pages without
  their own (replaceable in the CMS, Site global).
- CLI view: the home intro box is a banner with Hoo, a pixel owl in round
  glasses. Click it to wake it: it waves, winks and says a tip (still with
  Reduce motion on). Style, owl and tips are set in the CMS (Site global).
  On wide screens the box splits in two, like an agent CLI's startup
  screen: Hoo and the profile on the left, and clickable "Tips for getting
  started" and "Recent activity" (newest posts, pushes and releases) on the
  right.
- Home page "Picks from X": posts on X chosen in the CMS (Site global) are
  shown as cards with the text, author, date and an optional note, linking
  to the post. Paste the link and save; the CMS reads the rest from X.
  Visitors' browsers load nothing from X.
- `/work`: GitHub repositories shown like threads in an agent app, grouped
  as Waiting on you / Working / Idle / Resolved (from GitHub activity
  unless set in the CMS), with open pull request counts and the
  repository's social preview image, and a searchable, keyboard-driven
  picker in the CLI view. Live projects whose repository is private can be
  listed too, without source or commit details. Each repository has its own page
  with a brief, a write-up, the latest release and recent commits. Entries
  are added, pinned, hidden and translated in the CMS; GitHub data refreshes
  every 6 hours.

### Changed

- Pages, feeds, sitemaps and the search index are cached at Vercel until the
  CMS publishes a change, instead of being re-rendered on a timer.
- Faster Vercel builds: apps with no changes are skipped, and the web
  functions no longer bundle sharp.
- Higher text contrast in both themes.
- Server functions of both apps run on Bun instead of Node.js.
- Links are prerendered on hover (Chrome and Edge; prefetched where the
  browser declines), and pages crossfade on navigation, so switching
  language or opening a post feels faster. Web Analytics counts a
  prerendered page only when it is shown.
- A page that is not cached yet renders faster: the layout's CMS requests
  (site settings, header and footer, recent posts, work) start together in
  the middleware instead of one after another.
- `/search` filters in the browser from one cached page, so a new query
  never waits for the server; requests for files that do not exist
  (`/wp-login.php` and similar) are answered at once, and missing pages are
  cached. Less CSS (about 60% smaller) and no inlined fonts.
- Japanese and Chinese pages draw "…" full width, so it no longer crowds
  the next character.
- Search metadata: every page has a description (posts without an SEO
  description use their opening text), posts are marked as articles with
  their dates, and the home page, posts and /work entries carry structured
  data (schema.org). Search results and missing pages are kept out of
  search engines, and the sitemap lists the home page and no longer lists
  search or gives made-up change dates. The home page title can carry a
  tagline after the site name (CMS, Site global).
- After each Vercel deployment of the web app, a GitHub Actions workflow
  requests every page once, so visitors do not wait for the first renders.
  `/work` pages are in the sitemap.
- Phones: larger tap targets in the ADE top bar (search icon, view and
  language switches), the /status panel and /work group headings; search
  fields no longer make iOS zoom in; rows react to a tap at once; keyboard
  hints are hidden on touch screens.
- The dev container installs the same Bun as the repo (1.4) next to Node.js 24,
  installs every workspace from `bun.lock`, and exposes the web dev server.

### Security

- Draft preview needs the unguessable cookie set by the Preview button; a
  hand-made `athena-draft` cookie no longer asks the CMS for drafts.
- Leaving preview can only return to a page on this site (it accepted
  `//other-site` as a path).
- Links from the CMS and from GitHub are shown only as web, mail or phone
  links or pages on this site, never `javascript:` and the like.

### Fixed

- Saving in the CMS now reports when it could not refresh the cached site
  (missing secret, or a redirect to the Vercel login) instead of failing
  silently, and can pass Vercel Authentication on a protected Preview.
- Redeploying a Vercel deployment (for example after changing environment
  variables) builds again instead of being skipped as "no changes".
- Japanese and Chinese pages: a missing page now shows the 404 in the page's
  language (it fell back to English), and the settings panel, previous and
  next links and the home summary line are translated.

### Removed

- Leftovers of the Payload website template: its footer links (Source Code,
  Payload) in new databases, its share image, its static `/llms.txt`
  (now built from the CMS), its "| Payload Website Template" SEO title
  suffix and the Checkly example checks.
- The Admin link in the footer (new databases no longer get it).
