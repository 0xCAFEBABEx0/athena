---
description: Sentry configuration and verification for apps/cms
---

# Sentry Setup

> Sentry instruments the **`apps/cms`** app. See
> [`docs/SENTRY_SETUP.md`](../../docs/SENTRY_SETUP.md) for the full guide.

## ⚙️ Configuration (`apps/cms`)

- **Client**: `apps/cms/src/instrumentation-client.ts`
- **Server**: `apps/cms/sentry.server.config.ts`
- **Edge**: `apps/cms/sentry.edge.config.ts`

`withSentryConfig(...)` wraps the Next.js config only when `SENTRY_DSN` +
`SENTRY_ORG`/`SENTRY_PROJECT` are set. DSNs: `SENTRY_DSN` (server),
`NEXT_PUBLIC_SENTRY_DSN` (client).

## 🧪 Verifying

1. Set the DSN env vars in `apps/cms/.env`, then `bun run dev:cms`.
2. Trigger an error in the app (the legacy `/sentry-test` route was removed in the
   monorepo conversion).
3. Confirm the event appears in the Sentry dashboard for the matching environment
   (`development` / `preview` / `production`).

## 📝 Usage Examples

```typescript
// Capture an exception
try { /* ... */ } catch (error) { Sentry.captureException(error); }

// Performance span
Sentry.startSpan({ name: 'operation-name', op: 'category' }, (span) => { /* ... */ });

// Structured logging
Sentry.logger.info('Log message', { context: 'value' });
```
