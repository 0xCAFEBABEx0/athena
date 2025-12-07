---
description: Development workflow including server startup, testing, linting, and git operations
---

# Development Workflow

## 🚀 Getting Started

### Start Development Server
```bash
bun dev
```
- Frontend: http://localhost:3000
- Admin Panel: http://localhost:3000/admin

## 🛠️ Common Commands

### Type Checking
```bash
bun run generate:types
```

### Linting
```bash
bun run lint
bun run lint:fix
```

### Environment Check
```bash
bun run env:check
```

### Database & Migrations
```bash
# Run migrations
bun payload migrate

# Seed database
curl http://localhost:3000/next/seed
```

## 🔄 Git Workflow

### Feature Development
1. Checkout `development` branch: `git checkout development`
2. Create feature branch: `git checkout -b feature/your-feature-name`
3. Make changes and commit.
4. Push to origin: `git push origin feature/your-feature-name`

### Pull Requests
- **Development**: Create PR to `development` for new features.
- **Staging**: Create PR from `development` to `preview` for staging.
- **Production**: Create PR from `preview` to `main` for production release.

## 🐛 Troubleshooting

### Port Already in Use
```bash
lsof -ti:3000 | xargs kill -9
```

### TypeScript/Cache Issues
```bash
rm -rf .next
bun run generate:types
bun dev
```
