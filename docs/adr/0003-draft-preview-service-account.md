# 0003. Draft preview through a cookie and a service-account API key

- **Status**: Accepted
- **Area**: `apps/web/src/pages/api/preview.ts`, `apps/web/src/lib/draft.ts`,
  `apps/web/src/lib/cms.ts`, `apps/cms/src/collections/Users`

## Context

Editors need to see unpublished drafts on the public site. Payload serves
drafts only to authenticated users, and the editor's admin session cookie
belongs to the CMS origin, so the web app cannot reuse it.

## Decision

- The admin Preview button links to `${WEB_URL}/api/preview` with a shared
  `PREVIEW_SECRET`. A valid request sets an HttpOnly `athena-draft` cookie and
  redirects to the page.
- When the cookie is present, server-side fetches add `draft=true` and
  authenticate as a dedicated `web-frontend` user with an API key
  (`users` has `useAPIKey: true`). The key lives only in the web project's
  server environment.

## Consequences

- Anyone holding the preview link can enable draft mode in their browser until
  they exit preview. The secret should be rotated if a link leaks.
- The service account is a full user because there are no roles yet. Adding
  roles should give it read-only access.
- Rotating the key means running `create-web-service-account.ts` and updating
  `PAYLOAD_API_KEY` on athena-web.
