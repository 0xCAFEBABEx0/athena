# CMS admin UI

The Payload admin (`cms.whoa.me/admin`) has a Ghost-like look: cool greys,
Inter, ink pill buttons, pink drafts, a quiet floating sidebar. It was built
on Payload 3.93 (1.4.0) to survive the move to Payload 4.0 with as little
rework as possible. This page says how it is put together and what to do at
4.0.

## Layers

| Layer | Where | Survives 4.0? |
|---|---|---|
| Tokens (`--whoa-*`, light and `html[data-theme='dark']`) | `apps/cms/src/app/(payload)/custom.scss`, part 1 | Yes, as is |
| Mapping onto Payload 3 variables (`--color-base-*`, `--font-body`, `--style-radius-*`) | `custom.scss`, part 2 | Rewrite for `--color-*` / `--ramp-*` |
| Payload 3 selector overrides (`.nav__link`, `.btn--style-primary`, `.table`, `#field-title`, …) | `custom.scss`, part 3 | Delete, then redo only what still looks wrong |
| Our components (daisyUI) | `apps/cms/src/components/{AdminBrand,AdminHome,PostRowCell,BeforeLogin,TranslateButton}` | Yes: they use only stable admin APIs and their own classes |
| Sidebar groups | `apps/cms/src/plugins/adminNav.ts` (`admin.group` per slug) | Yes |
| Labels: Posts → Notes, Projects → Builds | the collection configs | Yes |

`custom.scss` is plain CSS (no Sass features), because Payload 4 reads
`custom.css` instead: the file is renamed, not rewritten.

## daisyUI inside the admin

`apps/cms/src/admin-ui/index.css` (imported by the components that use it)
builds Tailwind v4 + daisyUI 5 through `@tailwindcss/postcss`
(`apps/cms/postcss.config.mjs`). Rules:

- **Every class has the `tw:` prefix** (`tw:btn tw:btn-neutral`,
  `tw:md:grid-cols-[100px_minmax(0,1fr)]`). Payload has its own `.btn`,
  `.card`, `.table`; unprefixed daisyUI classes would restyle Payload's.
- **No preflight.** Only `tailwindcss/theme.css` and `utilities.css` are
  imported, so Tailwind does not reset Payload's own elements.
- **Wrap our markup in `.whoa-ui`.** daisyUI's theme variables (`--color-base-100`,
  `--color-primary`, radius, sizes) are set on `.whoa-ui` only, from the
  `--whoa-*` tokens; `themes: false` keeps them off `:root`, where Payload 3
  uses `--color-base-*` for its own ramp.
- **Pixel scale.** Payload 3 sets the root font size to 13px, so Tailwind's
  rem spacing and text sizes are pinned to px in `@theme`
  (`--spacing: 4px`, `--text-sm: 14px`, …). Use the named sizes or px
  arbitrary values, not rem.
- **Only the listed components ship.** The daisyUI `include:` list is
  `button, card, stat, list, badge, alert, loading, kbd, radius`; add a
  component there before using it.
- `@source '../components'` is what Tailwind scans; classes built from
  strings elsewhere are not generated.

Tailwind stays below 4.3.4 like `apps/web` (see the Dependabot note on
tailwindcss#20668); the `tailwind` Dependabot group covers both apps.

## Components and the admin APIs they use

| Component | Hook | API (stable in 3 and 4) |
|---|---|---|
| `AdminBrand#Logo`, `#Icon` | login logo, sidebar icon | `admin.components.graphics` |
| `BeforeLogin` | line above the login form | `admin.components.beforeLogin` |
| `AdminHome` | dashboard header, counts, recent notes | `admin.components.beforeDashboard` (server component, `payload.find` / `count`) |
| `PostRowCell` | Notes list row (thumbnail, title, author, time, state) | field `admin.components.Cell` on `title`; its client `RowLink` reads `useListDrawerContext` from `@payloadcms/ui` so that inside a list drawer a click selects the note, as Payload's default cell does (re-check at 4.0) |
| `TranslateButton` | Translate to ja/zh in the post sidebar | field UI component; plain `<button>` with daisyUI, not Payload's `Button` (its `size="small"` is gone in 4) |

Shared helpers are in `apps/cms/src/utilities/adminFormat.ts` (`timeAgo`,
`publishState`, `thumbnailURL`). `thumbnailURL` reads `variants.thumbnail`
(Payload 4) and falls back to `sizes.thumbnail` (Payload 3), so it needs no
change at the upgrade.

`meta.titleSuffix` and the SVG favicon are in `payload.config.ts`.

The big borderless title (part 3 of `custom.scss`) applies only to Notes and
Pages (`.collection-edit--posts`, `.collection-edit--pages`); their title
fields carry a `Title` placeholder because the label is hidden. Other
collections keep Payload's labelled field.

## Payload 4.0 steps

Do these on the upgrade branch after `@payloadcms/codemod` (the rest of the
upgrade, such as the schema changes and `sizes` → `variants`, is outside the
admin UI):

1. `git mv apps/cms/src/app/(payload)/custom.scss apps/cms/src/app/(payload)/custom.css`.
2. Rewrite part 2 for Payload 4's variables (`--color-*`, `--ramp-*`):
   map the grey ramp, font and radius from the `--whoa-*` tokens.
3. Delete part 3 and look at the admin at the widths below; add back
   only what Payload 4's own design gets wrong, with 4's class names.
4. Check that the daisyUI scope still holds: if Payload 4 stops using
   `--color-base-*` on `:root`, `.whoa-ui` can stay as it is anyway.
5. `bun run generate:importmap`, then the admin checks in `docs/TESTING.md`
   (TC-A-*).

## Checking it

Look at login, dashboard, the Notes list and a note at **1440, 390 and
320px, light and dark** (TC-A-01 to TC-A-05). Phones matter: the Notes list
hides the Published column below 768px because the row already shows the
state and time, and the editor title shrinks to 1.6rem. Payload's own edit
header at 320px (breadcrumb over the locale selector) is Payload's layout,
not ours.
