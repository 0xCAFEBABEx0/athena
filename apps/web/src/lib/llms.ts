import { ROUTES } from '@athena/shared/constants'
import { LOCALE_LABEL, LOCALES, localizePath } from './i18n'

/** One line of Markdown: no line breaks, and no brackets that would end a link. */
export const llmsLine = (text: string | null | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim()

type LlmsInput = {
  origin: string
  site: { siteName: string; description?: string; intro: string; welcome: string }
  posts: { slug?: string | null; title?: string | null; meta?: { description?: string | null } | null }[]
  work: { slug: string; title: string; description: string }[]
}

/**
 * /llms.txt (https://llmstxt.org): what the site is and where its content
 * lives, from the Site global, the newest posts and /work.
 */
export const buildLlmsTxt = ({ origin, site, posts, work }: LlmsInput): string => {
  const url = (path: string) => `${origin}${path}`
  const entry = (title: string, path: string, description?: string | null) => {
    const text = llmsLine(description)
    return `- [${llmsLine(title)}](${url(path)})${text ? `: ${text}` : ''}`
  }
  const summary = llmsLine(site.description || site.intro || site.welcome)
  const languages = LOCALES.map((code) => `${LOCALE_LABEL[code]} (${url(localizePath(code, '/'))})`).join(', ')
  const recent = posts
    .filter((post) => post.slug)
    .map((post) => entry(post.title || post.slug || '', `${ROUTES.posts}/${post.slug}`, post.meta?.description))
  const projects = work.map((item) => entry(item.title, `${ROUTES.work}/${item.slug}`, item.description))

  const sections = [
    `# ${llmsLine(site.siteName)}`,
    summary ? `> ${summary}` : '',
    [
      site.intro && site.intro !== site.description ? llmsLine(site.intro) : '',
      `Available in ${languages}. Content is publicly readable; the \`/api/\` paths are internal endpoints and are not meant for crawling.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    [
      '## Main sections',
      '',
      `- [Home](${url('/')}): Introduction, newest notes and pinned projects`,
      `- [Notes](${url(ROUTES.posts)}): Every published note, newest first`,
      `- [Builds](${url(ROUTES.work)}): Projects and their GitHub activity`,
      `- [Search](${url('/search')}): Search across notes`,
    ].join('\n'),
    recent.length > 0 ? ['## Recent notes', '', ...recent].join('\n') : '',
    projects.length > 0 ? ['## Projects', '', ...projects].join('\n') : '',
    [
      '## Optional',
      '',
      `- [RSS](${url('/rss.xml')}): Feed of the newest posts`,
      `- [Sitemap](${url('/sitemap.xml')}): Every published page, post and project`,
      `- [robots.txt](${url('/robots.txt')}): Crawl rules`,
    ].join('\n'),
  ]
  return `${sections.filter(Boolean).join('\n\n')}\n`
}
