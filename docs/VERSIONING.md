# Versioning

Athena has one version for the whole site (both apps and `packages/shared`).
It lives in the root `package.json` `version` field, follows
[Semantic Versioning 2.0.0](https://semver.org/), and is shown next to the
site name and in the `/status` panel of the web app.

## What changes the version

The version describes the **code**, not the content. Publishing, editing or
deleting posts and pages in the CMS never changes it.

| Bump  | When                                                                                   | Examples                                                                 |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| MAJOR | A redesign, or a change that breaks URLs, feeds or the content model for existing data | new site layout, removing a route, renaming a collection, dropping a field |
| MINOR | A new feature or a backwards-compatible schema change                                  | a new block, a new CMS field or table (needs prod SQL), a new page type, a new view or shortcut |
| PATCH | Everything else that ships                                                             | bug fixes, copy and style tweaks, performance, dependency updates, docs   |

When in doubt, choose the larger bump. A change that needs SQL in production
(see `docs/DATABASE.md`) is at least MINOR.

## How the version is displayed

The web app reads the version at build time (`apps/web/src/lib/build-info.mjs`)
and adds a pre-release suffix outside Production, so a staging build can never
be mistaken for a release:

| Deployment               | `VERCEL_ENV`  | Header / footer   | `/status` Version            |
| ------------------------ | ------------- | ----------------- | ---------------------------- |
| Production (`main`)      | `production`  | `v1.2.0`          | `v1.2.0`                     |
| Preview (`preview`)      | `preview`     | `v1.2.0-preview`  | `v1.2.0-preview.<commit>`    |
| Local (`bun run dev`)    | unset         | `v1.2.0-dev`      | `v1.2.0-dev.<commit>`        |

`<commit>` is the first 7 characters of the Git commit SHA.

## Release procedure

1. On `development`, bump `version` in the root `package.json` and add a
   section for it at the top of `CHANGELOG.md` (`## [X.Y.Z] - YYYY-MM-DD`).
   Bump in the same push as the change, or in a separate commit before
   promoting. Several changes can share one bump.
2. Promote as usual: `development` -> `preview` (check the preview deploy and
   its `/status` panel) -> PR from `preview` to `main`.
3. When the PR merges, `.github/workflows/release.yml` creates the Git tag
   `vX.Y.Z` on `main` and a GitHub Release whose notes are that version's
   `CHANGELOG.md` section. If the tag already exists (the version was not
   bumped), it does nothing.

Rules:

- Never reuse or move a tag. If a release is broken, ship a new PATCH.
- Dependabot PRs are not released on their own; their updates ship in the next
  bump, usually as PATCH.
- Hotfixes follow the same path and get a PATCH bump.
- The workspace `package.json` files (`apps/*`, `packages/shared`) keep their
  own `version` fields at `1.0.0`; they are private and are not released.
