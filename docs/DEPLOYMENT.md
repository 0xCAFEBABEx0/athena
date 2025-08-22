# Deployment Guide

This project follows a **Development → Preview → Production** workflow using Vercel and GitHub.

## Workflow Overview

```
Development (Local)
        ↓
Development Branch
        ↓
Preview (Staging)
        ↓
Production (Live)
```

## Environment Details

### 1. Development Environment
- **Branch**: `development` / feature branches
- **URL**: `http://localhost:3000`
- **Environment**: `development`
- **Sentry Environment**: `development`
- **Database**: Local/Development database

### 2. Preview Environment
- **Branch**: `preview`
- **URL**: Vercel preview URL (auto-generated)
- **Environment**: `preview`
- **Sentry Environment**: `staging`
- **Database**: Production database (read-only recommended)

### 3. Production Environment
- **Branch**: `main`
- **URL**: Production domain
- **Environment**: `production`
- **Sentry Environment**: `production`
- **Database**: Production database

## Deployment Commands

### Quick Commands
```bash
# Deploy to preview
pnpm run deploy:preview

# Deploy to production
pnpm run deploy:production

# Check current environment
pnpm run env:check
```

### Manual Deployment Flow

#### 1. Feature Development
```bash
# Switch to development branch
git checkout development

# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "Add new feature"

# Merge back to development
git checkout development
git merge feature/new-feature
git push origin development
```

#### 2. Preview Deployment
```bash
# Deploy development to preview
pnpm run deploy:preview

# Or manually:
git checkout preview
git merge development
git push origin preview
```

#### 3. Production Deployment
```bash
# Switch to main branch
git checkout main

# Merge preview branch
git merge preview

# Push to trigger production deployment
git push origin main
```

## Automated Deployments

### GitHub Actions
The project includes GitHub Actions workflows that automatically:

1. **Lint and Type Check** on all pushes and PRs
2. **Deploy to Preview** when pushing to `preview` branch
3. **Deploy to Production** when pushing to `main` branch

### Required Secrets
Set these secrets in your GitHub repository:

- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

## Environment Variables

### Local Development (.env.local)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/zeus_dev"

# Payload CMS
PAYLOAD_SECRET="your-local-secret"
PAYLOAD_PUBLIC_SERVER_URL="http://localhost:3000"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="your-blob-token"

# Sentry
SENTRY_DSN="your-sentry-dsn"
```

### Vercel Environment Variables
Configure these in the Vercel dashboard for each environment:

#### Preview Environment
- `DATABASE_URL`: Production database URL (read-only user recommended)
- `PAYLOAD_SECRET`: Staging secret
- `BLOB_READ_WRITE_TOKEN`: Staging blob token
- `NEXT_PUBLIC_VERCEL_ENV`: `preview`

#### Production Environment
- `DATABASE_URL`: Production database URL
- `PAYLOAD_SECRET`: Production secret
- `BLOB_READ_WRITE_TOKEN`: Production blob token
- `NEXT_PUBLIC_VERCEL_ENV`: `production`

## Best Practices

### 1. Branch Protection
- Protect `main` branch with required PR reviews
- Require status checks to pass before merging
- Require branches to be up to date before merging

### 2. Testing Strategy
- Test thoroughly in development
- Deploy to preview for stakeholder review
- Only merge to production after preview approval

### 3. Database Migrations
- Test migrations in development first
- Run migrations in preview environment
- Schedule production migrations during low-traffic periods

### 4. Rollback Strategy
- Keep previous deployments available in Vercel
- Use Git tags for important releases
- Have a rollback plan for database migrations

### 5. Monitoring
- Monitor Sentry for errors in each environment
- Use Vercel Analytics for performance metrics
- Set up alerts for critical issues

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build locally
pnpm build

# Check for linting issues
pnpm lint

# Regenerate types
pnpm generate:types
```

#### 2. Environment Variable Issues
```bash
# Check environment configuration
pnpm run env:check

# Verify Vercel environment variables
vercel env ls
```

#### 3. Database Connection Issues
- Verify database URLs in each environment
- Check database user permissions
- Ensure network access from Vercel

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review Vercel deployment logs
3. Monitor Sentry for runtime errors
4. Contact the development team 