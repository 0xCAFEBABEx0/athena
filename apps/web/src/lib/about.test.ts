import { describe, expect, test } from 'bun:test'

import type { About } from '@athena/shared/payload-types'

import { aboutHasContent, hasText, normalizeAbout } from './about'

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: text ? [{ type: 'text', version: 1, text }] : [],
})

const richText = (...children: object[]) =>
  ({
    root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children },
  }) as unknown as About['body']

describe('TC-U-49 About', () => {
  test('nothing to show: no lead and an empty story give a 404 (an empty editor still holds a paragraph)', () => {
    expect(aboutHasContent(normalizeAbout(null))).toBe(false)
    const empty = normalizeAbout({
      heading: 'Hi',
      lead: '   ',
      body: richText(paragraph(''), paragraph('  ')),
      portraitCaption: 'Tokyo',
    })
    expect(empty.body).toBeNull()
    expect(aboutHasContent(empty)).toBe(false)
  })

  test('a lead alone or a story alone is enough; text is trimmed', () => {
    const lead = normalizeAbout({ heading: '  Hi, I’m T.  ', lead: '  I build things.\nAnd write.  ' })
    expect(lead).toMatchObject({ heading: 'Hi, I’m T.', lead: 'I build things.\nAnd write.' })
    expect(aboutHasContent(lead)).toBe(true)

    const story = normalizeAbout({ body: richText(paragraph(''), paragraph('Background')) })
    expect(story.lead).toBe('')
    expect(story.body).not.toBeNull()
    expect(aboutHasContent(story)).toBe(true)
  })

  test('the portrait is used only when the CMS populated it with a file', () => {
    expect(normalizeAbout({ lead: 'x', portrait: 7 }).portrait).toBeNull()
    expect(
      normalizeAbout({ lead: 'x', portrait: { id: 7, url: null, updatedAt: '', createdAt: '' } })
        .portrait,
    ).toBeNull()
    const portrait = { id: 7, url: '/api/media/file/me.png', alt: 'Me', updatedAt: '', createdAt: '' }
    expect(normalizeAbout({ lead: 'x', portrait }).portrait).toEqual(portrait)
  })

  test('visible text is found in nested nodes; a rule counts, empty lists do not', () => {
    expect(hasText({ children: [{ type: 'list', children: [{ type: 'listitem', children: [] }] }] })).toBe(false)
    expect(
      hasText({ children: [{ type: 'list', children: [{ children: [{ text: 'Now' }] }] }] }),
    ).toBe(true)
    expect(hasText({ children: [{ type: 'horizontalrule' }] })).toBe(true)
    expect(hasText(null)).toBe(false)
  })
})
