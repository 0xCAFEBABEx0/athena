import { describe, expect, test } from 'bun:test'

import type { Stack } from '@athena/shared/payload-types'

import { initialsOf, normalizeStack } from './stack'

describe('normalizeStack', () => {
  test('TC-U-42 empty or unreachable stack has no groups', () => {
    expect(normalizeStack(null)).toEqual({ intro: '', groups: [], former: [], count: 0 })
    expect(normalizeStack({ groups: [{ title: 'Empty', items: [] }] }).groups).toEqual([])
  })

  test('TC-U-43 items: links only http(s), years in range, icon absolute, former folded, empty groups dropped', () => {
    process.env.CMS_URL = 'https://cms.example'
    const stack = normalizeStack({
      intro: '  Tools  ',
      groups: [
        {
          title: ' Code ',
          description: 'What this site is made of',
          items: [
            {
              name: ' Astro ',
              url: 'https://astro.build/',
              note: ' The public site ',
              since: 2026,
              status: 'current',
              icon: {
                id: 1,
                url: 'https://blob.example/favicon-astro.build.png',
                updatedAt: '2026-11-12T00:00:00Z',
                createdAt: '',
              },
            },
            { name: 'Evil', url: 'javascript:alert(1)', since: 3000, status: 'trying', icon: 5 },
            { name: 'Local', url: '/stack', since: 2019.5, status: 'current' },
            { name: '', url: 'https://nameless.example/', status: 'current' },
            { name: 'ESLint', status: 'former', since: 2019 },
          ],
        },
        { title: 'Old', items: [{ name: 'webpack', status: 'former' }] },
      ],
    } as Partial<Stack>)

    expect(stack.intro).toBe('Tools')
    expect(stack.count).toBe(3)
    expect(stack.groups.map((g) => g.title)).toEqual(['Code'])
    const [astro, evil, local] = stack.groups[0]?.items ?? []
    expect(astro).toEqual({
      name: 'Astro',
      url: 'https://astro.build/',
      note: 'The public site',
      since: 2026,
      status: 'current',
      icon: 'https://blob.example/favicon-astro.build.png?2026-11-12T00%3A00%3A00Z',
      initials: 'A',
    })
    expect([evil?.url, evil?.since, evil?.status, evil?.icon]).toEqual([null, null, 'trying', null])
    expect([local?.url, local?.since]).toEqual([null, null])
    expect(stack.former.map((item) => item.name)).toEqual(['ESLint', 'webpack'])
  })

  test('TC-U-44 initials: first letters of up to two words', () => {
    expect(initialsOf('Claude Code')).toBe('CC')
    expect(initialsOf('TypeScript')).toBe('T')
    expect(initialsOf('daisyUI')).toBe('D')
    expect(initialsOf('LangChain / LangGraph')).toBe('LL')
    expect(initialsOf('cal.com')).toBe('CC')
    expect(initialsOf('思源')).toBe('思')
  })
})
