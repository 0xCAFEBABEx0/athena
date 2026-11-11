import type {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  convertLexicalToHTML,
  LinkHTMLConverter,
  type HTMLConvertersFunction,
} from '@payloadcms/richtext-lexical/html'

import type { BannerBlock, CallToActionBlock, MediaBlock } from '@athena/shared/payload-types'

import { imgAttrs } from './media'
import { DEFAULT_LOCALE, type Locale, localizePath } from './i18n'
import { linkHref, type CMSLinkData } from './links'

type CodeBlockFields = { code: string; language?: string; blockType: 'code' }

type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<BannerBlock | CallToActionBlock | MediaBlock | CodeBlockFields>

export const escapeHTML = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Same internal-doc mapping as apps/cms RichText: posts -> /posts/:slug, pages -> /:slug. */
const internalDocToHref =
  (locale: Locale) =>
  ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
    const doc = linkNode.fields.doc
    if (!doc || typeof doc.value !== 'object') return localizePath(locale, '/')
    const slug = (doc.value as { slug?: string }).slug ?? ''
    return localizePath(locale, doc.relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`)
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

const htmlConverters = (locale: Locale, toc: TocEntry[]): HTMLConvertersFunction<NodeTypes> => {
  const seen = new Map<string, number>()
  return ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkHTMLConverter({ internalDocToHref: internalDocToHref(locale) }),
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
