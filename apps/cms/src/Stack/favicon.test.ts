import { describe, expect, test } from 'bun:test'

import type { PayloadRequest } from 'payload'

import {
  fetchFavicon,
  googleFaviconUrl,
  iconCandidates,
  publicHost,
  readCapped,
  type Favicon,
} from './favicon'
import { fillStackIcons, isFetchedIconOf, toPng } from './hooks/fillStackIcons'

const PNG_1PX = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

const respond = (body: BodyInit | null, init: ResponseInit & { url?: string } = {}) => {
  const res = new Response(body, init)
  if (init.url) Object.defineProperty(res, 'url', { value: init.url })
  return res
}

describe('TC-U-37 publicHost', () => {
  test('accepts public http(s) hosts', () => {
    expect(publicHost('https://astro.build/')).toBe('astro.build')
    expect(publicHost(' http://Example.COM/path ')).toBe('example.com')
    expect(publicHost('https://8.8.8.8/')).toBe('8.8.8.8')
  })

  test('refuses other schemes, credentials, local names and private addresses', () => {
    for (const url of [
      'ftp://example.com/',
      'javascript:alert(1)',
      'https://user:pw@example.com/',
      'http://localhost:3000/',
      'http://intranet/',
      'http://printer.local/',
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://172.20.1.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'not a url',
      '',
      null,
    ]) {
      expect(publicHost(url)).toBeNull()
    }
  })
})

describe('TC-U-38 iconCandidates', () => {
  test('SVG first, then PNG by size, then apple-touch-icon; .ico skipped; relative URLs resolved', () => {
    const html = `<head>
      <link rel="icon" href="/favicon.ico" sizes="any">
      <link rel="apple-touch-icon" href="/apple-touch-icon.png">
      <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">
      <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png?v=2&amp;x=1">
      <link rel="shortcut icon" href="https://cdn.example.com/mark.svg">
      <link rel="stylesheet" href="/style.css">
      <link rel="icon" href="javascript:alert(1)">
    </head>`
    expect(iconCandidates(html, 'https://example.com/docs/')).toEqual([
      'https://cdn.example.com/mark.svg',
      'https://example.com/docs/icons/icon-192.png?v=2&x=1',
      'https://example.com/icon-32.png',
      'https://example.com/apple-touch-icon.png',
    ])
  })

  test('nothing declared gives an empty list', () => {
    expect(
      iconCandidates('<html><head><title>x</title></head></html>', 'https://example.com/'),
    ).toEqual([])
  })
})

describe('TC-U-39 fetchFavicon', () => {
  test('a body without Content-Length stops being read past the limit', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        if (pulled > 100) controller.close()
        else controller.enqueue(new Uint8Array(1000))
      },
    })
    expect(await readCapped(new Response(stream), 2500)).toBeNull()
    expect(pulled).toBeLessThan(10)
    const small = await readCapped(new Response(new Uint8Array([1, 2, 3])), 2500)
    expect(small && Array.from(small)).toEqual([1, 2, 3])
    expect(await readCapped(new Response(''), 2500)).toBeNull()
    expect(
      await readCapped(new Response('x', { headers: { 'content-length': '9999' } }), 2500),
    ).toBeNull()
  })

  const okPng = async () => Buffer.from('png')

  test("uses the site's declared icon", async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (url === 'https://tool.example/') {
        return respond('<link rel="icon" type="image/png" href="/i.png">', {
          headers: { 'content-type': 'text/html' },
          url,
        })
      }
      if (url === 'https://tool.example/i.png')
        return respond(PNG_1PX, { headers: { 'content-type': 'image/png' } })
      return respond(null, { status: 404 })
    }) as typeof fetch
    const icon = await fetchFavicon('https://tool.example/', okPng, fetchImpl)
    expect(icon?.host).toBe('tool.example')
    expect(asked).toEqual(['https://tool.example/', 'https://tool.example/i.png'])
  })

  test('falls back to Google when the site declares nothing readable', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (url === googleFaviconUrl('tool.example')) {
        return respond(PNG_1PX, { headers: { 'content-type': 'image/png' } })
      }
      return respond('<link rel="icon" href="/favicon.ico">', {
        headers: { 'content-type': 'text/html' },
      })
    }) as typeof fetch
    const icon = await fetchFavicon('https://tool.example/', okPng, fetchImpl)
    expect(icon?.host).toBe('tool.example')
    expect(asked.at(-1)).toBe('https://www.google.com/s2/favicons?sz=64&domain=tool.example')
  })

  test('a redirect to a private address is not followed; non-images and failures give null', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (url === 'https://tool.example/') {
        return respond(null, { status: 302, headers: { location: 'http://169.254.169.254/' } })
      }
      return respond('<html>', { headers: { 'content-type': 'text/html' } })
    }) as typeof fetch
    expect(await fetchFavicon('https://tool.example/', okPng, fetchImpl)).toBeNull()
    expect(asked).not.toContain('http://169.254.169.254/')

    const failing = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await fetchFavicon('https://tool.example/', okPng, failing)).toBeNull()
    expect(await fetchFavicon('http://localhost/', okPng, failing)).toBeNull()
  })

  test('an image sharp cannot read is skipped', async () => {
    const fetchImpl = (async () =>
      respond(PNG_1PX, { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch
    expect(await fetchFavicon('https://tool.example/', async () => null, fetchImpl)).toBeNull()
  })
})

describe('TC-U-40 toPng', () => {
  test('makes a 64×64 PNG from a PNG and from an SVG; garbage gives null', async () => {
    const sharp = (await import('sharp')).default
    for (const input of [
      PNG_1PX,
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="5" fill="red"/></svg>',
      ),
    ]) {
      const out = await toPng(input)
      expect(out).not.toBeNull()
      const meta = await sharp(out as Buffer).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['png', 64, 64])
    }
    expect(await toPng(new TextEncoder().encode('not an image'))).toBeNull()
  })
})

