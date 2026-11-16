/**
 * Plain text out of a Lexical rich text value, for the AI search index.
 *
 * Reads the stored JSON directly (no @payloadcms/richtext-lexical import), so
 * it does not depend on the editor package's internals, which change between
 * Payload majors. Unknown node types are walked for their text children, and
 * unknown blocks are skipped.
 */

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
