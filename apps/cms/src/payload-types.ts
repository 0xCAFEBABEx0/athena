/**
 * Re-export of the generated Payload types, which live in the shared
 * workspace package (packages/shared/src/payload-types.ts) so that the
 * web frontend can consume them too.
 *
 * Regenerate with `bun run generate:types` — payload.config.ts points the
 * generator at the shared package; this file never changes.
 */
export * from '@athena/shared/payload-types'
