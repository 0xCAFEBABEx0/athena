import { escapeHTML } from './richtext'

export type SitemapEntry = { loc: string; lastmod?: string }

export const sitemapXML = (entries: SitemapEntry[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .map(
      (entry) =>
        `  <url><loc>${escapeHTML(entry.loc)}</loc>${
          entry.lastmod ? `<lastmod>${escapeHTML(entry.lastmod)}</lastmod>` : ''
        }</url>`,
    )
    .join('\n') +
  `\n</urlset>\n`

export const sitemapResponse = (xml: string): Response =>
  new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
