import { describe, expect, test } from 'bun:test'

import { fillXPicks } from '../Site/hooks/fillXPicks'
import { fetchXPost, normalizeXUrl, parseOEmbed, type XPost } from './oembed'

// Shape of publish.twitter.com/oembed?omit_script=1 (text and names invented).
const OEMBED = {
  url: 'https://twitter.com/hoo_dev/status/1854000000000000001',
  author_name: 'Hoo &amp; friends',
  author_url: 'https://twitter.com/hoo_dev',
  html: '<blockquote class="twitter-tweet" data-dnt="true"><p lang="en" dir="ltr">Shipped a CLI view &amp; an ADE view.<br><br>Try <a href="https://t.co/abc">whoa.me</a> &lt;3 <a href="https://t.co/pic">pic.twitter.com/xyz</a></p>&mdash; Hoo &amp; friends (@hoo_dev) <a href="https://twitter.com/hoo_dev/status/1854000000000000001?ref_src=twsrc%5Etfw">November 3, 2026</a></blockquote>\n',
}

describe('TC-U-26 normalizeXUrl', () => {
  test('accepts x.com, twitter.com and mobile links, drops query and extra path', () => {
    expect(normalizeXUrl('https://x.com/hoo_dev/status/123')).toBe(
      'https://x.com/hoo_dev/status/123',
    )
    expect(normalizeXUrl(' https://twitter.com/hoo_dev/status/123?s=20 ')).toBe(
      'https://x.com/hoo_dev/status/123',
    )
    expect(normalizeXUrl('https://mobile.twitter.com/hoo_dev/statuses/123/photo/1')).toBe(
      'https://x.com/hoo_dev/status/123',
    )
    expect(normalizeXUrl('http://www.x.com/Hoo_Dev/status/9#m')).toBe(
      'https://x.com/Hoo_Dev/status/9',
    )
  })

  test('rejects anything that is not a post', () => {
    for (const bad of [
      '',
      null,
      undefined,
      'https://x.com/hoo_dev',
      'https://x.com/hoo_dev/status/abc',
      'https://evil.com/x.com/hoo_dev/status/1',
      'https://x.com.evil.com/hoo_dev/status/1',
      'javascript:alert(1)//x.com/a/status/1',
    ]) {
      expect(normalizeXUrl(bad)).toBeNull()
    }
  })
})

describe('TC-U-27 parseOEmbed', () => {
  test('reads text, author, handle, day and language', () => {
    expect(parseOEmbed(OEMBED, 'https://twitter.com/hoo_dev/status/1854000000000000001')).toEqual({
      url: 'https://x.com/hoo_dev/status/1854000000000000001',
      text: 'Shipped a CLI view & an ADE view.\n\nTry whoa.me <3',
      authorName: 'Hoo & friends',
      authorHandle: 'hoo_dev',
      postedAt: '2026-11-03',
      lang: 'en',
    })
  })

  test('keeps Japanese text and drops an undetermined language', () => {
    const post = parseOEmbed(
      {
        author_name: 'フー',
        author_url: 'https://twitter.com/hoo_dev',
        html: '<blockquote><p lang="zxx" dir="ltr">新しい&#12469;&#x30A4;&#x30C8;</p>&mdash; フー (@hoo_dev) <a href="https://twitter.com/hoo_dev/status/7">not a date</a></blockquote>',
      },
      'https://x.com/hoo_dev/status/7',
    )
    expect(post?.text).toBe('新しいサイト')
    expect(post?.lang).toBeNull()
    expect(post?.postedAt).toBeNull()
  })

  test('returns null without a quote or text', () => {
    expect(parseOEmbed({}, 'https://x.com/a/status/1')).toBeNull()
    expect(
      parseOEmbed(
        { html: '<blockquote><p> <a>pic.twitter.com/x</a></p></blockquote>' },
        'https://x.com/a/status/1',
      ),
    ).toBeNull()
  })
})

