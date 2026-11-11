import { describe, expect, test } from 'bun:test'

import { buildLlmsTxt, llmsLine } from './llms'

const site = { siteName: 'whoa.me', description: 'A blog.', intro: 'Hi, I build things.', welcome: 'Welcome' }

describe('llms.txt', () => {
  const text = buildLlmsTxt({
    origin: 'https://whoa.me',
    site,
    posts: [{ slug: 'p1', title: 'First [post]', meta: { description: 'Line one\nline two' } }, { slug: null, title: 'skip' }],
    work: [{ slug: 'athena', title: 'athena', description: 'This site.' }],
  })

  test('TC-U-06 starts with the site name and summary, never the template name', () => {
    expect(text.startsWith('# whoa.me\n\n> A blog.\n')).toBe(true)
    expect(text).not.toContain('Payload Website Template')
    expect(text).not.toContain('findb.uk')
  })

  test('TC-U-07 lists sections, posts and projects with absolute URLs', () => {
    expect(text).toContain('## Main sections')
    expect(text).toContain('- [First post](https://whoa.me/posts/p1): Line one line two')
    expect(text).not.toContain('skip')
    expect(text).toContain('- [athena](https://whoa.me/work/athena): This site.')
    expect(text).toContain('JP (https://whoa.me/ja)')
    expect(text.endsWith('\n')).toBe(true)
  })

  test('TC-U-08 drops empty sections', () => {
    const empty = buildLlmsTxt({ origin: 'https://whoa.me', site, posts: [], work: [] })
    expect(empty).not.toContain('## Recent posts')
    expect(empty).not.toContain('## Projects')
  })

  test('TC-U-09 llmsLine flattens whitespace and brackets', () => {
    expect(llmsLine(' a\n\tb [c] ')).toBe('a b c')
    expect(llmsLine(null)).toBe('')
  })
})
