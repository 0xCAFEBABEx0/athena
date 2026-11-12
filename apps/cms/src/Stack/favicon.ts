/**
 * Favicons for the Stack global. When an item is saved with a link and no
 * icon, the CMS reads the site's own icon (the largest PNG/SVG/WebP it
 * declares), falling back to Google's favicon service, turns it into a 64×64
 * PNG and stores it in Media (Vercel Blob). Visitors' browsers then load our
 * copy and never contact the tool's site or Google.
 *
 * Links come from signed-in editors only; still, only public http(s) hosts
 * are fetched, redirects are re-checked, and every response is size-capped.
 */

export const ICON_SIZE = 64

const MAX_HTML_BYTES = 1_000_000
const MAX_IMAGE_BYTES = 512_000
const TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
const MAX_CANDIDATES = 4

/** Hostname of a public http(s) URL, or null (non-http, IP-literal private hosts, localhost…). */
export const publicHost = (input: string | null | undefined): string | null => {
  let url: URL
  try {
    url = new URL((input ?? '').trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host || !host.includes('.')) return null
  if (host.startsWith('[')) return null // IPv6 literals are never needed for a tool's site
  if (/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host)) return null
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return null
    }
  }
  return host
}

const attr = (tag: string, name: string): string | null => {
  const match = tag.match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'),
  )
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null
}

const largestSize = (sizes: string | null): number => {
  if (!sizes) return 0
  if (/any/i.test(sizes)) return 1024
  return Math.max(0, ...sizes.split(/\s+/).map((s) => Number(s.split(/x/i)[0]) || 0))
}

/**
 * Icon URLs a page declares, best first: SVG (scales cleanly), then PNG/WebP
 * by declared size, then apple-touch-icon. `.ico` files are skipped (sharp
 * cannot read them); the Google fallback covers those sites.
 */
export const iconCandidates = (html: string, pageUrl: string): string[] => {
  const head = html.slice(0, 200_000)
  const found: { url: string; score: number }[] = []
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/)
    const href = attr(tag, 'href')
    if (!href) continue
    const isIcon = rel.includes('icon')
    const isTouch = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')
    if (!isIcon && !isTouch) continue
    let url: URL
    try {
      url = new URL(href.replace(/&amp;/g, '&'), pageUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    const type = (attr(tag, 'type') ?? '').toLowerCase()
    const path = url.pathname.toLowerCase()
    if (type.includes('icon') || path.endsWith('.ico')) continue
    const svg = type === 'image/svg+xml' || path.endsWith('.svg')
    const score = isTouch ? 100 : svg ? 2000 : 200 + largestSize(attr(tag, 'sizes'))
    found.push({ url: url.href, score })
  }
  const seen = new Set<string>()
  return found
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.url)
    .filter((url) => (seen.has(url) ? false : (seen.add(url), true)))
    .slice(0, MAX_CANDIDATES)
}

/** Google's favicon service (PNG); answers 404 when it has no icon for the host. */
export const googleFaviconUrl = (host: string): string =>
  `https://www.google.com/s2/favicons?sz=${ICON_SIZE}&domain=${encodeURIComponent(host)}`

type Fetch = typeof fetch

/** GET that refuses non-public hosts, also after a redirect. */
const safeGet = async (
  input: string,
  accept: string,
  fetchImpl: Fetch,
): Promise<Response | null> => {
  let url = input
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!publicHost(url)) return null
    const res = await fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': 'athena-cms (favicon)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return null
      url = new URL(location, url).href
      continue
    }
    return res.ok ? res : null
  }
  return null
}

/**
 * The body, or null when it is empty or larger than `max`. Reads the stream
 * and stops as soon as it passes `max`, so a response without
 * `Content-Length` (chunked) is never buffered whole.
 */
export const readCapped = async (res: Response, max: number): Promise<Uint8Array | null> => {
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > max || !res.body) {
    await res.body?.cancel().catch(() => {})
    return null
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  if (size === 0) return null
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export type Favicon = { data: Buffer; host: string }

/** Turns any image sharp can read (PNG, SVG, WebP, JPEG, GIF) into a square PNG; null if it cannot. */
export type ToPng = (image: Uint8Array) => Promise<Buffer | null>

/**
 * The site's favicon as a 64×64 PNG, or null when neither the site nor
 * Google has one we can read. Never throws.
 */
export const fetchFavicon = async (
  siteUrl: string,
  toPng: ToPng,
  fetchImpl: Fetch = fetch,
): Promise<Favicon | null> => {
  const host = publicHost(siteUrl)
  if (!host) return null

  let candidates: string[] = []
  try {
    const page = await safeGet(siteUrl, 'text/html', fetchImpl)
    if (page && (page.headers.get('content-type') ?? '').includes('html')) {
      const body = await readCapped(page, MAX_HTML_BYTES)
      if (body) candidates = iconCandidates(new TextDecoder().decode(body), page.url || siteUrl)
    }
  } catch {
    // The site's own page is optional; Google may still know its icon.
  }

  for (const url of [...candidates, googleFaviconUrl(host)]) {
    try {
      const res = await safeGet(url, 'image/*', fetchImpl)
      if (!res || !(res.headers.get('content-type') ?? '').startsWith('image/')) continue
      const image = await readCapped(res, MAX_IMAGE_BYTES)
      if (!image) continue
      const png = await toPng(image)
      if (png) return { data: png, host }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}
