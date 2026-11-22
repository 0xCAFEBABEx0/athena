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

/** A cell's span (colSpan / rowSpan): a whole number from 2, else 1; capped so a bad value cannot blow up the grid. */
const spanOf = (value: unknown, max: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 1 ? Math.min(value, max) : 1

/** The widest a merged cell may be (the web renderer caps spans at 1000; 100 columns is already unreadable). */
const MAX_COL_SPAN = 100

/**
 * The rows as a grid of cell texts. A merged cell's text fills every
 * position it covers, so each value stays under its own column header and
 * beside its row label (a cell spanning two rows shows on both).
 */
const tableGrid = (rows: Node[]): string[][] => {
  const grid: string[][] = rows.map(() => [])
  rows.forEach((row, r) => {
    const line = grid[r] as string[]
    let column = 0
    for (const cell of childrenOf(row)) {
      while (line[column] !== undefined) column += 1
      const text = cellText(cell)
      const colSpan = spanOf(cell.colSpan, MAX_COL_SPAN)
      const rowSpan = spanOf(cell.rowSpan, rows.length - r)
      for (let dr = 0; dr < rowSpan; dr += 1) {
        const target = grid[r + dr] as string[]
        for (let dc = 0; dc < colSpan; dc += 1) target[column + dc] = text
      }
      column += colSpan
    }
  })
  const width = Math.max(1, ...grid.map((line) => line.length))
  return grid.map((line) => Array.from({ length: width }, (_, i) => line[i] ?? ''))
}

const rowLine = (cells: string[]): string => (cells.some(Boolean) ? `| ${cells.join(' | ')} |` : '')

/** Cut text into pieces of at most `budget` tokens: at sentence ends, then at spaces, then anywhere (CJK). */
const pieces = (text: string, budget: number): string[] => {
  const cut = (unit: string): string[] => {
    if (approxTokens(unit) <= budget) return [unit]
    const words = unit.split(/(?<=\s)/)
    if (words.length > 1) return words.flatMap(cut)
    const out: string[] = []
    let current = ''
    for (const char of unit) {
      if (current && approxTokens(current + char) > budget) {
        out.push(current)
        current = ''
      }
      current += char
    }
    return current ? [...out, current] : out
  }
  const units = (text.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g) ?? [text]).flatMap(cut)
  const out: string[] = []
  let current = ''
  for (const unit of units) {
    if (current && approxTokens(current + unit) > budget) {
      out.push(current.trim())
      current = ''
    }
    current += unit
  }
  if (current.trim()) out.push(current.trim())
  return out
}

/** A cell longer than this is "long": an oversized row keeps its short cells together and splits the long ones. */
const SHORT_CELL_TOKENS = 40

/**
 * A row too long for one part, as several lines of at most `budget` tokens:
 * first its short cells, then each long cell's pieces, each under its own
 * column and beside the row label (the first cell, cut short if long).
 */
const splitRow = (cells: string[], budget: number): string[] => {
  const isLong = (text: string) => approxTokens(text) > SHORT_CELL_TOKENS
  const first = cells[0] ?? ''
  const label = isLong(first) ? `${pieces(first, SHORT_CELL_TOKENS - 1)[0] ?? ''}…` : first
  const lines = [rowLine(cells.map((text) => (isLong(text) ? '' : text)))]
  const rest = Math.max(SHORT_CELL_TOKENS, budget - approxTokens(label) - 2 * cells.length)
  cells.forEach((text, column) => {
    if (!isLong(text)) return
    for (const piece of pieces(text, column === 0 ? budget - 2 * cells.length : rest)) {
      lines.push(rowLine(cells.map((_, i) => (i === column ? piece : i === 0 ? label : ''))))
    }
  })
  return lines.filter(Boolean)
}

/**
 * A table as Markdown rows. The leading header rows (and a `| --- |` line)
 * open every part, so an excerpt cut from a long table still says what each
 * column means; a row too long for one part is split by cell (`splitRow`), so
 * no part needs the sentence splitter, which would drop the table context.
 * Merged cells are repeated in every position they cover. Empty rows are left out.
 */
const tableParts = (table: Node): string[] => {
  const rows = childrenOf(table).filter((row) => row.type === 'tablerow')
  const grid = tableGrid(rows)
  let headerCount = 0
  while (headerCount < rows.length && isHeaderRow(rows[headerCount] as Node)) headerCount += 1
  const header = grid.slice(0, headerCount).map(rowLine).filter(Boolean)
  const width = grid[0]?.length ?? 1
  if (header.length) header.push(`|${' --- |'.repeat(width)}`)
  const headerTokens = approxTokens(header.join('\n'))
  const budget = Math.max(2 * SHORT_CELL_TOKENS, TABLE_PART_TOKENS - headerTokens - 1)
  const body = grid.slice(headerCount).flatMap((cells) => {
    const line = rowLine(cells)
    if (!line) return []
    return approxTokens(line) > budget ? splitRow(cells, budget) : [line]
  })
  if (!body.length) return header.length ? [header.slice(0, -1).join('\n')] : []

  const parts: string[] = []
  let current: string[] = []
  let size = headerTokens
  for (const row of body) {
    const tokens = approxTokens(row) + 1
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
