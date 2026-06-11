# Development Workflow

## 🎯 Branch Strategy

Three-branch **linear promotion**: `development` → `preview` → `main`.

```
main (production) ← preview (staging) ← development (dev)
     🚀                   🔄                  🔧
```

| Branch        | Purpose                  | Deploys To                | Direct Push       |
| ------------- | ------------------------ | ------------------------- | ----------------- |
| `development` | 🔧 Active development     | ❌ None                   | ✅ Allowed        |
| `preview`     | 🔄 Staging & review       | ✅ Vercel Preview         | ⚠️ Limited        |
| `main`        | 🚀 Production             | ✅ Vercel Production       | ❌ **Restricted** |

Both Vercel projects (`apps/cms` and `apps/web`) follow this branch model — a
push to `preview`/`main` deploys **both** apps to the matching environment. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the two-project setup.

## 📋 Recommended Flow

### 1. Development Phase

```bash
git checkout development
git pull origin development

# ... make changes ...

git add .
git commit -m "feat: implement new feature"
git push origin development
```

**Result**: GitHub Actions runs lint + type check. No deployment (fast feedback).

### 2. Staging Phase

```bash
# Promote development -> preview (merge + push)
bun run deploy:preview
```

`deploy:preview` runs `git checkout preview && git merge development && git push
origin preview`. The push deploys both apps to **Vercel Preview**.

> Prefer review via PR? Open one instead:
> `gh pr create --base preview --head development --title "feat: ... for review"`.

### 3. Production Phase

The `main` branch is protected — production ships through a Pull Request:

```bash
gh pr create --base main --head preview --title "release: deploy to production"
```

Wait for checks to pass, get approval, then merge. The merge deploys both apps to
**Vercel Production**.

> `bun run deploy:production` (`git checkout main && git merge preview && git push
> origin main`) exists for repos without branch protection, but the protected-PR
> route above is the intended path for `main`.

## 🔒 Branch Protection (recommended GitHub settings)

### `main`

```
Repository Settings → Branches → Add protection rule

Branch pattern: main
☑️ Require a pull request before merging
  ☑️ Require approvals (1+)
  ☑️ Dismiss stale PR approvals when new commits are pushed
☑️ Require status checks to pass before merging
  ☑️ Require branches to be up to date before merging
  ☑️ Lint and Type Check (GitHub Actions)
☑️ Require conversation resolution before merging
```

### `preview` (optional)

```
Branch pattern: preview
☑️ Require status checks to pass before merging
```

## ⚠️ Hotfix for Production

```bash
# 1. Branch from main
git checkout main && git pull origin main
git checkout -b hotfix/critical-fix

# 2. Make the minimal fix, then open an emergency PR
git push origin hotfix/critical-fix
gh pr create --base main --head hotfix/critical-fix --title "hotfix: critical production fix"

# 3. After merge, sync the fix back down the chain
git checkout preview && git pull origin main && git push origin preview
git checkout development && git pull origin preview && git push origin development
```

## 📊 Environment URLs

| Environment | CMS (`apps/cms`) | Web (`apps/web`) |
|---|---|---|
| **Development** | http://localhost:3000 | http://localhost:4321 |
| **Preview** | Vercel preview URL | Vercel preview URL |
| **Production** | Production domain | Production domain |

## 🆘 Troubleshooting

- **Status checks failing** — check the GitHub Actions "Lint and Type Check" job;
  fix on `development` and re-promote.
- **Deployment not triggered** — verify each Vercel project's Git integration and
  Root Directory (`apps/cms` / `apps/web`); see [`DEPLOYMENT.md`](./DEPLOYMENT.md).
