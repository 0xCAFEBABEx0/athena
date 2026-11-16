import { LEGACY_ROUTES, ROUTES } from '@athena/shared/constants'
import type { APIRoute } from 'astro'

import { getPosts } from '@/lib/cms'
import { webURL } from '@/lib/env'
import { escapeHTML } from '@/lib/richtext'
import { LANG_TAG, localeOf, localizePath } from '@/lib/i18n'
import { getSite } from '@/lib/site'

// Item GUIDs keep the post URLs from before 1.2.0 (`/posts/<slug>`): feed
// readers tell items apart by GUID, so new ones would show every post again.
const GUID_SECTION =
  Object.keys(LEGACY_ROUTES).find((path) => LEGACY_ROUTES[path] === ROUTES.posts) ?? ROUTES.posts

/** RSS 2.0 feed of the 30 newest published posts. */
export const GET: APIRoute = async ({ locals }) => {
  const locale = localeOf({ locals })
  const [site, posts] = await Promise.all([
    getSite(locals, locale),
    getPosts({ page: 1, limit: 30 }, { locale }),
  ])
  const origin = webURL()

  const items = posts.docs
    .filter((post) => post.slug)
    .map((post) => {
      const link = `${origin}${localizePath(locale, `${ROUTES.posts}/${post.slug}`)}`
      const guid = `${origin}${localizePath(locale, `${GUID_SECTION}/${post.slug}`)}`
      return [
        '<item>',
        `<title>${escapeHTML(post.title ?? '')}</title>`,
        `<link>${escapeHTML(link)}</link>`,
        `<guid isPermaLink="true">${escapeHTML(guid)}</guid>`,
        post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : '',
        post.meta?.description
          ? `<description>${escapeHTML(post.meta.description)}</description>`
          : '',
        '</item>',
      ].join('')
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeHTML(site.siteName)}</title>
<link>${escapeHTML(origin)}${localizePath(locale, '/')}</link>
<description>${escapeHTML(site.description ?? site.intro ?? site.siteName)}</description>
<language>${LANG_TAG[locale]}</language>
<atom:link href="${escapeHTML(origin)}${localizePath(locale, '/rss.xml')}" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
