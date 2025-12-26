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
bun run deploy:preview
```

### 2. Deploy to Production
**Requirement:** GitHub Repository Rules enforce Pull Requests for the `main` branch.

1. Create a Pull Request from `preview` to `main` on GitHub.
2. Wait for checks to pass.
3. Merge the Pull Request.

**Manual Command (Local Sync only):**
```bash
# Sync local main with remote after PR merge
git checkout main
git pull origin main
```

## ✅ Verification
- Check GitHub Actions for build status.
- Verify Vercel deployment logs.
- Monitor Sentry for any new errors.