describe('TC-U-28 fetchXPost', () => {
  test('asks oEmbed for the canonical link without the widget script or tracking', async () => {
    let asked = ''
    const post = await fetchXPost(
      'https://twitter.com/hoo_dev/status/1854000000000000001?s=20',
      (async (input: string | URL | Request) => {
        asked = String(input)
        return Response.json(OEMBED)
      }) as typeof fetch,
    )
    const endpoint = new URL(asked)
    expect(endpoint.origin + endpoint.pathname).toBe('https://publish.twitter.com/oembed')
    expect(endpoint.searchParams.get('url')).toBe(
      'https://x.com/hoo_dev/status/1854000000000000001',
    )
    expect(endpoint.searchParams.get('omit_script')).toBe('1')
    expect(endpoint.searchParams.get('dnt')).toBe('true')
    expect(post?.authorHandle).toBe('hoo_dev')
  })

  test('returns null on a bad link, an error status or a network failure', async () => {
    const never = (async () => {
      throw new Error('should not fetch')
    }) as unknown as typeof fetch
    expect(await fetchXPost('https://example.com/post/1', never)).toBeNull()
    expect(
      await fetchXPost(
        'https://x.com/a/status/1',
        (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
      ),
    ).toBeNull()
    expect(await fetchXPost('https://x.com/a/status/1', never)).toBeNull()
  })
})

describe('TC-U-29 fillXPicks (Site beforeChange)', () => {
  const POST: XPost = {
    url: 'https://x.com/hoo_dev/status/2',
    text: 'from X',
    authorName: 'Hoo',
    authorHandle: 'hoo_dev',
    postedAt: '2026-11-03',
    lang: 'en',
  }
  const run = async (picks: unknown[], original: unknown[] = [], post: XPost | null = POST) => {
    const asked: string[] = []
    const hook = fillXPicks(async (url) => {
      asked.push(url)
      return post
    })
    // biome-ignore lint/suspicious/noExplicitAny: the hook only reads data/originalDoc
    const out = (await hook({ data: { picks }, originalDoc: { picks: original } } as any)) as {
      picks: Record<string, unknown>[]
    }
    return { picks: out.picks, asked }
  }

  test('fills a new pick and normalizes its link', async () => {
    const { picks, asked } = await run([
      { id: 'a', url: 'https://twitter.com/hoo_dev/status/2?s=1', note: 'why' },
    ])
    expect(asked).toEqual(['https://x.com/hoo_dev/status/2'])
    expect(picks[0]).toMatchObject({
      url: 'https://x.com/hoo_dev/status/2',
      note: 'why',
      text: 'from X',
      authorHandle: 'hoo_dev',
      postedAt: '2026-11-03',
      lang: 'en',
    })
  })

  test('keeps edited text and does not ask X again', async () => {
    const pick = {
      id: 'a',
      url: 'https://x.com/hoo_dev/status/2',
      text: 'shortened',
      authorName: 'Me',
    }
    const { picks, asked } = await run([pick], [pick])
    expect(asked).toEqual([])
    expect(picks[0]).toMatchObject({ text: 'shortened', authorName: 'Me' })
  })

  test('re-reads a pick whose link changed, replacing the old post', async () => {
    const { picks, asked } = await run(
      [
        {
          id: 'a',
          url: 'https://x.com/hoo_dev/status/2',
          text: 'old',
          authorName: 'Old',
          postedAt: '2020-01-01',
        },
      ],
      [{ id: 'a', url: 'https://x.com/other/status/1' }],
    )
    expect(asked).toHaveLength(1)
    expect(picks[0]).toMatchObject({ text: 'from X', authorName: 'Hoo', postedAt: '2026-11-03' })
  })

  test('rejects the save when X does not answer and there is no text', async () => {
    await expect(
      run([{ id: 'a', url: 'https://x.com/hoo_dev/status/2' }], [], null),
    ).rejects.toThrow(/Could not read https:\/\/x\.com\/hoo_dev\/status\/2/)
  })

  test('keeps hand-written text when X does not answer', async () => {
    const { picks } = await run(
      [{ id: 'a', url: 'https://x.com/hoo_dev/status/2', text: 'typed' }],
      [],
      null,
    )
    expect(picks[0]?.text).toBe('typed')
  })
})
