import type { Payload, PayloadRequest } from 'payload'

import type { Locale } from '@athena/shared/constants'

import { type Section, lexicalToSections } from './lexical'
import type { DocKind } from './store'

/**
 * What the AI index reads, per kind of document: the text a visitor sees on
 * the public page, read through the Local API exactly as an anonymous
 * visitor would (overrideAccess: false, no user), once per language with
 * the usual English fallback.
 *
 * Each reader returns null when the public page does not exist, mirroring
 * the web app's own rules (a draft, the unrouted CMS "home" page, a hidden
 * build, an empty /about or /stacks), so nothing a visitor cannot open is
 * ever offered as a source.
 */

export type IndexedDoc = {
  /** The public URL's last part; '' for about and stack. */
  slug: string
  title: string
  /** Opens the first excerpt (a meta description, an intro). */
  description?: string | null
  sections: Section[]
}

type Reader = (
  payload: Payload,
  id: string,
  locale: Locale,
  req?: PayloadRequest,
) => Promise<IndexedDoc | null>

type Row = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const isObject = (value: unknown): value is Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const allRichText = (value: unknown): Section[] => {
  if (Array.isArray(value)) return value.flatMap(allRichText)
  if (!isObject(value)) return []
  if (isObject(value.root) && Array.isArray(value.root.children)) return lexicalToSections(value)
  return Object.values(value).flatMap(allRichText)
}

/**
 * Every Lexical value inside `value` (a page's hero and blocks), in order.
 * Text before a block's first heading continues the section above it, so
 * short blocks pack into one excerpt instead of one each.
 */
export const richTextSections = (value: unknown): Section[] => {
  const merged: Section[] = []
  for (const section of allRichText(value)) {
    const last = merged.at(-1)
    if (last && section.heading === null) last.paragraphs.push(...section.paragraphs)
    else merged.push({ heading: section.heading, paragraphs: [...section.paragraphs] })
  }
  return merged.filter((section) => section.heading !== null || section.paragraphs.length > 0)
}

const paragraphs = (...values: unknown[]): string[] => values.map(text).filter(Boolean)

/** A published document of a drafts-enabled collection, or null. */
const findPublished = async (
  payload: Payload,
  collection: 'posts' | 'pages',
  id: string,
  locale: Locale,
  req?: PayloadRequest,
): Promise<Row | null> => {
  const { docs } = await payload.find({
    collection,
    // `_status` as well as anonymous access: when this runs inline with the
    // save's `req` (jobs, scripts), Payload reads with that request's user,
    // who can see drafts.
    where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
    locale,
    depth: 0,
    limit: 1,
    pagination: false,
    draft: false,
    overrideAccess: false,
    // Same transaction as the save when the hook runs inline (jobs, scripts).
    ...(req ? { req } : {}),
  })
  return (docs[0] as Row | undefined) ?? null
}

const descriptionOf = (doc: Row): string | null =>
  isObject(doc.meta) ? text(doc.meta.description) || null : null

const readPost: Reader = async (payload, id, locale, req) => {
  const post = await findPublished(payload, 'posts', id, locale, req)
  const slug = text(post?.slug)
  if (!post || !slug) return null
  return {
    slug,
    title: text(post.title) || slug,
    description: descriptionOf(post),
    sections: lexicalToSections(post.content),
  }
}

const HERO_TYPES = new Set(['highImpact', 'mediumImpact', 'lowImpact'])

const readPage: Reader = async (payload, id, locale, req) => {
  const page = await findPublished(payload, 'pages', id, locale, req)
  const slug = text(page?.slug)
  // The CMS "home" page is not routed (the home page is built from Site).
  if (!page || !slug || slug === 'home' || slug.includes('/')) return null
  return {
    slug,
    title: text(page.title) || slug,
    description: descriptionOf(page),
    // The web app renders a hero only for these types (RenderHero.astro); a
    // hero switched to "none" keeps its text in the data, unseen.
    sections: richTextSections([HERO_TYPES.has(String(isObject(page.hero) ? page.hero.type : '')) ? page.hero : null, page.layout]),
  }
}

/** The repository name, as /builds shows an entry without a title. */
const repoName = (repo: string): string => repo.split('/').pop() ?? repo

const readProject: Reader = async (payload, id, locale, req) => {
  const { docs } = await payload.find({
    collection: 'projects',
    where: { id: { equals: id } },
    locale,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: false,
    ...(req ? { req } : {}),
  })
  const project = docs[0] as Row | undefined
  const slug = text(project?.slug)
  if (!project || !slug || project.hidden) return null
  // /builds lists a private entry only with a live URL, a public one only once GitHub answered.
  const listed = project.privateRepo
    ? Boolean(text(project.liveUrl))
    : Boolean(text(project.repo)) && isObject(project.github)
  if (!listed) return null
  const title = text(project.title) || repoName(text(project.repo)) || slug
  return {
    slug,
    title,
    sections: [
      { heading: null, paragraphs: paragraphs(project.description, project.brief, project.notes) },
    ],
  }
}

const findGlobal = async (
  payload: Payload,
  slug: 'about' | 'stack',
  locale: Locale,
  req?: PayloadRequest,
): Promise<Row> =>
  (await payload.findGlobal({
    slug,
    locale,
    depth: 0,
    overrideAccess: false,
    ...(req ? { req } : {}),
  })) as unknown as Row

const readAbout: Reader = async (payload, _id, locale, req) => {
  const about = await findGlobal(payload, 'about', locale, req)
  const story = lexicalToSections(about.body)
  const lead = text(about.lead)
  // /about is a 404 until it has a lead or a story.
  if (!lead && story.every((section) => section.paragraphs.length === 0)) return null
  return { slug: '', title: text(about.heading) || 'About', description: lead, sections: story }
}

const readStack: Reader = async (payload, _id, locale, req) => {
  const stack = await findGlobal(payload, 'stack', locale, req)
  const groups = Array.isArray(stack.groups) ? stack.groups.filter(isObject) : []
  // Tools as /stacks lists them: named ones only, former ones included.
  const named = (group: Row) =>
    (Array.isArray(group.items) ? group.items.filter(isObject) : []).filter((item) =>
      text(item.name),
    )
  const sections: Section[] = groups
    .filter((group) => named(group).length > 0)
    .map((group) => ({
      heading: text(group.title) || null,
      paragraphs: [
        ...paragraphs(group.description),
        named(group)
          .map((item) => `- ${[text(item.name), text(item.note)].filter(Boolean).join(': ')}`)
          .join('\n'),
      ],
    }))
  // /stacks is a 404 until it lists a tool.
  if (!sections.length) return null
  return { slug: '', title: 'Stacks', description: text(stack.intro), sections }
}

export const READERS: Record<DocKind, Reader> = {
  post: readPost,
  page: readPage,
  project: readProject,
  about: readAbout,
  stack: readStack,
}

/** Ids of every document of `kind` a visitor may be able to read (each is read again before indexing). */
export const listIds = async (
  payload: Payload,
  kind: DocKind,
  locale: Locale,
): Promise<string[]> => {
  if (kind === 'about' || kind === 'stack') return [kind]
  const collection = kind === 'post' ? 'posts' : kind === 'page' ? 'pages' : 'projects'
  const { docs } = await payload.find({
    collection,
    ...(collection === 'projects'
      ? {}
      : { where: { _status: { equals: 'published' } }, draft: false }),
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
    select: {},
  })
  return docs.map((doc) => String(doc.id))
}
