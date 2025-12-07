# Project Rules

## 🏗️ Project Structure

- **Backend**: Payload CMS + PostgreSQL
- **Frontend**: Next.js App Router
- **Database**: PostgreSQL (Neon cloud)
- **Styling**: Tailwind CSS
- **Package Manager**: Bun

## 📝 Code Style

- **Language**: TypeScript for all new code.
- **Linting**: Follow ESLint and Prettier configurations.
- **Naming**:
    - Components: `PascalCase` (e.g., `UserProfile.tsx`)
    - Utilities: `camelCase` (e.g., `formatDate.ts`)
    - Constants: `UPPER_SNAKE_CASE` (e.g., `API_ENDPOINTS.ts`)
    - Types: `PascalCase` (e.g., `UserTypes.ts`)

## ⚛️ Component Guidelines

- Use functional components with hooks.
- Implement proper TypeScript interfaces.
- Use Tailwind CSS for styling.

## 🗄️ Database

- Use Prisma schema for modeling.
- Run migrations for schema changes.

## 🧪 Testing

- Unit tests for utilities.
- Integration tests for API endpoints.
- Playwright for E2E testing.

## 🔒 Security

- Validate all user inputs.
- Use environment variables for sensitive data.
