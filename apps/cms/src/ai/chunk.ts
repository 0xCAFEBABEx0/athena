import { createHash } from 'node:crypto'

import type { Section } from './lexical'

export type Chunk = {
  /** 0-based position in the post. */
  index: number
  heading: string | null
  /** The excerpt shown to readers and given to Claude. */
  content: string
  /** What is embedded: the excerpt with the post title and heading in front. */
  embedText: string
}

/**
 * Rough token count without a tokenizer: about four Latin characters per
 * token, about one token per CJK character. Only used to size chunks.
 */
export const approxTokens = (text: string): number => {
  let ascii = 0
  let other = 0
  for (const char of text) {
    if (char.charCodeAt(0) < 0x80) ascii += 1
    else other += 1
  }
  return Math.ceil(ascii / 4 + other)
}

/** Chunks aim for this size and never grow past MAX_TOKENS (unless one sentence is longer). */
const TARGET_TOKENS = 300
const MAX_TOKENS = 450

/** Split one long paragraph at sentence ends (Latin and CJK punctuation). */
const splitLong = (paragraph: string): string[] => {
  if (approxTokens(paragraph) <= MAX_TOKENS) return [paragraph]
  const sentences = paragraph.match(/[^.!?。！？\n]+(?:[.!?。！？]+|\n|$)/g) ?? [paragraph]
  const parts: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && approxTokens(current + sentence) > TARGET_TOKENS) {
      parts.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

export type ChunkInput = {
  title: string
  description?: string | null
  sections: Section[]
}

/**
 * Pack a post's paragraphs into excerpts of about TARGET_TOKENS, never across
 * a heading. The meta description, when there is one, opens the first chunk.
 */
export const buildChunks = ({ title, description, sections }: ChunkInput): Chunk[] => {
  const all: Section[] = description?.trim()
    ? [{ heading: null, paragraphs: [description.trim()] }, ...sections]
    : sections
  const chunks: Chunk[] = []

  const emit = (heading: string | null, paragraphs: string[]) => {
    const content = paragraphs.join('\n\n').trim()
    if (!content) return
    const embedText = [title, heading, content].filter(Boolean).join('\n\n')
    chunks.push({ index: chunks.length, heading, content, embedText })
  }

  for (const section of all) {
    let current: string[] = []
    let size = 0
    for (const paragraph of section.paragraphs.flatMap(splitLong)) {
      const tokens = approxTokens(paragraph)
      if (current.length && size + tokens > TARGET_TOKENS) {
        emit(section.heading, current)
        current = []
        size = 0
      }
      current.push(paragraph)
      size += tokens
    }
    emit(section.heading, current)
  }

  // A post with no body still gets found by its title.
  if (!chunks.length && title.trim()) emit(null, [title.trim()])
  return chunks
}

/** Changes when the embedded text or the embedding model changes. */
export const chunkHash = (embedText: string, model: string): string =>
  createHash('sha256').update(model).update('\0').update(embedText).digest('hex')
