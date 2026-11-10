import type { APIRoute } from 'astro'

import { getPosts } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { DEFAULT_LOCALE, LOCALE_LABEL, LOCALES, localizePath } from '@/lib/i18n'
import { getSite } from '@/lib/site'
import { getWork } from '@/lib/work'

/** One line of Markdown: no line breaks, and no `]` that would end a link. */
const line = (text: string | null | undefined): string =>
  (text ?? '').replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim()

/**
 * /llms.txt (https://llmstxt.org): what the site is and where its content
 * lives, built from the Site global, the newest posts and /work, so it
 * follows the CMS instead of a static file. English only; the other
 * languages are listed with their prefixes.
 */
export const GET: APIRoute = async ({ locals }) => {
  const locale = DEFAULT_LOCALE
  const [site, posts, work] = await Promise.all([
    getSite(locals, locale),
    getPosts({ page: 1, limit: 10 }, { locale }).catch(() => null),
    getWork(locals, locale),
  ])
  const origin = webURL()
  const url = (path: string) => `${origin}${path}`
  const summary = line(site.description || site.intro || site.welcome)
  const languages = LOCALES.map(
    (code) => `${LOCALE_LABEL[code]} (${url(localizePath(code, '/'))})`,
  ).join(', ')

  const recent = (posts?.docs ?? [])
    .filter((post) => post.slug)
    .map((post) => {
      const description = line(post.meta?.description)
      return `- [${line(post.title)}](${url(`/posts/${post.slug}`)})${description ? `: ${description}` : ''}`
    })
  const projects = work.map((item) => {
    const description = line(item.description)
    return `- [${line(item.title)}](${url(`/work/${item.slug}`)})${description ? `: ${description}` : ''}`
  })

  const sections = [
    `# ${line(site.siteName)}`,
    summary ? `> ${summary}` : '',
    [
      site.intro && site.intro !== site.description ? line(site.intro) : '',
      `Available in ${languages}. Content is publicly readable; the \`/api/\` paths are internal endpoints and are not meant for crawling.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    [
      '## Main sections',
      '',
      `- [Home](${url('/')}): Introduction, newest posts and pinned projects`,
      `- [Posts](${url('/posts')}): Every published post, newest first`,
      `- [Work](${url('/work')}): Projects and their GitHub activity`,
      `- [Search](${url('/search')}): Search across posts and pages`,
    ].join('\n'),
    recent.length > 0 ? ['## Recent posts', '', ...recent].join('\n') : '',
    projects.length > 0 ? ['## Projects', '', ...projects].join('\n') : '',
    [
      '## Optional',
      '',
      `- [RSS](${url('/rss.xml')}): Feed of the newest posts`,
      `- [Sitemap](${url('/sitemap.xml')}): Every published page, post and project`,
      `- [robots.txt](${url('/robots.txt')}): Crawl rules`,
    ].join('\n'),
  ]

  return new Response(`${sections.filter(Boolean).join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
