/**
 * Pull the translatable strings out of a document and put translations back.
 *
 * Only text is sent to the model: Lexical text nodes (except inline code),
 * link labels, and the plain fields a caller names. Structure, URLs, code
 * blocks, uploads and relationships are copied as they are.
 */

export type Segment = {
  id: number
  /** Segments with the same group are runs of one paragraph or heading. */
  group: number
  text: string
}

type Slot = { holder: Record<string, unknown>; key: string }

const INLINE_CODE = 16 // Lexical text format bit for `code`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export class SegmentCollector {
  readonly segments: Segment[] = []
  private readonly slots: Slot[] = []
  private nextGroup = 0

  /** Register one plain string field (title, meta description, ...). */
  addField(holder: Record<string, unknown> | undefined, key: string): void {
    if (!holder) return
    const value = holder[key]
    if (typeof value === 'string' && value.trim()) this.add(holder, key, value, this.nextGroup++)
  }

  /**
   * Walk a subtree (rich text, blocks, link groups) and register every
   * translatable string in it.
   */
  addTree(value: unknown): void {
    this.walk(value, undefined)
  }

  /** Write translations (by segment id) back into the registered slots. */
  apply(translations: Map<number, string>): void {
    this.segments.forEach((segment, index) => {
      const translated = translations.get(segment.id)
      const slot = this.slots[index]
      if (slot && typeof translated === 'string' && translated.trim()) {
        slot.holder[slot.key] = translated
      }
    })
  }

  private add(holder: Record<string, unknown>, key: string, text: string, group: number) {
    this.segments.push({ id: this.segments.length, group, text })
    this.slots.push({ holder, key })
  }

  private walk(value: unknown, parentKey: string | undefined): void {
    if (Array.isArray(value)) {
      for (const item of value) this.walk(item, parentKey)
      return
    }
    if (!isRecord(value)) return

    // A Lexical element with inline children: one group per element.
    if (Array.isArray(value.children) && value.children.some((c) => isRecord(c) && c.type === 'text')) {
      const group = this.nextGroup++
      for (const child of value.children) {
        if (
          isRecord(child) &&
          child.type === 'text' &&
          typeof child.text === 'string' &&
          child.text.trim() &&
          !((typeof child.format === 'number' ? child.format : 0) & INLINE_CODE)
        ) {
          this.add(child, 'text', child.text, group)
        } else {
          this.walk(child, 'children')
        }
      }
      return
    }

    // Lexical code blocks keep their code.
    if (isRecord(value.fields) && value.fields.blockType === 'code') return

    for (const [key, child] of Object.entries(value)) {
      if (key === 'label' && parentKey === 'link' && typeof child === 'string' && child.trim()) {
        this.add(value, key, child, this.nextGroup++)
        continue
      }
      this.walk(child, key)
    }
  }
}

/**
 * Remove row ids outside rich text so a copied blocks/array value can be
 * saved as new rows for another locale.
 */
export function stripRowIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripRowIds(item)) as T
  if (!isRecord(value)) return value
  if (value.root && isRecord(value.root)) return value // Lexical state: leave as is
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id') continue
    out[key] = stripRowIds(child)
  }
  return out as T
}
