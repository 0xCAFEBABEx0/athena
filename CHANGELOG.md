# Changelog

All notable changes to the site are listed here. The version rules are in
[`docs/VERSIONING.md`](docs/VERSIONING.md); the release workflow publishes the
section of each new version as a GitHub Release.

## [1.0.0] - Unreleased

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
- A prompt-style favicon.
- CLI view: the home intro box is a banner with Hoo, a pixel owl in round
  glasses. Click it to wake it: it waves, winks and says a tip (still with
  Reduce motion on). Style, owl and tips are set in the CMS (Site global).
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
- After each Vercel deployment of the web app, a GitHub Actions workflow
  requests every page once, so visitors do not wait for the first renders.
  `/work` pages are in the sitemap.
- Phones: larger tap targets in the ADE top bar (search icon, view and
  language switches), the /status panel and /work group headings; search
  fields no longer make iOS zoom in; rows react to a tap at once; keyboard
  hints are hidden on touch screens.
- The dev container installs the same Bun as the repo (1.4) next to Node.js 24,
  installs every workspace from `bun.lock`, and exposes the web dev server.

### Fixed

- Redeploying a Vercel deployment (for example after changing environment
  variables) builds again instead of being skipped as "no changes".
- Japanese and Chinese pages: a missing page now shows the 404 in the page's
  language (it fell back to English), and the settings panel, previous and
  next links and the home summary line are translated.

### Removed

- The Admin link in the footer. The public nav never links to the CMS admin,
  even if an editor adds one.
