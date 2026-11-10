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
  a cached index, plus `/status` as a command.
- Site version next to the site name, and a settings panel (click the
  version, press `s`, or run `/status`) with build and cache details and a
  searchable Config list, including Reduce motion and an option to turn off
  single-key shortcuts.
- Site name, intro, links, projects and the default view are editable in the
  CMS (Site global).
- A prompt-style favicon.

### Changed

- Pages, feeds, sitemaps and the search index are cached at Vercel until the
  CMS publishes a change, instead of being re-rendered on a timer.
- Faster Vercel builds: apps with no changes are skipped, and the web
  functions no longer bundle sharp.
- Higher text contrast in both themes.
- Server functions of both apps run on Bun instead of Node.js.
- Links are prefetched on hover, and pages crossfade on navigation, so
  switching language or opening a post feels faster.
- The dev container installs the same Bun as the repo (1.4) next to Node.js 24,
  installs every workspace from `bun.lock`, and exposes the web dev server.

### Fixed

- Japanese and Chinese pages: a missing page now shows the 404 in the page's
  language (it fell back to English), and the settings panel, previous and
  next links and the home summary line are translated.

### Removed

- The Admin link in the footer. The public nav never links to the CMS admin,
  even if an editor adds one.
