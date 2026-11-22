import { ROUTES } from '@athena/shared/constants'
import type {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedLinkNode,
  SerializedTableCellNode,
  SerializedTableNode,
  SerializedTableRowNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from '@payloadcms/richtext-lexical/html'

import type { BannerBlock, CallToActionBlock, MediaBlock } from '@athena/shared/payload-types'

import { imgAttrs } from './media'
import { DEFAULT_LOCALE, dict, type Locale, localizePath } from './i18n'
import { linkHref, type CMSLinkData } from './links'

type CodeBlockFields = { code: string; language?: string; blockType: 'code' }

type NodeTypes =
  | DefaultNodeTypes
  | SerializedTableNode
  | SerializedTableRowNode
  | SerializedTableCellNode
  | SerializedBlockNode<BannerBlock | CallToActionBlock | MediaBlock | CodeBlockFields>

export const escapeHTML = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Internal-doc links: posts -> /notes/:slug, pages -> /:slug. */
const internalDocToHref =
  (locale: Locale) =>
  ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
    const doc = linkNode.fields.doc
    if (!doc || typeof doc.value !== 'object') return localizePath(locale, '/')
    const slug = (doc.value as { slug?: string }).slug ?? ''
    return localizePath(locale, doc.relationTo === 'posts' ? `${ROUTES.posts}/${slug}` : `/${slug}`)
  }

/** Anchor id for a heading: lowercase words joined by "-", CJK kept as is. */
export const headingId = (text: string): string =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;|&#\d+;/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section'

export type TocEntry = { id: string; text: string; level: 2 | 3 }

const mediaHTML = (media: MediaBlock['media']): string => {
  if (!media || typeof media !== 'object') return ''
  const { src, srcset, width, height, alt } = imgAttrs(media)
  const attrs = [
    `src="${escapeHTML(src)}"`,
    srcset ? `srcset="${escapeHTML(srcset)}"` : '',
    width ? `width="${width}"` : '',
    height ? `height="${height}"` : '',
    `alt="${escapeHTML(alt)}"`,
    'loading="lazy"',
    'decoding="async"',
  ]
    .filter(Boolean)
    .join(' ')
  return `<img class="m-0 w-full border border-base-300/60 rounded-box" ${attrs} />`
}

const bannerStyleClasses: Record<string, string> = {
  info: 'border-base-300/60 bg-base-200',
  error: 'border-error/40 bg-error/10',
  success: 'border-success/40 bg-success/10',
  warning: 'border-warning/40 bg-warning/10',
}

const ctaLinkHTML = (links: CallToActionBlock['links'], locale: Locale): string =>
  (links ?? [])
    .map(({ link }) => {
      const href = linkHref(link as CMSLinkData, locale)
      if (!href) return ''
      const label = escapeHTML((link as CMSLinkData).label ?? '')
      const newTab = (link as CMSLinkData).newTab
        ? ' target="_blank" rel="noopener noreferrer"'
        : ''
      return `<a class="btn btn-primary btn-sm font-mono font-normal no-underline" href="${escapeHTML(href)}"${newTab}>${label}</a>`
    })
    .join('')

/** Lexical's TableCellHeaderStates bits: ROW heads a column (header row), COLUMN heads a row. */
const ROW_HEADER = 1
const COLUMN_HEADER = 2

const headerStateOf = (node: unknown): number => {
  const state = (node as { headerState?: unknown }).headerState
  return typeof state === 'number' ? state : 0
}

/** Stored JSON is not type-checked: only small whole numbers become attributes. */
const spanAttr = (name: 'colspan' | 'rowspan', value: unknown): string =>
  typeof value === 'number' && Number.isInteger(value) && value > 1 && value <= 1000
    ? ` ${name}="${value}"`
    : ''

/** A cell with more characters than this keeps its column at least 10rem wide (`.rt-long`). */
const LONG_CELL = 24

const textLength = (html: string): number =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .trim().length

const cellsOf = (row: unknown): SerializedTableCellNode[] => {
  const children = (row as { children?: unknown }).children
  return Array.isArray(children)
    ? children.filter((cell): cell is SerializedTableCellNode => cell?.type === 'tablecell')
    : []
}

