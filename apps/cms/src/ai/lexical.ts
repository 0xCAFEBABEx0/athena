/**
 * Plain text out of a Lexical rich text value, for the AI search index.
 *
 * Reads the stored JSON directly (no @payloadcms/richtext-lexical import), so
 * it does not depend on the editor package's internals, which change between
 * Payload majors. Unknown node types are walked for their text children, and
 * unknown blocks are skipped.
 */

import { approxTokens } from './chunk'

export type Section = {
  /** The heading this run of paragraphs sits under; null before the first heading. */
  heading: string | null
  paragraphs: string[]
}

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const childrenOf = (node: Node): Node[] =>
  Array.isArray(node.children) ? node.children.filter(isNode) : []

/** A code block longer than this is cut (an excerpt still finds the post). */
const MAX_CODE_CHARS = 1_500

const squash = (text: string): string =>
  text
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/** The text of an inline subtree (paragraph, heading, list item, link). */
const inlineText = (node: Node): string => {
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'tab') return ' '
  // A nested list inside a list item: its items on their own lines.
  if (node.type === 'list') return `\n${listItems(node).join('\n')}`
  return childrenOf(node).map(inlineText).join('')
}

const listItems = (list: Node): string[] =>
  childrenOf(list)
    .map((item) => squash(inlineText(item)))
    .filter(Boolean)
    .map((text) => `- ${text}`)

/** Lexical's TableCellHeaderStates.ROW bit: the cell heads its column. */
const ROW_HEADER = 1

/** A table is cut into parts of about this size, each with the header rows in front. */
const TABLE_PART_TOKENS = 300

/** One cell's text on one line ("|" escaped), its paragraphs joined by a space. */
const cellText = (cell: Node): string =>
  childrenOf(cell)
    .map((child) => squash(inlineText(child)).replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' ')
    .replaceAll('|', '\\|')

const isHeaderRow = (row: Node): boolean => {
  const cells = childrenOf(row)
  return (
    cells.length > 0 &&
    cells.every((cell) => typeof cell.headerState === 'number' && cell.headerState & ROW_HEADER)
  )
}

/**
 * A table as Markdown rows. The leading header rows (and a `| --- |` line)
 * open every part, so an excerpt cut from a long table still says what each
 * column means. Empty rows are left out.
 */
const tableParts = (table: Node): string[] => {
  const rows = childrenOf(table).filter((row) => row.type === 'tablerow')
  const line = (row: Node) => {
    const cells = childrenOf(row).map(cellText)
    return cells.some(Boolean) ? `| ${cells.join(' | ')} |` : ''
  }
  let headerCount = 0
  while (headerCount < rows.length && isHeaderRow(rows[headerCount] as Node)) headerCount += 1
  const header = rows.slice(0, headerCount).map(line).filter(Boolean)
  const width = Math.max(1, ...rows.map((row) => childrenOf(row).length))
  if (header.length) header.push(`|${' --- |'.repeat(width)}`)
  const body = rows.slice(headerCount).map(line).filter(Boolean)
  if (!body.length) return header.length ? [header.slice(0, -1).join('\n')] : []

  const headerTokens = approxTokens(header.join('\n'))
  const parts: string[] = []
  let current: string[] = []
  let size = headerTokens
  for (const row of body) {
    const tokens = approxTokens(row)
    if (current.length && size + tokens > TABLE_PART_TOKENS) {
      parts.push([...header, ...current].join('\n'))
      current = []
      size = headerTokens
    }
    current.push(row)
    size += tokens
  }
  parts.push([...header, ...current].join('\n'))
  return parts
}

/** The root's top-level nodes, wherever the value keeps them. */
const topLevel = (value: unknown): Node[] => {
  if (!isNode(value)) return []
  const root = isNode(value.root) ? value.root : value
  return childrenOf(root)
}

/** Split rich text into sections at each heading. */
export const lexicalToSections = (value: unknown): Section[] => {
  const sections: Section[] = []
  let current: Section = { heading: null, paragraphs: [] }

  const push = (text: string) => {
    const clean = squash(text)
    if (clean) current.paragraphs.push(clean)
  }

  const visit = (node: Node) => {
    switch (node.type) {
      case 'heading': {
        const heading = squash(inlineText(node))
        if (!heading) return
        if (current.heading !== null || current.paragraphs.length) sections.push(current)
        current = { heading, paragraphs: [] }
        return
      }
      case 'list':
        push(listItems(node).join('\n'))
        return
      case 'table':
        // Pushed as they are: squash would merge the rows' line breaks.
        for (const part of tableParts(node)) current.paragraphs.push(part)
        return
      case 'horizontalrule':
      case 'upload':
      case 'relationship':
        return
      case 'block': {
        const fields = isNode(node.fields) ? node.fields : {}
        if (fields.blockType === 'code' && typeof fields.code === 'string') {
          const code = fields.code.trim().slice(0, MAX_CODE_CHARS)
          const language = typeof fields.language === 'string' ? fields.language : ''
          if (code) current.paragraphs.push(`\`\`\`${language}\n${code}\n\`\`\``)
          return
        }
        // Blocks that hold rich text of their own (Banner): read it in place.
        for (const field of Object.values(fields)) {
          for (const child of topLevel(field)) visit(child)
        }
        return
      }
      default:
        push(inlineText(node))
    }
  }

  for (const node of topLevel(value)) visit(node)
  if (current.heading !== null || current.paragraphs.length) sections.push(current)
  return sections
}
