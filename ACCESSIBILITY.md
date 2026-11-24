# Accessibility

This statement covers **[whoa.me](https://whoa.me)**, the public site built
from `apps/web`: a portfolio and blog in English (`/`), Japanese (`/ja`) and
Chinese (`/zh`), with two views of the same content (CLI, a terminal style,
and ADE, an agent-app style) and light and dark themes.

The CMS admin (`apps/cms`, `cms.whoa.me`) is Payload CMS's own interface,
used only by the site owner and behind sign-in. It is out of scope here,
except for the admin components this repository adds (see
[`docs/ADMIN.md`](./docs/ADMIN.md)).

Last reviewed: 2026-11-24 (version 1.8.1).

## Goals

Anyone should be able to read the notes, browse the builds and use search,
whichever view, theme or language they pick, and with a keyboard alone.

The target is **WCAG 2.2 level AA**. That is a target, not a claim: the
site has not had an accessibility audit, so it does not claim conformance.
The parts below say what has been checked and what has not.

## What the site does today

- **Structure**: every page sets `lang` to its language, has one `<main>`
  landmark, and labels its navigation regions (header nav, sidebar,
  breadcrumb, pagination, "On this page", previous/next note).
- **Keyboard**: everything can be reached with Tab. Visible focus outlines
  use the accent color. The search popup and the `/status` panel are native
  `<dialog>` elements, so focus stays inside while they are open and Esc
  closes them. A wide table in a note scrolls inside its own box, which
  takes focus so the arrow keys can scroll it.
- **Shortcuts**: single-key shortcuts help keyboard users move around
  (`/` search, `j`/`k` through lists, `h`/`l` between sections, `g h` home,
  `t` theme, `v` view, `s` the `/status` panel). They never fire inside a
  text field or an open dialog, they are listed in the `/status` panel's
  Keys tab, and they can be **turned off** in `/status` → Config →
  Keyboard shortcuts, for speech input and screen reader users whose keys
  would otherwise trigger them.
- **Motion**: every animation and view transition stops when the system
  asks for reduced motion, and also under `/status` → Config → Reduce
  motion.
- **Themes**: light and dark themes; the first visit follows the system
  setting, and the choice is kept.
- **Zoom and narrow screens**: no sideways page scrolling down to 320 px
  wide. Code blocks and tables that cannot wrap scroll inside their own
  box.
- **Live updates**: search result counts, the Ask AI status and answer, and
  form errors are announced through live regions.
- **Forms**: every field has a label.
- **Languages**: the language switch links carry `lang` and `hreflang`, so
  each language name is read in its own language.

## Supported environments

- **Browsers**: current Safari (16.4 and later), Chrome and Edge (111 and
  later) and Firefox (128 and later), on desktop and mobile. Older browsers
  are not supported (see [`docs/BASELINE.md`](./docs/BASELINE.md)).
- **Tested**: the end-to-end suite (Playwright, Chromium) runs at 320, 390,
  768 and 1280 px, and covers the keyboard shortcuts, the dialogs, table
  scrolling and narrow layouts ([`docs/TESTING.md`](./docs/TESTING.md)).
  UI changes are also checked by eye in both views, both themes and all
  three languages.
- **Not tested yet**: screen readers (VoiceOver, NVDA, JAWS, TalkBack),
  voice control, Windows High Contrast / forced colors, and automated
  checks such as axe. Reports from people using these are especially
  welcome.

## Known limitations

| What is affected | Details | Workaround |
|---|---|---|
| Skipping the navigation | There is no "skip to content" link, so Tab goes through the header (CLI) or the sidebar (ADE) on every page first. | On pages with a list (notes, builds, stacks, home), `j` jumps to its first item; `/` opens search. |
| Images | The alt text field in the CMS is optional. An image without alt text is treated as decorative (`alt=""`), so a screen reader skips it even when it carries meaning. | None yet. The site owner adds alt text when publishing. |
| Untranslated text on `/ja` and `/zh` | A note or page without a translation shows its English text, but that text is not marked `lang="en"`, so a screen reader may read it with a Japanese or Chinese voice. | Use the English page (`/`) for that content. |
| Color contrast | The muted text (dates, labels, hints) has not been measured against WCAG contrast ratios in either theme. | Switch theme with `t` or the theme switch; browser zoom and system contrast settings apply. |
| Ask AI answers | The answer streams into a polite live region. How that sounds with a screen reader has not been tested and may be verbose. | Search by meaning (Enter in Search) lists matching excerpts without a generated answer. |

## Reporting a barrier

If something on the site is hard or impossible to use, please
[open an accessibility issue](https://github.com/0xCAFEBABEx0/athena/issues/new?template=accessibility.yml).
You can write in English, Japanese or Chinese.

Helpful, if you have it: the page address, what you were trying to do, what
happened, and your browser, operating system and any assistive technology
or setting you use (screen reader, zoom level, reduced motion, keyboard
only). Screenshots and recordings are optional. You never need to tell us
about a disability.

Please do not report security problems in a public issue.

## What happens next

This is a personal site with one maintainer, so these are aims rather than
guarantees:

1. The report is acknowledged within a week and gets the `accessibility`
   label.
2. If a workaround exists, it is posted on the issue.
3. A fix ships in a normal release; the issue links the change and is
   closed when it reaches whoa.me. You are welcome to confirm the fix or
   reopen the issue if it does not work for you.

Barriers that block reading content or using navigation come first.

## For contributors and coding agents

A change to `apps/web` that adds or alters UI should:

- work with the keyboard alone, with a visible focus outline, in both
  views;
- keep new shortcuts out of text fields and dialogs, list them in the Keys
  tab, and respect the Keyboard shortcuts setting;
- stop new motion under `prefers-reduced-motion: reduce` and
  `[data-motion='reduce']`;
- give controls an accessible name (visible text, a `<label>`, or
  `aria-label` for icon buttons), and hide decorative art (such as the CLI
  owl) with `aria-hidden="true"`;
- keep page text in the page's language, or mark it with `lang`;
- cause no sideways page scroll at 320 px;
- add or update a case in [`docs/TESTING.md`](./docs/TESTING.md), and say
  in the change description how it was checked.

The front-end rules these build on are in
[`docs/BASELINE.md`](./docs/BASELINE.md); [`AGENTS.md`](./AGENTS.md) points
coding agents here.

## Ownership and updates

The repository owner maintains this statement. It is reviewed when a
release changes how the site looks or behaves, and the date above changes
with each review. When a known limitation is fixed, it moves out of the
table in the same change.

Suggestions for this statement or for the site's accessibility practices
are welcome as issues or pull requests.