/**
 * A rich text table (EXPERIMENTAL_TableFeature in the CMS), replacing
 * Payload's converter, which inlines `border: 1px solid #ccc` and
 * `padding: 8px` on every cell. Here it is a daisyUI `table` inside a
 * scroll box (`.rt-table`, global.css): a wide table scrolls sideways
 * inside the text column instead of widening the page. The leading header
 * rows go in `<thead>`; header cells are `<th>` with a scope; merged cells
 * keep `colspan`/`rowspan`; a cell with a long text gets `rt-long` so its
 * column does not shrink to a word per line on phones. Row striping becomes
 * `table-zebra` and a frozen first column (the cells that start in column 0,
 * `rt-frozen`) stays in view while scrolling.
 * Column widths and cell background colors from the editor are not used:
 * widths follow the text and the screen, colors follow the theme.
 */
const tableHTML = (
  node: SerializedTableNode,
  cellHTML: (cell: SerializedTableCellNode) => string,
  locale: Locale,
): string => {
  const rows = (node.children ?? []).filter(
    (row): row is SerializedTableRowNode => row?.type === 'tablerow',
  )
  const frozen = typeof node.frozenColumnCount === 'number' && node.frozenColumnCount > 0
  // Each cell's first logical column: a cell merged down from a row above
  // takes its columns in the rows it covers, so a row's first child is not
  // always in column 0. Only cells that start in column 0 are frozen.
  const rowSpanOf = (cell: SerializedTableCellNode) =>
    spanAttr('rowspan', cell.rowSpan) ? (cell.rowSpan as number) : 1
  const colSpanOf = (cell: SerializedTableCellNode) =>
    spanAttr('colspan', cell.colSpan) ? (cell.colSpan as number) : 1
  const startColumns: number[][] = []
  const covered: number[] = [] // per column: rows still covered by a rowspan from above
  for (const row of rows) {
    const starts: number[] = []
    let column = 0
    for (const cell of cellsOf(row)) {
      while ((covered[column] ?? 0) > 0) column += 1
      starts.push(column)
      for (let i = 0; i < colSpanOf(cell); i += 1) covered[column + i] = rowSpanOf(cell)
      column += colSpanOf(cell)
    }
    for (let i = 0; i < covered.length; i += 1) covered[i] = Math.max(0, (covered[i] ?? 0) - 1)
    startColumns.push(starts)
  }

  let headCount = 0
  while (headCount < rows.length) {
    const cells = cellsOf(rows[headCount])
    if (!cells.length || !cells.every((cell) => headerStateOf(cell) & ROW_HEADER)) break
    headCount += 1
  }
  // A cell cannot span from <thead> into <tbody>: if a header cell is merged
  // down past the header rows, the whole table goes in one <tbody> (its
  // header cells stay <th>).
  const reach = rows
    .slice(0, headCount)
    .flatMap((row, r) => cellsOf(row).map((cell) => r + rowSpanOf(cell)))
  if (reach.some((end) => end > headCount)) headCount = 0

  const rowHTML = (row: SerializedTableRowNode, r: number) =>
    `<tr>${cellsOf(row)
      .map((cell, i) => {
        const inner = cellHTML(cell)
        const state = headerStateOf(cell)
        const classNames = [
          textLength(inner) > LONG_CELL ? 'rt-long' : '',
          frozen && startColumns[r]?.[i] === 0 ? 'rt-frozen' : '',
        ].filter(Boolean)
        const attrs =
          (classNames.length ? ` class="${classNames.join(' ')}"` : '') +
          spanAttr('colspan', cell.colSpan) +
          spanAttr('rowspan', cell.rowSpan)
        if (!state) return `<td${attrs}>${inner}</td>`
        const scope = state & ROW_HEADER ? 'col' : state & COLUMN_HEADER ? 'row' : ''
        return `<th${scope ? ` scope="${scope}"` : ''}${attrs}>${inner}</th>`
      })
      .join('')}</tr>`
  const head = rows.slice(0, headCount).map((row, r) => rowHTML(row, r)).join('')
  const body = rows
    .slice(headCount)
    .map((row, r) => rowHTML(row, headCount + r))
    .join('')
  if (!head && !body) return ''
  const classes = ['table']
  if (node.rowStriping === true) classes.push('table-zebra')
  if (frozen) classes.push('rt-table-frozen')
  return `<div class="rt-table not-prose" role="region" tabindex="0" aria-label="${escapeHTML(dict(locale).richTable)}"><table class="${classes.join(' ')}">${head ? `<thead>${head}</thead>` : ''}${body ? `<tbody>${body}</tbody>` : ''}</table></div>`
}

