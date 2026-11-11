declare namespace App {
  interface Locals {
    /** Content locale from the URL prefix (`/ja/…`, `/zh/…`); English otherwise. */
    locale: import('@athena/shared/constants').Locale
  }
}

/** Baked in at build time by astro.config.mjs (see src/lib/build-info.mjs). */
declare const __BUILD_INFO__: {
  version: string
  release: string
  commit: string
  env: string
  builtAt: string
  astro: string
}
