# 0001. Serve the public site from a separate Astro app

- **Status**: Accepted
- **Area**: `apps/web`, `apps/cms/src/app/(frontend)`

## Context

The project started from the Payload Website Template, where the public site
is a Next.js route group inside the CMS app. That couples the public site's
deploys, dependencies and failure modes to the admin panel, ships React to
every visitor, and makes the CMS bundle carry styling and components it does
not need.

## Decision

Build the public site as a separate Astro app (`apps/web`) that reads the CMS
only through its REST API. Port each block and hero to an `.astro` component
and render Lexical rich text to HTML on the server with
`convertLexicalToHTML`. Keep the legacy Next frontend in the CMS during a
bridge period so the switch could happen without downtime.

## Consequences

- The public site ships almost no JavaScript (only the theme script and the
  form submit script).
- Every block exists twice (Next component and Astro port) until the legacy
  frontend is removed. New blocks must be added to the Astro app and, while it
  exists, the legacy frontend.
- The apps communicate over HTTP, so they need shared secrets
  (`PREVIEW_SECRET`, `REVALIDATE_SECRET`) and a CORS/CSRF allow-list for form
  posts.
- Types are shared through `packages/shared` rather than imports from the CMS
  app.