const htmlConverters = (locale: Locale, toc: TocEntry[]): HTMLConvertersFunction<NodeTypes> => {
  const seen = new Map<string, number>()
  return ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkHTMLConverter({ internalDocToHref: internalDocToHref(locale) }),
    table: ({ node, nodesToHTML }) =>
      tableHTML(node, (cell) => nodesToHTML({ nodes: cell.children }).join(''), locale),
    // The editor keeps an empty paragraph around a table it inserts; on the
    // page that is a blank line on top of the table's own margin.
    paragraph: ({ node, nodesToHTML, parent, providedStyleTag }) => {
      const children = nodesToHTML({ nodes: node.children })
      if (children.length) return `<p${providedStyleTag}>${children.join('')}</p>`
      const siblings = (parent as { children?: { type?: string }[] }).children ?? []
      const index = siblings.indexOf(node)
      const nextToTable =
        index >= 0 &&
        (siblings[index - 1]?.type === 'table' || siblings[index + 1]?.type === 'table')
      return nextToTable ? '' : `<p${providedStyleTag}><br /></p>`
    },
    // h2/h3 get stable ids so the "On this page" panel can link to them.
    heading: ({ node, nodesToHTML, providedStyleTag }) => {
      const children = nodesToHTML({ nodes: node.children }).join('')
      const tag = /^h[1-6]$/.test(node.tag) ? node.tag : 'h2'
      if (tag !== 'h2' && tag !== 'h3') return `<${tag}${providedStyleTag}>${children}</${tag}>`
      const base = headingId(children)
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      const id = count > 1 ? `${base}-${count}` : base
      toc.push({ id, text: children.replace(/<[^>]+>/g, ''), level: tag === 'h2' ? 2 : 3 })
      return `<${tag} id="${escapeHTML(id)}"${providedStyleTag}>${children}</${tag}>`
    },
    blocks: {
      banner: ({ node }) => {
        const { content, style } = node.fields as BannerBlock
        const inner = content
          ? richTextToHTML(content as unknown as SerializedEditorState, locale)
          : ''
        const styleClass = bannerStyleClasses[style ?? 'info'] ?? bannerStyleClasses.info
        return `<div class="mx-auto my-8 w-full col-start-2 mb-4"><div class="border py-3 px-6 flex items-center rounded-field ${styleClass}">${inner}</div></div>`
      },
      code: ({ node }) => {
        const { code, language } = node.fields as CodeBlockFields
        const lang = escapeHTML(language || 'text')
        return `<figure class="not-prose my-6 overflow-hidden rounded-box border border-base-300"><figcaption class="flex items-center justify-between border-b border-base-300 bg-base-200 px-3.5 py-2 font-mono text-xs text-base-content/65"><span><span class="text-primary" aria-hidden="true">●</span> ${lang}</span></figcaption><pre class="m-0 overflow-x-auto bg-base-100 px-4 py-3.5 font-mono text-[13px] leading-relaxed"><code class="language-${lang}">${escapeHTML(code ?? '')}</code></pre></figure>`
      },
      cta: ({ node }) => {
        const { links, richText } = node.fields as CallToActionBlock
        const inner = richText
          ? richTextToHTML(richText as unknown as SerializedEditorState, locale)
          : ''
        return `<div class="container"><div class="bg-base-200 rounded-box border-base-300/60 border p-6 flex flex-col gap-8 md:flex-row md:justify-between md:items-center"><div class="max-w-[48rem] flex items-center">${inner}</div><div class="flex flex-col gap-4">${ctaLinkHTML(links, locale)}</div></div></div>`
      },
      mediaBlock: ({ node }) => {
        const { media } = node.fields as MediaBlock
        const caption =
          media && typeof media === 'object' && media.caption
            ? `<div class="mt-6 mx-auto max-w-[48rem]">${richTextToHTML(media.caption as unknown as SerializedEditorState, locale)}</div>`
            : ''
        return `<div class="col-start-1 col-span-3">${mediaHTML(media)}${caption}</div>`
      },
    },
  })
}

/**
 * Convert a Lexical editor state to HTML (no Payload instance needed), plus
 * the h2/h3 outline for a table of contents.
 */
export const renderRichText = (
  data: SerializedEditorState,
  locale: Locale = DEFAULT_LOCALE,
): { html: string; toc: TocEntry[] } => {
  const toc: TocEntry[] = []
  const html = convertLexicalToHTML({
    converters: htmlConverters(locale, toc) as HTMLConvertersFunction<DefaultNodeTypes>,
    data,
  })
  return { html, toc }
}

/** Convert a Lexical editor state to an HTML string. */
export const richTextToHTML = (
  data: SerializedEditorState,
  locale: Locale = DEFAULT_LOCALE,
): string => renderRichText(data, locale).html
