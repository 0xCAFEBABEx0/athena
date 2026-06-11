---
description: Deployment workflow — two Vercel projects (apps/cms, apps/web) across Development, Preview, Production
---

# Deployment Workflow

> Two Vercel projects from one monorepo, split by **Root Directory**
> (`apps/cms`, `apps/web`). Branch promotion drives both. See
> [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

## 🌍 Environments

| Environment | Branch | CMS | Web |
|---|---|---|---|
| **Development** | `development` | http://localhost:3000 | http://localhost:4321 |
| **Preview** | `preview` | Vercel preview URL | Vercel preview URL |
| **Production** | `main` | Production domain | Production domain |

A push to `preview`/`main` triggers Vercel to build **both** apps for that
environment. GitHub Actions runs lint + type check (it does not deploy).

## 🚀 Deployment Flow

### 1. Deploy to Preview (staging)

```bash
bun run deploy:preview     # git checkout preview && git merge development && git push
```

### 2. Deploy to Production

`main` is protected — ship via Pull Request:

1. `gh pr create --base main --head preview --title "release: deploy to production"`
2. Wait for checks to pass.
3. Merge the PR (Vercel deploys both apps to Production).

```bash
# Local sync after the PR merges
git checkout main && git pull origin main
```

## 🔗 CMS ⇄ Web Contract

Keep `PREVIEW_SECRET` and `REVALIDATE_SECRET` **identical** in both Vercel
projects; set `WEB_URL` (CMS) / `CMS_URL` (web) and the web app's
`PAYLOAD_API_KEY`. Drift = silent 401s. See
[`AGENTS.md → CMS ⇄ Web Contract`](../../AGENTS.md#cms--web-contract).

## ✅ Verification

- GitHub Actions "Lint and Type Check" is green.
- Both Vercel projects' deploy logs succeed.
- Monitor Sentry for new errors.
