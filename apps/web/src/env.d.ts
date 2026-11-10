declare namespace App {
  interface Locals {
    /** Content locale from the URL prefix (`/ja/…`, `/zh/…`); English otherwise. */
    locale: import('@athena/shared/constants').Locale
  }
}
