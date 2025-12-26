# Upgrade Payload CMS and Next.js to latest stable versions

## Description
This issue tracks the upgrade of core dependencies to their latest stable versions to improve stability, security, and satisfy peer dependency requirements.

### Changes
- **Payload CMS**: Upgraded from `3.53.0` to `3.69.0` (all `@payloadcms/*` packages).
- **Next.js**: Upgraded from `15.2.6` to `15.4.10` to satisfy Payload CMS v3.69.0 peer dependency requirements.
- **Bun**: Upgraded from `1.2.19` to `1.3.5`.
- **React**: Upgraded from `19.1.4` to `19.2.3` (security fixes).
- **daisyUI**: Added `v4` for UI component styling.
- **Other libraries**:
  - `eslint` (^9.39.2), `prettier` (^3.7.4), `typescript` (^5.9.3)
  - `lucide-react` (^0.562.0), `react-hook-form` (^7.69.0), `sharp` (^0.34.5)
  - `Sentry`: Upgraded configuration for v10 compatibility (`disableLogger` -> `treeshake`).

### Verification
- [x] Full build performed successfully (`bun run build`).
- [x] Dev server starts and operates correctly.
- [x] Static site generation (SSG) for posts and pages verified.
- [x] Sitemap generation verified.

## Rationale
Payload CMS v3.69.0 includes several bug fixes and performance improvements. Updating Next.js to v15.4.10 was necessary to ensure compatibility with the updated Payload packages.
