import { describe, expect, test } from 'bun:test'

import type { PayloadRequest } from 'payload'

import {
  fetchFavicon,
  googleFaviconUrl,
  iconCandidates,
  isPrivateAddress,
  publicHost,
  readCapped,
  type Favicon,
} from './favicon'
import { fillStackIcons, isFetchedIconOf, mapLimit, toPng } from './hooks/fillStackIcons'

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
    expect(publicHost('https://example.com./')).toBe('example.com')
    // Neighbours of the refused special-purpose ranges stay public.
    for (const ip of [
      '198.17.255.255',
      '198.20.0.1',
      '192.0.3.1',
      '203.0.114.1',
      '172.32.0.1',
      '192.0.0.9',
      '192.0.0.10',
    ]) {
      expect(publicHost(`http://${ip}/`), ip).toBe(ip)
    }
  })

  test('refuses other schemes, credentials, local names and private addresses', () => {
    for (const url of [
      'ftp://example.com/',
      'javascript:alert(1)',
      'https://user:pw@example.com/',
      'http://localhost:3000/',
      'http://localhost./',
      'http://intranet/',
      'http://printer.local/',
      'http://printer.local./',
      'http://198.18.0.1/',
      'http://198.19.255.255/',
      'http://192.0.2.10/',
      'http://192.0.0.8/',
      'http://203.0.113.5/',
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
  // Every test host resolves to a public address; DNS answers are tested below.
  const dns = { resolve: async () => ['93.184.215.14'] }

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
    const icon = await fetchFavicon('https://tool.example/', okPng, fetchImpl, dns)
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
    const icon = await fetchFavicon('https://tool.example/', okPng, fetchImpl, dns)
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
    expect(await fetchFavicon('https://tool.example/', okPng, fetchImpl, dns)).toBeNull()
    expect(asked).not.toContain('http://169.254.169.254/')

    const failing = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await fetchFavicon('https://tool.example/', okPng, failing, dns)).toBeNull()
    expect(await fetchFavicon('http://localhost/', okPng, failing, dns)).toBeNull()
  })

  test('an image sharp cannot read is skipped', async () => {
    const fetchImpl = (async () =>
      respond(PNG_1PX, { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch
    expect(await fetchFavicon('https://tool.example/', async () => null, fetchImpl, dns)).toBeNull()
  })
})

describe('TC-U-37 / TC-U-39 favicon lookup: resolved addresses and time budget', () => {
  const okPng = async () => Buffer.from('png')
  const png = () => respond(PNG_1PX, { headers: { 'content-type': 'image/png' } })

  test('private, loopback, link-local and mapped addresses are recognised', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::',
      '::1',
      'fd00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['93.184.215.14', '8.8.8.8', '2606:4700::6810:84e5', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  test('a name that resolves to a private address is never fetched', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      asked.push(String(input))
      return png()
    }) as typeof fetch
    const resolve = async (host: string) =>
      host === '127.0.0.1.nip.io' ? ['127.0.0.1'] : ['93.184.215.14']
    expect(await fetchFavicon('http://127.0.0.1.nip.io/', okPng, fetchImpl, { resolve })).toBeNull()
    // Not even through Google: the lookup stops at the site itself.
    expect(asked).toEqual([])

    // One private answer among public ones is enough to refuse.
    const mixed = async () => ['93.184.215.14', '10.0.0.5']
    expect(
      await fetchFavicon('https://tool.example/', okPng, fetchImpl, { resolve: mixed }),
    ).toBeNull()
    expect(asked).toEqual([])

    // A name that does not resolve is not fetched either.
    const missing = async () => {
      throw new Error('ENOTFOUND')
    }
    expect(
      await fetchFavicon('https://tool.example/', okPng, fetchImpl, { resolve: missing }),
    ).toBeNull()
    expect(asked).toEqual([])
  })

  test('a redirect to a name that resolves privately is not followed', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      if (url === 'https://tool.example/')
        return respond(null, { status: 302, headers: { location: 'http://internal.example/' } })
      return respond('<html>', { headers: { 'content-type': 'text/html' } })
    }) as typeof fetch
    const resolve = async (host: string) =>
      host === 'internal.example' ? ['192.168.0.10'] : ['93.184.215.14']
    expect(await fetchFavicon('https://tool.example/', okPng, fetchImpl, { resolve })).toBeNull()
    expect(asked).not.toContain('http://internal.example/')
  })

  test('a stalled DNS lookup ends with the budget, and nothing is fetched', async () => {
    const asked: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      asked.push(String(input))
      return png()
    }) as typeof fetch
    const started = Date.now()
    const stalled = () => new Promise<string[]>(() => {})
    expect(
      await fetchFavicon('https://tool.example/', okPng, fetchImpl, {
        resolve: stalled,
        budgetMs: 80,
      }),
    ).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
    expect(asked).toEqual([])
  })

  test('the whole lookup stops when its time budget is spent', async () => {
    const asked: string[] = []
    const signals: AbortSignal[] = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input))
      if (init?.signal) signals.push(init.signal)
      await new Promise((resolve) => setTimeout(resolve, 40))
      if (String(input) === 'https://tool.example/') {
        return respond(
          '<link rel="icon" href="/a.svg"><link rel="icon" href="/b.svg"><link rel="icon" href="/c.svg">',
          { headers: { 'content-type': 'text/html' }, url: 'https://tool.example/' },
        )
      }
      return respond('not an image', { headers: { 'content-type': 'text/plain' } })
    }) as typeof fetch
    const started = Date.now()
    const icon = await fetchFavicon('https://tool.example/', okPng, fetchImpl, {
      resolve: async () => ['93.184.215.14'],
      budgetMs: 100,
    })
    expect(icon).toBeNull()
    // Page + 3 candidates + Google would be 5 requests; the budget allows about 3.
    expect(asked.length).toBeLessThan(5)
    expect(Date.now() - started).toBeLessThan(1000)
    expect(signals.length).toBe(asked.length)

    // No budget left: nothing is requested at all.
    asked.length = 0
    expect(
      await fetchFavicon('https://tool.example/', okPng, fetchImpl, {
        resolve: async () => ['93.184.215.14'],
        budgetMs: 0,
      }),
    ).toBeNull()
    expect(asked).toEqual([])
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
    save = async (_req: PayloadRequest, found: Favicon): Promise<number | string> =>
      `media-${found.host}`,
  ) => {
    const asked: string[] = []
    const hook = fillStackIcons(
      async (url) => {
        asked.push(url)
        return lookup(url)
      },
      save,
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
    const failedUpload = await run(
      { groups: [{ items: [{ id: 'a', name: 'X', url: 'https://x.example/' }] }] },
      undefined,
      undefined,
      async () => {
        throw new Error('blob down')
      },
    )
    expect(failedUpload.icons).toEqual([null])
  })

  test('all lookups of one save share one deadline; later sites wait for the next save', async () => {
    const budgets: number[] = []
    const hook = fillStackIcons(
      async (_url, budgetMs) => {
        budgets.push(budgetMs)
        await new Promise((resolve) => setTimeout(resolve, 60))
        return icon
      },
      async (_req, found) => `media-${found.host}`,
      async () => null,
      { lookupMs: 90, storeMs: 10_000 },
    )
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      name: `T${i}`,
      url: `https://site${i}.example/`,
    }))
    const started = Date.now()
    const result = (await hook({ data: { groups: [{ items }] }, req } as never)) as {
      groups: { items: { icon: unknown }[] }[]
    }
    // 4 at a time: the first two rounds start before the 90 ms deadline, the third after it.
    expect(budgets.length).toBe(8)
    expect(budgets.every((b) => b > 0 && b <= 90)).toBe(true)
    expect(Date.now() - started).toBeLessThan(1000)
    const icons = result.groups[0]?.items.map((i) => i.icon) ?? []
    expect(icons.filter(Boolean).length).toBe(8)
    expect(icons.slice(8)).toEqual([null, null, null, null])

    // No time left to store: the icons found are not saved, the save still goes through.
    const late = fillStackIcons(
      async () => icon,
      async () => {
        throw new Error('should not upload')
      },
      async () => null,
      { lookupMs: 10_000, storeMs: 0 },
    )
    const out = (await late({
      data: { groups: [{ items: items.slice(0, 2) }] },
      req,
    } as never)) as {
      groups: { items: { icon: unknown }[] }[]
    }
    expect(out.groups[0]?.items.map((i) => i.icon)).toEqual([null, null])
  })

  test('sites are looked up a few at a time, results kept in order', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    expect(peak).toBe(4)
    expect(await mapLimit([], 4, async (n: number) => n)).toEqual([])
  })
})