describe('TC-U-41 Stack hook', () => {
  const req = { payload: { logger: { warn: () => {} } } } as unknown as PayloadRequest
  const icon: Favicon = { data: Buffer.from('png'), host: 'astro.build' }
  // Media 3 was fetched for old.example; media 9 was picked by hand.
  const filenames: Record<string, string> = { '3': 'favicon-old.example.png', '9': 'my-logo.png' }
  const run = async (
    data: unknown,
    originalDoc: unknown,
    lookup = async (_url: string) => icon,
  ) => {
    const asked: string[] = []
    const hook = fillStackIcons(
      async (url) => {
        asked.push(url)
        return lookup(url)
      },
      async (_req, found) => `media-${found.host}`,
      async (_req, id) => filenames[String(id)] ?? null,
    )
    const result = (await hook({ data, originalDoc, req } as never)) as {
      groups: { items: { icon: unknown }[] }[]
    }
    return { icons: result.groups.flatMap((g) => g.items.map((i) => i.icon)), asked }
  }

  test('fills a linked item without an icon; keeps a hand-picked icon; skips items without a link', async () => {
    const { icons, asked } = await run(
      {
        groups: [
          {
            items: [
              { id: 'a', name: 'Astro', url: 'https://astro.build/' },
              { id: 'b', name: 'Bun', url: 'https://bun.sh/', icon: 7 },
              { id: 'c', name: 'Notes', url: '' },
            ],
          },
        ],
      },
      undefined,
    )
    expect(icons).toEqual(['media-astro.build', 7, null])
    expect(asked).toEqual(['https://astro.build/'])
  })

  test('a link moved to another site replaces the icon fetched for the old one', async () => {
    const original = { groups: [{ items: [{ id: 'a', url: 'https://old.example/', icon: 3 }] }] }
    const { icons, asked } = await run(
      { groups: [{ items: [{ id: 'a', name: 'Astro', url: 'https://astro.build/', icon: 3 }] }] },
      original,
    )
    expect(icons).toEqual(['media-astro.build'])
    expect(asked).toEqual(['https://astro.build/'])

    const same = await run(
      {
        groups: [{ items: [{ id: 'a', name: 'Astro', url: 'https://old.example/docs', icon: 3 }] }],
      },
      original,
    )
    expect(same.icons).toEqual([3])
    expect(same.asked).toEqual([])

    // Link removed: the old site's icon goes too.
    const removed = await run(
      { groups: [{ items: [{ id: 'a', name: 'Astro', icon: 3 }] }] },
      original,
    )
    expect(removed.icons).toEqual([null])
    expect(removed.asked).toEqual([])
  })

  test('a hand-picked icon stays when the link moves to another site or is removed', async () => {
    const original = { groups: [{ items: [{ id: 'a', url: 'https://old.example/', icon: 9 }] }] }
    const moved = await run(
      { groups: [{ items: [{ id: 'a', name: 'Astro', url: 'https://astro.build/', icon: 9 }] }] },
      original,
    )
    expect(moved.icons).toEqual([9])
    expect(moved.asked).toEqual([])
    const removed = await run(
      { groups: [{ items: [{ id: 'a', name: 'Astro', icon: 9 }] }] },
      original,
    )
    expect(removed.icons).toEqual([9])
  })

  test('fetched icons are recognised by their Media filename', () => {
    expect(isFetchedIconOf('favicon-astro.build.png', 'astro.build')).toBe(true)
    expect(isFetchedIconOf('favicon-astro.build-1.png', 'astro.build')).toBe(true)
    expect(isFetchedIconOf('favicon-astroXbuild.png', 'astro.build')).toBe(false)
    expect(isFetchedIconOf('favicon-astro.build.png', 'bun.sh')).toBe(false)
    expect(isFetchedIconOf(null, 'astro.build')).toBe(false)
  })

  test('items on the same site share one lookup and one stored icon', async () => {
    const { icons, asked } = await run(
      {
        groups: [
          { items: [{ id: 'a', name: 'Astro', url: 'https://astro.build/' }] },
          { items: [{ id: 'b', name: 'Astro docs', url: 'https://astro.build/docs' }] },
        ],
      },
      undefined,
    )
    expect(icons).toEqual(['media-astro.build', 'media-astro.build'])
    expect(asked).toEqual(['https://astro.build/'])
  })

  test('no icon found (or a lookup error) saves without one instead of failing', async () => {
    const none = await run(
      { groups: [{ items: [{ id: 'a', name: 'X', url: 'https://x.example/' }] }] },
      undefined,
      async () => null as unknown as Favicon,
    )
    expect(none.icons).toEqual([null])
    const broken = await run(
      { groups: [{ items: [{ id: 'a', name: 'X', url: 'https://x.example/' }] }] },
      undefined,
      async () => {
        throw new Error('boom')
      },
    )
    expect(broken.icons).toEqual([null])
  })
})
