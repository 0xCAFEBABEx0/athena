# Payload Website Template

<!-- Vercel Deploy Test - Updated at 2025-07-26 -->

This is a [Payload](https://github.com/payloadcms/payload) website template perfect for a personal site, blog, or any content-driven website.

## Features

- **Payload CMS** - Headless CMS with admin panel
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Bun** - Fast package manager and runtime (17x faster than pnpm)
- **Tailwind CSS** - Utility-first CSS framework
- **Sentry Integration** - Error tracking and performance monitoring
- **Vercel Analytics & Speed Insights** - Performance monitoring
- **Form Builder** - Dynamic form creation
- **SEO Plugin** - Built-in SEO management
- **Search Plugin** - Full-text search capabilities
- **Redirects Plugin** - URL redirection management
- **Nested Docs** - Hierarchical content structure

## Development Flow

This project follows a **Development → Preview → Production** workflow using Vercel:

### 1. **Development (Local)**
```bash
# Clone and setup
git clone https://github.com/w9be1tip0v/zeus.git
cd zeus
bun install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your local configuration

# Start development server
bun dev
```

**Access**: [http://localhost:3000](http://localhost:3000)

### 2. **Preview (Staging)**
```bash
# Create and push to preview branch
git checkout -b preview
git push -u origin preview
```

**Access**: Vercel automatically creates a preview URL for each push to the `preview` branch

### 3. **Production**
```bash
# Merge preview branch to main
git checkout main
git merge preview
git push origin main
```

**Access**: Production URL (configured in Vercel)

## Environment Configuration

### Environment Variables
- **Development**: Uses `.env.local`
- **Preview**: Uses Vercel environment variables (staging)
- **Production**: Uses Vercel environment variables (production)

### Sentry Integration
- **Development**: `development` environment
- **Preview**: `staging` environment  
- **Production**: `production` environment

### Database
- **Development**: Local or development database
- **Preview**: Production database (read-only recommended)
- **Production**: Production database

## Deployment

This project is configured for deployment on Vercel with automatic deployments triggered by Git pushes.

- See docs: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md), [docs/SENTRY_SETUP.md](./docs/SENTRY_SETUP.md)

## Sentry Integration

This project includes comprehensive Sentry integration for error tracking, performance monitoring, and logging.

### Test Sentry Features

Visit `/sentry-test` to test Sentry functionality:
- Error tracking with `myUndefinedFunction()`
- Performance monitoring with custom spans
- Structured logging
- API error tracking

### Test Vercel Analytics & Speed Insights

Visit `/vercel-insights-test` to test analytics functionality:
- Check if Analytics and Speed Insights are loaded
- Test custom event tracking
- Debug environment configuration
- View troubleshooting tips

## Development

### Available Scripts

- `bun dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint
- `bun run generate:types` - Generate TypeScript types
- `bun run generate:importmap` - Generate import map for admin

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (frontend)/        # Public-facing pages
│   └── (payload)/         # Payload CMS admin
├── blocks/                # Content blocks
├── collections/           # Payload CMS collections
├── components/            # React components
├── fields/                # Custom form fields
├── heros/                 # Hero section components
├── plugins/               # Payload CMS plugins
├── providers/             # React context providers
└── utilities/             # Utility functions
```

## License

MIT

---

**Deployment Trigger**: This commit triggers a new Vercel deployment.
