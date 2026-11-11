import Anthropic from '@anthropic-ai/sdk'

import type { Segment } from './segments'

export const TARGET_LANGUAGES = {
  ja: 'Japanese',
  zh: 'Simplified Chinese',
} as const

export type TargetLocale = keyof typeof TARGET_LANGUAGES

/** Override with TRANSLATION_MODEL on the CMS deployment. */
const DEFAULT_MODEL = 'claude-opus-5-5'

/** Keep each request small enough to finish well inside the function timeout. */
const MAX_CHARS_PER_REQUEST = 12_000

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['id', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['translations'],
  additionalProperties: false,
} as const

const systemPrompt = (language: string) =>
  `You translate a personal software engineering blog from English into natural, fluent ${language}.

You receive JSON segments. Each segment is a run of text from the blog; segments that share a "group" are consecutive runs of the same paragraph or heading (for example plain text, then a bold or linked phrase, then plain text again). Translate each group as one sentence or paragraph, then split the translation back into the same segments so each segment still covers the matching words (the bold phrase stays the bold phrase).

Rules:
- Return exactly one translation for every segment id you receive, in "translations".
- Keep product names, library names, commands, file names, code identifiers, URLs and numbers as written.
- Keep a segment's leading or trailing space only where ${language} needs a space there.
- Write the way a working engineer writes for other engineers: plain, direct, no added explanations.
- Translate only. Do not add, drop or summarize content.`

/** Split segments into requests without breaking a group across two requests. */
function chunk(segments: Segment[]): Segment[][] {
  const chunks: Segment[][] = []
  let current: Segment[] = []
  let size = 0
  let previousGroup: number | undefined
  for (const segment of segments) {
    const startsGroup = segment.group !== previousGroup
    previousGroup = segment.group
    if (startsGroup && size + segment.text.length > MAX_CHARS_PER_REQUEST && current.length) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(segment)
    size += segment.text.length
  }
  if (current.length) chunks.push(current)
  return chunks
}

export class TranslationError extends Error {}

async function translateChunk(
  client: Anthropic,
  segments: Segment[],
  locale: TargetLocale,
): Promise<Map<number, string>> {
  const stream = client.beta.messages.stream({
    model: process.env.TRANSLATION_MODEL || DEFAULT_MODEL,
    max_tokens: 64_000,
    // Translation is not a reasoning-heavy task; low effort keeps it fast.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    // If the model declines on a policy check, let the API retry on its
    // default fallback model instead of failing the whole translation.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: systemPrompt(TARGET_LANGUAGES[locale]),
    messages: [{ role: 'user', content: JSON.stringify({ segments }) }],
  })
  const message = await stream.finalMessage()

  if (message.stop_reason === 'refusal') {
    throw new TranslationError(`The model declined to translate this text into ${locale}.`)
  }
  if (message.stop_reason === 'max_tokens') {
    throw new TranslationError(`The ${locale} translation was cut off. Try a shorter document.`)
  }

  const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new TranslationError(`The ${locale} translation was not valid JSON.`)
  }
  const items =
    typeof parsed === 'object' && parsed !== null && 'translations' in parsed
      ? (parsed as { translations: unknown }).translations
      : undefined
  const result = new Map<number, string>()
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item && typeof item.id === 'number' && typeof item.text === 'string') {
        result.set(item.id, item.text)
      }
    }
  }
  return result
}

/** Translate segments into one locale. Missing ids keep their English text. */
export async function translateSegments(
  segments: Segment[],
  locale: TargetLocale,
  client = new Anthropic(),
): Promise<Map<number, string>> {
  const merged = new Map<number, string>()
  for (const part of chunk(segments)) {
    for (const [id, text] of await translateChunk(client, part, locale)) merged.set(id, text)
  }
  return merged
}
