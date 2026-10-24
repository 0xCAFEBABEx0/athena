# Athena Documentation

Project documentation, kept in the repository so it is reviewed and versioned
with the code. All documents describe the code on `main`; update them in the
same change that alters the behaviour they describe.

## Start here

| Document | Read it to learn |
|---|---|
| [Architecture](./ARCHITECTURE.md) | The system's parts, how they communicate (rendering, caching, preview, forms), security model and the bridge period. |
| [Functional Specification](./SPECIFICATION.md) | What the site and the admin do today, non-functional requirements, environments and known gaps. |
| [Content Model](./CONTENT_MODEL.md) | Collections, globals, blocks, fields, access rules and hooks. |
| [API Reference](./API.md) | Web endpoints, the CMS REST calls the web app makes, shared constants and environment variables. |
| [Database](./DATABASE.md) | PostgreSQL/Neon setup, how schema changes reach production, seeding and scripts. |
| [Decision Records](./adr/) | Why the architecture looks the way it does. |

## Working on the project

| Document | Read it to learn |
|---|---|
| [Development Guide](./DEVELOPMENT.md) | Local setup, commands and project structure. |
| [Development Workflow](./DEVELOPMENT_WORKFLOW.md) | Branch strategy and the promotion flow. |
| [Deployment Guide](./DEPLOYMENT.md) | The two Vercel projects, environment variables and release steps. |
| [CI/CD Pipeline](./CI_CD.md) | GitHub Actions and Vercel triggers. |
| [Sentry Setup](./SENTRY_SETUP.md) | Error tracking configuration. |
| [Upgrade Notes](./UPGRADE_NOTES.md) | Dependency upgrades, including the SQL each one needed. |
| [Security Vulnerabilities](./SECURITY_VULNERABILITIES.md) | Historical CVE audit (January 2025). |

Agent-specific guidance (Claude Code, Cursor and others) lives in
[`AGENTS.md`](../AGENTS.md) at the repository root.

## Conventions

- Write in English, in Markdown. Diagrams use Mermaid so GitHub renders them.
- Point to code by repository path (`apps/web/src/lib/cms.ts`) rather than
  copying large excerpts that drift.
- Record a significant design decision as a new ADR in `adr/`.
