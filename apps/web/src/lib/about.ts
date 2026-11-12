import type { About, Media } from '@athena/shared/payload-types'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type { Locale } from '@athena/shared/constants'

import { getGlobal } from './cms'

/**
 * /about: Master's profile from the CMS `about` global. The page exists only
 * while the lead or the story has text.
 */
export type AboutData = {
  /** Page heading; empty = the built-in "About". */
  heading: string
  lead: string
  /** Portrait in Media (populated), or null. */
  portrait: Media | null
  portraitCaption: string
  /** The story as Lexical rich text, or null when it is empty. */
  body: SerializedEditorState | null
}

type Node = { type?: string; text?: string; children?: Node[] }

/** True when the rich text holds any visible text (an empty editor still has one empty paragraph). */
export const hasText = (node: Node | null | undefined): boolean =>
  Boolean(
    node &&
      ((typeof node.text === 'string' && node.text.trim() !== '') ||
        node.type === 'horizontalrule' ||
        (node.children ?? []).some(hasText)),
  )

/** Exported for tests. */
export const normalizeAbout = (about: Partial<About> | null | undefined): AboutData => {
  const body = about?.body as unknown as SerializedEditorState | null | undefined
  const portrait = about?.portrait
  return {
    heading: about?.heading?.trim() ?? '',
    lead: about?.lead?.trim() ?? '',
    portrait: portrait && typeof portrait === 'object' && portrait.url ? portrait : null,
    portraitCaption: about?.portraitCaption?.trim() ?? '',
    body: body && hasText(body.root as unknown as Node) ? body : null,
  }
}

/** Whether /about has anything to show (otherwise it is a 404 and left out of the sitemap). */
export const aboutHasContent = (about: AboutData): boolean =>
  about.lead !== '' || about.body !== null

/**
 * The About global; throws when the CMS cannot answer, so `/about` shows the
 * 500 page (never cached) instead of a 404 the CDN would keep for a day.
 */
export const loadAbout = async (locale: Locale): Promise<AboutData> =>
  normalizeAbout(await getGlobal<About>('about', { locale }))

/** The About global, or null when the CMS cannot answer (the sitemap then leaves `/about` out). */
export const getAbout = async (locale: Locale): Promise<AboutData | null> => {
  try {
    return await loadAbout(locale)
  } catch (error) {
    console.error('[about] failed to load the about page', error)
    return null
  }
}
