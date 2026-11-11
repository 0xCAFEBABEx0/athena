/**
 * Posts on X picked for the home page (Site global → picks). The text,
 * author and date come from X's public oEmbed endpoint (no API key) when the
 * Site global is saved, so the web app renders its own card from stored data
 * and never loads X's widget script.
 */

export type XPost = {
  /** Canonical `https://x.com/<handle>/status/<id>`. */
  url: string
  text: string
  authorName: string
  authorHandle: string
  /** ISO date (the day, as X prints it), or null when it could not be read. */
  postedAt: string | null
  /** Language X detected for the text (`lang` on the quote), or null. */
  lang: string | null
}

const STATUS_URL =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})(?:[/?#].*)?$/i

/** `https://x.com/<handle>/status/<id>` for any x.com / twitter.com post link, else null. */
export const normalizeXUrl = (input: string | null | undefined): string | null => {
  const match = (input ?? '').trim().match(STATUS_URL)
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : null
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
}

const decode = (text: string): string =>
  text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, code: string) => {
    const named = ENTITIES[code.toLowerCase()]
    if (named) return named
    if (code[0] !== '#') return match
    const n =
      code[1] === 'x' || code[1] === 'X'
        ? Number.parseInt(code.slice(2), 16)
        : Number(code.slice(1))
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
  })

type OEmbed = { html?: unknown; author_name?: unknown; author_url?: unknown; url?: unknown }

/** Reads the post out of an oEmbed response; null when it has no text. */
export const parseOEmbed = (body: OEmbed, url: string): XPost | null => {
  const html = typeof body.html === 'string' ? body.html : ''
  const quote = html.match(/<p\b([^>]*)>([\s\S]*?)<\/p>/i)
  if (!quote) return null
  const lang = quote[1]?.match(/\blang="([^"]+)"/i)?.[1] ?? null
  const text = decode(
    (quote[2] ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      // Attached media show up as a pic.twitter.com link; the card has no images.
      .replace(/<a\b[^>]*>\s*pic\.(?:twitter|x)\.com\/[^<]*<\/a>/gi, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  if (!text) return null

  // "&mdash; Name (@handle) <a href=…/status/…>November 3, 2026</a>"
  const dateText = html.match(/<a\b[^>]*\/status\/\d+[^>]*>([^<]+)<\/a>\s*<\/blockquote>/i)?.[1]
  const day = dateText ? Date.parse(`${decode(dateText)} UTC`) : Number.NaN
  const authorUrl = typeof body.author_url === 'string' ? body.author_url : ''
  const handle =
    authorUrl.match(/\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] ?? normalizeXUrl(url)?.split('/')[3] ?? ''

  return {
    url: normalizeXUrl(url) ?? url,
    text,
    authorName: typeof body.author_name === 'string' ? decode(body.author_name).trim() : handle,
    authorHandle: handle,
    postedAt: Number.isFinite(day) ? new Date(day).toISOString().slice(0, 10) : null,
    lang: lang && lang !== 'zxx' && lang !== 'und' ? lang : null,
  }
}

/** Looks a post up on X; null when the link is not a post or X does not answer. */
export const fetchXPost = async (
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<XPost | null> => {
  const url = normalizeXUrl(input)
  if (!url) return null
  const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`
  try {
    const res = await fetchImpl(endpoint, {
      headers: { Accept: 'application/json', 'User-Agent': 'athena-cms' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return parseOEmbed((await res.json()) as OEmbed, url)
  } catch {
    return null
  }
}
