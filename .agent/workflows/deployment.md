---
description: Deployment workflow covering Development, Preview, and Production environments
---

# Deployment Workflow

## 🌍 Environments

| Environment | Branch | URL | Description |
|---|---|---|---|
| **Development** | `development` | http://localhost:3000 | Local development environment |
| **Preview** | `preview` | Vercel Preview URL | Staging environment for review |
| **Production** | `main` | Production Domain | Live production environment |

## 🚀 Deployment Flow

### 1. Deploy to Preview (Staging)
Automated via GitHub Actions when pushing to `preview` branch.

```bash
# Merge development to preview
git checkout preview
git merge development
git push origin preview
```

**Manual Command:**
```bash
pnpm run deploy:preview
```

### 2. Deploy to Production
Automated via GitHub Actions when pushing to `main` branch.

```bash
# Merge preview to main
git checkout main
git merge preview
git push origin main
```

**Manual Command:**
```bash
pnpm run deploy:production
```

## ✅ Verification
- Check GitHub Actions for build status.
- Verify Vercel deployment logs.
- Monitor Sentry for any new errors.
