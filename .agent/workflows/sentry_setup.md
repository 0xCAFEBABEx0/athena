---
description: Sentry setup, configuration, and testing workflow
---

# Sentry Setup & Testing

## ⚙️ Configuration

- **Client**: `src/instrumentation-client.ts`
- **Server**: `sentry.server.config.ts`
- **Edge**: `sentry.edge.config.ts`

## 🧪 Testing Sentry

### 1. Access Test Page
Navigate to: http://localhost:3000/sentry-test

### 2. Test Scenarios
- **Test Error**: Triggers a client-side exception.
- **Test Span**: Creates a performance span.
- **Test Log**: Sends a structured log.
- **Test API Error**: Triggers a server-side API error.

### 3. Verify in Sentry
Check the Sentry dashboard to confirm that errors, spans, and logs are being captured correctly.

## 📝 Usage Examples

### Capture Exception
```typescript
try {
  // ...
} catch (error) {
  Sentry.captureException(error);
}
```

### Start Span
```typescript
Sentry.startSpan({ name: 'operation-name', op: 'category' }, (span) => {
  // ...
});
```

### Structured Logging
```typescript
Sentry.logger.info('Log message', { context: 'value' });
```
