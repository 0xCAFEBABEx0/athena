# 0004. Bun monorepo deployed as two Vercel projects

- **Status**: Accepted
- **Area**: root `package.json`, `apps/*/vercel.json`

## Context

The CMS and the public site change together often (a new block touches the
schema, the generated types and the Astro component). Separate repositories
would split those changes across PRs. They still need independent runtimes,
build settings and domains.

## Decision

- One Bun-workspaces repository with `apps/cms`, `apps/web` and
  `packages/shared`.
- Two Vercel projects pointing at the same repository, selected by Root
  Directory. Each project's `vercel.json` whitelists only `main` and `preview`
  for deploys (`"**": false`) and skips the redundant Preview build after a
  `preview → main` release merge.
- Branch promotion `development → preview → main`. `main` is protected and
  updated through a PR from `preview`.

## Consequences

- A push to `preview` or `main` builds both apps, even if only one changed.
- Feature branches never deploy, which protects the Hobby build quota.
- If `main` receives commits that are not on `preview`, the staging URL lags
  until the next real `preview` push.
