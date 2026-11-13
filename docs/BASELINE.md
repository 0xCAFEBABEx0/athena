# Browser Support (Baseline) and Front-end Design Rules

This is the single place for the web app's browser-support policy and the
design rules that depend on it. `AGENTS.md` points here for anything about
UI, CSS, themes or client-side JavaScript in `apps/web`. The CMS admin is
Payload's own UI and is out of scope, except where noted.

Browser data below comes from [web-features](https://github.com/web-platform-dx/web-features)
(the data behind [Baseline](https://web.dev/baseline)), checked on
2026-11-11. Re-check a feature's status before relying on it; Baseline moves
every few months.

## 1. Baseline target

**The site must work in every browser that supports Baseline Widely
available features. Newer features are allowed only as progressive
enhancement.**

| Feature status | Rule |
|---|---|
| **Baseline Widely available** (interoperable for 30+ months) | Use freely, no fallback. |
| **Baseline Newly available** | Use only when the page still works and reads correctly without it (wrapping, an effect, a shortcut). If the feature carries behavior, feature-detect it and keep the old path. |
| **Limited availability** (missing in at least one engine) | Enhancement only, never required. Keep the existing JavaScript or markup path for the other browsers. |
| Origin trials, flags, single-engine experiments | Do not use. |

Hard floor: Tailwind CSS v4 (and so daisyUI 5) needs **Safari 16.4+,
Chrome 111+ and Firefox 128+** (`@property`, `color-mix()`, cascade
layers). Older browsers get broken styling and are not supported.

Polyfills: none today. Adding one needs a reason in the change description,
and it must load only where the feature is missing (dynamic `import()` after
feature detection), never for every visitor.

## 2. Features in use today

| Feature | Where | Status | Without it |
|---|---|---|---|
| `<dialog>` + `showModal()` | `SearchDialog.astro`, `StatusDialog.astro` | Widely | — |
| `<details>` menus | CLI language menu (`Header.astro`) | Widely | — |
| `color-scheme`, `prefers-reduced-motion`, `:focus-visible`, `aspect-ratio` | `global.css` | Widely | — |
| `color-mix()`, cascade layers | `global.css`, Tailwind output | Widely | (floor) |
| `@property` | Tailwind output | Newly (2024-07) | (floor) |
| `text-wrap: balance` | headings, `global.css` | Newly (2024-05) | normal wrapping |
| `backdrop-filter` | ADE top bar | Newly (2024-09) | no blur; the bar background is 88 % opaque |
| Cross-document view transitions (`@view-transition`) | `global.css` | Limited (Chrome 126, Safari 18.2; not Firefox) | plain navigation |
| Speculation rules (prerender/prefetch on hover) | `Layout.astro` | Limited (Chromium only) | normal page loads |

Rules that come with them:

- **Prerendering**: a hovered link's page runs its scripts before it is
  shown. Anything that must run only when the page is visible (analytics,
  settings read from `localStorage`) waits for `prerenderingchange` while
  `document.prerendering` is true.
- **Motion**: every animation and transition is off under
  `prefers-reduced-motion: reduce` and under the `/status` → Config →
  Reduce motion setting (`:root[data-motion='reduce']`).
- **Light dismiss for dialogs** stays in JavaScript (`closedby` is Limited:
  no Safari).

## 3. Design rules

- **Two views, one content**: CLI (terminal style) and ADE (agent-app
  style, `modern` in code and the CMS). See `docs/SPECIFICATION.md` F-VIEW-1.
- **Themes**: light (warm paper `#faf9f5`, one orange accent) and dark (warm
  near-black, lighter orange), defined as daisyUI themes in
  `apps/web/src/styles/global.css`. Mono font for dates, nav and labels.
- **Dark mode** is the `data-theme="dark"` attribute, not the OS media query.
  The choice is stored in `localStorage['payload-theme']` (the same key as
  the CMS admin) and applied by an inline `<head>` script before paint; the
  OS preference is only the first-visit default.
- **daisyUI first**: use a daisyUI component where one fits. Only the
  components in the `include:` list of `global.css` are shipped; add a name
  there before using a new component, or it renders unstyled.
- **Switches** (view, language, theme) all use the same toggle style: CLI
  `[xx]` brackets, ADE daisyUI tabs (the ADE theme tabs are sun | moon
  icons). Order everywhere: view → language → theme (CLI header, ADE top
  bar, `/status` config rows). On phones the CLI switches wrap as one group
  onto their own row under the section links, never one by one.
- **Language**: switch values stay English (CLI / ADE, EN / JP / ZH,
  Light / Dark, true / false); all other UI text follows the page language.
  The CLI header is lowercase (`posts`, `[ade]`, `[dark]`, `[en]`).
- **Fonts**: Geist Sans / Geist Mono, Latin subsets only, served as files
  (never inlined). Japanese and Chinese fall back to system fonts.
- **Narrow screens**: no horizontal scroll down to 320 px. Check real
  screens at 320 / 390 / 768 / 1280 px, light and dark, en / ja / zh, before
  calling a UI change done (`docs/TESTING.md`).
- **Marks and icons**: nothing that resembles another company's logo or
  product mark. The site mark is the `❯_` favicon (`SiteMark.astro`).

## 4. Candidates (not adopted yet)

From the Modern Web Guidance review (2026-11-11). Adopt one only under the
rules in section 1.

| Idea | Status | Note |
|---|---|---|
| `closedby="any"` on the dialogs | Limited | Could replace the click-outside handler in Chrome and Firefox; the JS stays for Safari. |
| Invoker commands (`commandfor`) to open dialogs | Newly (2025-12) | Removes small open handlers; keep the JS path. |
| Popover API + anchor positioning for the language menu | Popover Newly (2025-01), anchor positioning Limited | Would replace the JS that picks the menu's side; only worth it once anchor positioning is Baseline. |
| `font-size-adjust` for the Geist / CJK mix | Newly (2024-07) | Only if Speed Insights shows layout shift from font swaps; needs an eye check in ja / zh. |
| Security headers (CSP, `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy`) | Widely | Production sends only HSTS. Because pages are ISR-cached, a CSP has to use hashes, not nonces; start in Report-Only. |

## 5. Looking things up

Chrome's [Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance)
has short, browser-checked guides for most UI patterns (dialogs, menus,
view transitions, forms, performance, security). They are plain Markdown in
[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)
under `skills/modern-web-guidance/guides/`, and can also be installed as a
Claude Code plugin (`claude plugin install modern-web-guidance@claude-plugins-official`).
Its default assumes "Widely available, fallbacks for the rest", which matches
section 1. When a guide and this document disagree, this document wins.
