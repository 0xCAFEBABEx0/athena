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

import type {
  BannerBlock,
  CallToActionBlock,
  MediaBlock,
} from '@athena/shared/payload-types'

import { imgAttrs } from './media'
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
const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const doc = linkNode.fields.doc
  if (!doc || typeof doc.value !== 'object') return '/'
  const slug = (doc.value as { slug?: string }).slug ?? ''
  return doc.relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`
}

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

const ctaLinkHTML = (links: CallToActionBlock['links']): string =>
  (links ?? [])
    .map(({ link }) => {
      const href = linkHref(link as CMSLinkData)
      if (!href) return ''
      const label = escapeHTML((link as CMSLinkData).label ?? '')
      const newTab = (link as CMSLinkData).newTab
        ? ' target="_blank" rel="noopener noreferrer"'
        : ''
      return `<a class="btn btn-primary font-medium no-underline" href="${escapeHTML(href)}"${newTab}>${label}</a>`
    })
    .join('')

const htmlConverters: HTMLConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkHTMLConverter({ internalDocToHref }),
  blocks: {
    banner: ({ node }) => {
      const { content, style } = node.fields as BannerBlock
      const inner = content ? richTextToHTML(content as unknown as SerializedEditorState) : ''
      const styleClass = bannerStyleClasses[style ?? 'info'] ?? bannerStyleClasses.info
      return `<div class="mx-auto my-8 w-full col-start-2 mb-4"><div class="border py-3 px-6 flex items-center rounded-field ${styleClass}">${inner}</div></div>`
    },
    code: ({ node }) => {
      const { code, language } = node.fields as CodeBlockFields
      return `<div class="col-start-2 not-prose"><pre class="border border-base-300/60 bg-base-200 rounded-field p-4 overflow-x-auto text-sm"><code class="language-${escapeHTML(language ?? '')}">${escapeHTML(code ?? '')}</code></pre></div>`
    },
    cta: ({ node }) => {
      const { links, richText } = node.fields as CallToActionBlock
      const inner = richText ? richTextToHTML(richText as unknown as SerializedEditorState) : ''
      return `<div class="container"><div class="bg-base-200 rounded-box border-base-300/60 border p-6 flex flex-col gap-8 md:flex-row md:justify-between md:items-center"><div class="max-w-[48rem] flex items-center">${inner}</div><div class="flex flex-col gap-4">${ctaLinkHTML(links)}</div></div></div>`
    },
    mediaBlock: ({ node }) => {
      const { media } = node.fields as MediaBlock
      const caption =
        media && typeof media === 'object' && media.caption
          ? `<div class="mt-6 mx-auto max-w-[48rem]">${richTextToHTML(media.caption as unknown as SerializedEditorState)}</div>`
          : ''
      return `<div class="col-start-1 col-span-3">${mediaHTML(media)}${caption}</div>`
    },
  },
})

/** Convert a Lexical editor state to an HTML string (no Payload instance needed). */
export const richTextToHTML = (data: SerializedEditorState): string =>
  convertLexicalToHTML({
    converters: htmlConverters as HTMLConvertersFunction<DefaultNodeTypes>,
    data,
  })
