import type { Payload } from 'payload'
import { DEFAULT_LOCALE } from '@athena/shared/constants'

import { TARGET_LANGUAGES, type TargetLocale, TranslationError, translateSegments } from './claude'
import { SegmentCollector, stripRowIds } from './segments'

export type Translatable = 'posts' | 'pages' | 'projects'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const clone = <T>(value: T): T => structuredClone(value)

/**
 * Build the localized part of a document (copied from English) and register
 * its strings. Everything returned is written to the target locale.
 */
function prepare(collection: Translatable, source: Record<string, unknown>) {
  const collector = new SegmentCollector()
  if (collection === 'projects') {
    // Plain-text fields only; the GitHub snapshot is not localized.
    const fields = { description: source.description, brief: source.brief, notes: source.notes }
    for (const name of Object.keys(fields)) collector.addField(fields, name)
    return { collector, data: fields as Record<string, unknown> }
  }
  const data: Record<string, unknown> = { title: source.title }
  collector.addField(data, 'title')

  const meta = isRecord(source.meta) ? source.meta : {}
  data.meta = { title: meta.title, description: meta.description }
  collector.addField(data.meta as Record<string, unknown>, 'title')
  collector.addField(data.meta as Record<string, unknown>, 'description')

  if (collection === 'posts') {
    data.content = clone(source.content)
    collector.addTree(data.content)
  } else {
    // hero: only richText and the link labels are localized; the rest of the
    // group (type, media, link targets) is shared and sent back unchanged.
    if (isRecord(source.hero)) {
      const hero = clone(source.hero)
      collector.addTree(hero.richText)
      collector.addTree(hero.links)
      data.hero = hero
    }
    // layout is localized as a whole: copy the English blocks as new rows.
    data.layout = stripRowIds(clone(source.layout ?? []))
    collector.addTree(data.layout)
  }
  return { collector, data }
}

export type TranslateResult = {
  seconds: number
  locales: Record<string, { segments: number; translated: number }>
}

/**
 * Translate the latest saved English version of a post or page into the
 * target locales and save each as a draft, so an editor can review it in the
 * admin (switch the locale) before publishing.
 */
export async function translateDocument({
  payload,
  collection,
  id,
  locales,
}: {
  payload: Payload
  collection: Translatable
  id: number | string
  locales: TargetLocale[]
}): Promise<TranslateResult> {
  const source = (await payload.findByID({
    collection,
    id,
    locale: DEFAULT_LOCALE,
    fallbackLocale: false,
    // Projects have no drafts: the translation is saved directly.
    draft: collection !== 'projects',
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>

  const started = Date.now()
  // Translate in parallel; save one locale at a time so each draft builds on
  // the previous one.
  const results = await Promise.all(
    locales.map(async (locale) => {
      const { collector, data } = prepare(collection, source)
      const translations = await translateSegments(collector.segments, locale)
      collector.apply(translations)
      return { locale, data, total: collector.segments.length, done: translations.size }
    }),
  )
  for (const { locale, data } of results) {
    await payload.update({
      collection,
      id,
      locale,
      data,
      draft: collection !== 'projects',
      overrideAccess: true,
    })
  }
  return {
    seconds: Math.round((Date.now() - started) / 1000),
    locales: Object.fromEntries(
      results.map((r) => [r.locale, { segments: r.total, translated: r.done }]),
    ),
  }
}

export const TRANSLATABLE: readonly Translatable[] = ['posts', 'pages', 'projects']
export const TARGET_LOCALES = Object.keys(TARGET_LANGUAGES) as TargetLocale[]
export { TranslationError }

/** Sidebar button that calls the endpoint above. Add to a collection's fields. */
export const translateUIField = {
  name: 'translate',
  type: 'ui',
  admin: {
    position: 'sidebar',
    components: { Field: '@/components/TranslateButton#TranslateButton' },
  },
} as const
