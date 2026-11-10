import type { FieldHook } from 'payload'
import { DEFAULT_LOCALE } from '@athena/shared/constants'

export const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()

export const formatSlugHook =
  (fallback: string): FieldHook =>
  ({ data, operation, req, value }) => {
    if (typeof value === 'string') {
      return formatSlug(value)
    }

    // Slugs are shared by every locale. Only the English title may seed one,
    // so saving a Japanese or Chinese translation never renames the URL.
    if (req.locale && req.locale !== DEFAULT_LOCALE) {
      return value
    }

    if (operation === 'create' || !data?.slug) {
      const fallbackData = data?.[fallback] || data?.[fallback]

      if (fallbackData && typeof fallbackData === 'string') {
        return formatSlug(fallbackData)
      }
    }

    return value
  }
