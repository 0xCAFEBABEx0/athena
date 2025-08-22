# Development Guide

## 🚀 Getting Started

### Start Development Server
```bash
bun dev
```

The development server will be available at:
- **Frontend**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **GraphQL Playground**: http://localhost:3000/api/graphql-playground

## 🛠️ Development Environment

### Current Environment Status
```bash
# Check current environment
bun run env:check

# Expected output in development:
# Environment: development
# Vercel Env: local
```

### Available Features
- ✅ **Hot Reload**: Automatic page refresh on file changes
- ✅ **TypeScript**: Full type checking and IntelliSense
- ✅ **ESLint**: Code quality checks
- ✅ **Sentry Integration**: Error tracking and performance monitoring
- ✅ **Environment Indicator**: Visual indicator showing current environment
- ✅ **PayloadCMS Admin**: Content management interface

## 🎯 Key Development URLs

### Frontend Pages
- **Homepage**: http://localhost:3000
- **Posts**: http://localhost:3000/posts
- **Search**: http://localhost:3000/search
- **Sentry Test**: http://localhost:3000/sentry-test

### Admin & API
- **Admin Dashboard**: http://localhost:3000/admin
- **GraphQL API**: http://localhost:3000/api/graphql
- **GraphQL Playground**: http://localhost:3000/api/graphql-playground
- **API Documentation**: http://localhost:3000/api

### Testing Endpoints
- **Sentry Error Test**: http://localhost:3000/sentry-test
- **API Health Check**: http://localhost:3000/api/sentry-test

## 🔧 Development Commands

### Essential Commands
```bash
# Start development server
bun dev

# Build for production
bun run build

# Type checking
bun run generate:types

# Linting
bun run lint
bun run lint:fix

# Environment check
bun run env:check
```

### PayloadCMS Commands
```bash
# Generate types
bun run generate:types

# Generate import map for admin UI
bun run generate:importmap

# Run migrations
bun payload migrate

# Seed database
curl http://localhost:3000/next/seed
```

## 🧪 Testing & Debugging

### Sentry Integration Testing
1. Visit http://localhost:3000/sentry-test
2. Test different error scenarios:
   - **Client Error**: Click "Test Error" button
   - **Performance**: Click "Test Span" button
   - **Logging**: Click "Test Log" button
   - **API Error**: Click "Test API Error" button

### Environment Indicator
- Look for the environment badge in the top-right corner
- **Green**: Development environment
- **Yellow**: Preview environment
- **Red**: Production environment

### Database & Content
```bash
# Access admin panel
# http://localhost:3000/admin

# Default admin user (if seeded):
# Email: demo@payloadcms.com
# Password: demo
```

## 📁 Project Structure

### Key Directories
```
src/
├── app/                    # Next.js App Router
│   ├── (frontend)/        # Public-facing pages
│   └── (payload)/         # Admin & API routes
├── blocks/                # Reusable content blocks
├── collections/           # PayloadCMS collections
├── components/            # React components
├── utilities/             # Helper functions
└── providers/             # React context providers
```

### Environment Files
```
.env.local                 # Local environment variables
env.example               # Template for environment variables
src/utilities/env.ts      # Environment configuration utility
```

## 🎨 Styling & UI

### Technologies
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Headless UI components
- **Geist Font**: Modern typography
- **Lucide React**: Icon library

### Component Development
```bash
# Components are located in:
src/components/           # Shared components
src/blocks/              # Content blocks
src/app/(frontend)/      # Page-specific components
```

## 🔄 Hot Reload & File Watching

### Automatic Reload Triggers
- **React Components**: Instant hot reload
- **API Routes**: Server restart
- **PayloadCMS Config**: Server restart required
- **Environment Variables**: Server restart required

### Manual Restart Cases
```bash
# When to restart the dev server:
# 1. PayloadCMS configuration changes
# 2. Environment variable changes
# 3. Package.json modifications
# 4. Build configuration changes

# Restart command:
# Stop: Ctrl+C
# Start: bun dev
```

## 🐛 Common Development Issues

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
bun dev -- -p 3001
```

### TypeScript Errors
```bash
# Regenerate types
bun run generate:types

# Clear Next.js cache
rm -rf .next
bun dev
```

### Database Connection Issues
```bash
# Check environment variables
cat .env.local

# Test database connection
bun payload migrate:status
```

### PayloadCMS Admin Issues
```bash
# Regenerate admin import map
bun run generate:importmap

# Clear admin cache
rm -rf .next
bun dev
```

## 🚀 Performance Tips

### Development Optimization
1. **Use TypeScript**: Better IntelliSense and error catching
2. **Enable ESLint**: Catch issues early
3. **Monitor Bundle Size**: Use Next.js analyzer
4. **Profile Components**: Use React DevTools
5. **Check Sentry**: Monitor performance metrics

### Fast Refresh
- Keep components pure for better hot reload
- Avoid side effects in component bodies
- Use proper dependency arrays in hooks

## 📝 Best Practices

### Code Organization
- Use TypeScript for all new files
- Follow the established folder structure
- Create reusable components in `src/components/`
- Use PayloadCMS blocks for content areas

### Environment Management
- Never commit `.env.local` files
- Use the `env.example` template
- Check environment with `bun run env:check`
- Test in preview environment before production

### Git Workflow
```bash
# Create feature branch from development
git checkout development
git checkout -b feature/your-feature-name

# Regular commits
git add .
git commit -m "Descriptive commit message"

# Merge back to development
git checkout development
git merge feature/your-feature-name
git push origin development

# Deploy to preview for testing
bun run deploy:preview
```

## 🆘 Getting Help

### Debugging Resources
1. **Next.js Docs**: https://nextjs.org/docs
2. **PayloadCMS Docs**: https://payloadcms.com/docs
3. **Sentry Docs**: https://docs.sentry.io
4. **Tailwind Docs**: https://tailwindcss.com/docs

### Local Development Support
- Check console logs in browser DevTools
- Monitor terminal output for server logs
- Use Sentry dashboard for error tracking
- Review ESLint output for code quality

---

Happy coding! 🎉 