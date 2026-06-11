# Sentry Integration Setup

Sentry provides error tracking, performance monitoring, and logging for the
**`apps/cms`** app (Payload CMS + Next.js 16). The Astro frontend (`apps/web`)
uses Sentry separately only if configured there.

## Configuration Files (`apps/cms`)

- `apps/cms/src/instrumentation-client.ts` — client-side Sentry config
- `apps/cms/sentry.server.config.ts` — server-side config
- `apps/cms/sentry.edge.config.ts` — edge runtime config

`@sentry/nextjs` wraps the Next.js config via `withSentryConfig(...)` in
`apps/cms/config/next.config.mjs`, and **only when** `SENTRY_DSN` plus
`SENTRY_ORG`/`SENTRY_PROJECT` are set — otherwise it is skipped (see
[AGENTS.md → Build Configuration](../AGENTS.md#build-configuration-appscmsconfignextconfigmjs)).

## DSN & Environment Variables

Set these in `apps/cms/.env` (locally) and in the **athena-cms** Vercel project
per environment:

```bash
SENTRY_DSN=                 # server-side DSN
NEXT_PUBLIC_SENTRY_DSN=     # client-side DSN
SENTRY_ORG=                 # required for source-map upload at build time
SENTRY_PROJECT=             # required for source-map upload at build time
SENTRY_AUTH_TOKEN=          # build-time auth token for releases/source maps
```

> The deploy stage maps to a Sentry environment: `development` / `preview`
> (staging) / `production`. Athena resolves the stage from `DEPLOY_ENV`
> (falling back to `VERCEL_ENV`).

## Features

- **Error tracking** — automatic capture via `Sentry.captureException()`, client
  and server.
- **Performance monitoring** — custom spans via `Sentry.startSpan()`.
- **Logging** — structured logs via `Sentry.logger`.
- **Session replay** — error-focused replay capture (client).

## Usage Examples

### Capturing exceptions

```typescript
try {
  // code that might throw
} catch (error) {
  Sentry.captureException(error);
}
```

### Performance spans

```typescript
Sentry.startSpan({ op: "ui.click", name: "Button Click" }, (span) => {
  span.setAttribute("custom.attribute", "value");
  // ...
});
```

### Structured logging

```typescript
const { logger } = Sentry;
logger.info("User action", { userId: "123", action: "button_click" });
```

## Verifying It Works

1. Set the DSN env vars and start the CMS: `bun run dev:cms`.
2. Trigger an error in the app (or temporarily add a `Sentry.captureException`
   call) and confirm the event lands in the Sentry dashboard for the matching
   environment.

> The legacy single-app `/sentry-test` page and `SentryTest` component were
> removed in the monorepo conversion — there is no built-in test route anymore.
