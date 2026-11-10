import type { Media, Page, Post } from '@athena/shared/payload-types'

import type { Locale } from '@athena/shared/constants'

import { LANG_TAG } from './i18n'
import { mediaUrl } from './media'
import { webURL } from './env'

export type JsonLd = Record<string, unknown>

export type PageMeta = {
  title: string
  description: string | undefined
  ogImage: string
  url: string
  /** `article` for posts (adds article:published_time / modified_time). */
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  /**
   * Keep the page out of search results (404, search, drafts): adds
   * `robots: noindex, follow` and drops canonical and hreflang links.
   */
  noindex?: boolean
  /** schema.org objects, one `<script type="application/ld+json">` each. */
  jsonLd?: JsonLd[]
}

/** Built-in share image (Hoo); the Site global's `ogImage` replaces it. */
export const DEFAULT_OG_IMAGE = '/og.png'
/** Size of public/og.png, sent as og:image:width/height for the built-in image. */
export const DEFAULT_OG_SIZE = { width: 1200, height: 630 } as const

/** `og:locale` wants language_TERRITORY. */
export const OG_LOCALE: Record<Locale, string> = { en: 'en_US', ja: 'ja_JP', zh: 'zh_CN' }

export type SiteMeta = {
  siteName: string
  description?: string
  intro?: string
  welcome?: string
  ogImage?: string | null
}

/**
 * Plain text cut to about the length search results show (Google trims
 * snippets near 155–160 characters), on a word boundary when there is one.
 */
export const summarize = (text: string | null | undefined, max = 155): string => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  // CJK text has no spaces: cut at the character.
  const end = space > max * 0.6 ? space : cut.length
  return `${cut.slice(0, end).replace(/[\s.,;:、。，]+$/u, '')}…`
}

/** Site-wide description: the SEO field, else the intro, else the welcome line. */
export const siteDescription = (site: SiteMeta): string | undefined =>
  summarize(site.description || site.intro || site.welcome) || undefined

const defaultOgImage = (site: SiteMeta): string => site.ogImage || `${webURL()}${DEFAULT_OG_IMAGE}`

const ogImageURL = (image: unknown, site: SiteMeta): string => {
  if (image && typeof image === 'object' && 'url' in image) {
    const media = image as Media
    return mediaUrl(media.sizes?.og?.url || media.url)
  }
  return defaultOgImage(site)
}

/** `Title | Site name`, or just the site name when there is no title. */
export const pageTitle = (title: string | null | undefined, siteName: string): string =>
  title ? `${title} | ${siteName}` : siteName

/** Head metadata for a non-CMS route (home, post list, work, search, 404). */
export const routeMeta = (
  title: string | null,
  path: string,
  site: SiteMeta,
  description?: string | null,
): PageMeta => ({
  title: pageTitle(title, site.siteName),
  description: summarize(description) || siteDescription(site),
  ogImage: defaultOgImage(site),
  url: `${webURL()}${path}`,
})

/**
 * Port of apps/cms generateMeta.ts: SEO-plugin fields -> head metadata.
 * `excerpt` (the page text) fills in when the SEO description is empty.
 */
export const buildMeta = (
  doc: Partial<Page> | Partial<Post> | null,
  path: string,
  site: SiteMeta,
  excerpt?: string,
): PageMeta => ({
  title: pageTitle(doc?.meta?.title || doc?.title, site.siteName),
  description:
    summarize(doc?.meta?.description) || summarize(excerpt) || siteDescription(site),
  ogImage: ogImageURL(doc?.meta?.image, site),
  url: `${webURL()}${path}`,
})

/** Post metadata: buildMeta plus og:type article and its dates. */
export const postMeta = (
  post: Partial<Post>,
  path: string,
  site: SiteMeta,
  excerpt?: string,
): PageMeta => ({
  ...buildMeta(post, path, site, excerpt),
  type: 'article',
  publishedTime: post.publishedAt || undefined,
  modifiedTime: post.updatedAt || undefined,
})

/**
 * `<script type="application/ld+json">` body. `<` is escaped so text from the
 * CMS can never close the script element.
 */
export const jsonLdScript = (data: JsonLd): string =>
  JSON.stringify(data).replace(/</g, '\\u003c')

const person = (name: string, url?: string, sameAs?: string[]): JsonLd => ({
  '@type': 'Person',
  name,
  ...(url ? { url } : {}),
  ...(sameAs && sameAs.length ? { sameAs } : {}),
})

/** Home page: WebSite (Google's site-name source) and its author. */
export const websiteJsonLd = (
  site: SiteMeta & { authorName?: string; socialLinks?: { url: string }[] },
  locale: Locale,
  url: string,
): JsonLd => {
  const description = siteDescription(site)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.siteName,
    url,
    inLanguage: LANG_TAG[locale],
    ...(description ? { description } : {}),
    ...(site.authorName
      ? {
          author: person(
            site.authorName,
            url,
            (site.socialLinks ?? []).map((link) => link.url).filter((href) => /^https?:\/\//.test(href)),
          ),
        }
      : {}),
  }
}

/** A post: BlogPosting with its dates, authors and share image. */
export const postJsonLd = (
  meta: PageMeta,
  headline: string,
  authors: string[],
  locale: Locale,
  siteURL: string,
): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline,
  url: meta.url,
  mainEntityOfPage: meta.url,
  inLanguage: LANG_TAG[locale],
  image: [meta.ogImage],
  ...(meta.description ? { description: meta.description } : {}),
  ...(meta.publishedTime ? { datePublished: meta.publishedTime } : {}),
  ...(meta.modifiedTime || meta.publishedTime
    ? { dateModified: meta.modifiedTime || meta.publishedTime }
    : {}),
  ...(authors.length ? { author: authors.map((name) => person(name, siteURL)) } : {}),
})

// GitHub lumps small languages into "Other", which is not a language.
const languages = (item: { languages: { name: string }[] }): string[] =>
  item.languages.map((lang) => lang.name).filter((name) => name && name !== 'Other')

/** A /work entry: SoftwareSourceCode for the repository. */
export const workJsonLd = (
  item: {
    title: string
    description: string
    repoUrl: string | null
    liveUrl: string | null
    languages: { name: string }[]
    createdAt: string
    pushedAt: string
  },
  url: string,
  authorName: string,
): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: item.title,
  url,
  ...(item.description ? { description: summarize(item.description) } : {}),
  ...(item.repoUrl ? { codeRepository: item.repoUrl } : {}),
  ...(item.liveUrl ? { sameAs: [item.liveUrl] } : {}),
  ...(languages(item).length ? { programmingLanguage: languages(item) } : {}),
  ...(item.createdAt ? { dateCreated: item.createdAt } : {}),
  ...(item.pushedAt ? { dateModified: item.pushedAt } : {}),
  ...(authorName ? { author: person(authorName) } : {}),
})

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }

/** Rendered rich-text HTML -> plain text for a description. */
export const htmlToText = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code: string) => {
      if (ENTITIES[code]) return ENTITIES[code]
      if (code[0] === '#') {
        const n = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
        return Number.isFinite(n) ? String.fromCodePoint(n) : match
      }
      return match
    })
    .replace(/\s+/g, ' ')
    .trim()
