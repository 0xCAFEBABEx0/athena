# Sentry Integration Setup

This project has been configured with Sentry for error tracking, performance monitoring, and logging.

## Configuration Files

- `src/instrumentation-client.ts` - Client-side Sentry configuration
- `sentry.server.config.ts` - Server-side Sentry configuration  
- `sentry.edge.config.ts` - Edge runtime Sentry configuration

## Test Implementation

### Test Component
Located at: `src/components/SentryTest/index.tsx`

This component includes the `myUndefinedFunction()` that you requested to test. It provides several test buttons:

1. **Test Error (myUndefinedFunction)** - Calls a function that intentionally throws a ReferenceError
2. **Test Span** - Creates a performance span for monitoring
3. **Test Log** - Sends structured log messages to Sentry
4. **Test API Error** - Tests server-side error tracking via API route

### Test Page
Access the test page at: `/sentry-test`

### API Test Route
Located at: `src/app/(payload)/api/sentry-test/route.ts`

- `GET` - Tests logging functionality
- `POST` - Tests error capture functionality

## Features Implemented

### Error Tracking
- Automatic error capture with `Sentry.captureException()`
- Client-side and server-side error tracking
- Structured error context

### Performance Monitoring
- Custom spans with `Sentry.startSpan()`
- Performance metrics and attributes
- Transaction tracking

### Logging
- Structured logging with `Sentry.logger`
- Console integration for automatic log capture
- Custom log levels and context

### Session Replay
- Automatic session recording
- Error-focused replay capture

## Usage Examples

### Capturing Exceptions
```typescript
try {
  // Your code that might throw
} catch (error) {
  Sentry.captureException(error);
}
```

### Creating Performance Spans
```typescript
Sentry.startSpan(
  {
    op: "ui.click",
    name: "Button Click",
  },
  (span) => {
    // Your code here
    span.setAttribute("custom.attribute", "value");
  },
);
```

### Structured Logging
```typescript
const { logger } = Sentry;
logger.info("User action", {
  userId: "123",
  action: "button_click",
  timestamp: new Date().toISOString(),
});
```

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `/sentry-test`
3. Click the test buttons to verify Sentry functionality
4. Check your Sentry dashboard for captured events

## DSN Configuration

The project is configured with the DSN from your `.cursorrules/rules.md`:
```
https://d945358f21d8cc73ed5efd69996a3050@o4509728862568448.ingest.us.sentry.io/4509728863813632
```

Make sure this DSN is correct for your Sentry project. 