import { describe, expect, test } from 'bun:test'

import { buildChunks, approxTokens, chunkHash } from './chunk'
import { lexicalToSections } from './lexical'

const text = (value: string, format = 0) => ({ type: 'text', text: value, format })
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children })
const heading = (value: string) => ({ type: 'heading', tag: 'h2', children: [text(value)] })
const root = (...children: unknown[]) => ({ root: { type: 'root', children } })

describe('TC-U-52 AI index: rich text to sections', () => {
  test('splits at headings, keeps paragraphs, lists, links and code blocks as text', () => {
    const value = root(
      paragraph(text('Intro with a '), { type: 'link', children: [text('link')] }, text('.')),
      heading('Setup'),
      paragraph(text('Line one'), { type: 'linebreak' }, text('line two')),
      {
        type: 'list',
        children: [
          { type: 'listitem', children: [text('first')] },
          { type: 'listitem', children: [text('second')] },
        ],
      },
      { type: 'block', fields: { blockType: 'code', language: 'ts', code: 'const a = 1\n' } },
      { type: 'block', fields: { blockType: 'banner', content: root(paragraph(text('Banner note'))) } },
      { type: 'upload', value: { id: 1 } },
      { type: 'horizontalrule' },
      heading('   '),
      paragraph(text('   ')),
    )
    expect(lexicalToSections(value)).toEqual([
      { heading: null, paragraphs: ['Intro with a link.'] },
      {
        heading: 'Setup',
        paragraphs: ['Line one\nline two', '- first\n- second', '```ts\nconst a = 1\n```', 'Banner note'],
      },
    ])
  })

  test('empty, missing or malformed values give no sections', () => {
    expect(lexicalToSections(null)).toEqual([])
    expect(lexicalToSections({})).toEqual([])
    expect(lexicalToSections({ root: { children: 'nope' } })).toEqual([])
  })
})

describe('TC-U-53 AI index: chunks', () => {
  test('the description opens the first chunk; chunks never cross a heading; title and heading are embedded', () => {
    const chunks = buildChunks({
      title: 'Deploying',
      description: 'How I ship.',
      sections: [
        { heading: null, paragraphs: ['Short intro.'] },
        { heading: 'Steps', paragraphs: ['Build it.', 'Push it.'] },
      ],
    })
    expect(chunks.map((c) => [c.index, c.heading, c.content])).toEqual([
      [0, null, 'How I ship.'],
      [1, null, 'Short intro.'],
      [2, 'Steps', 'Build it.\n\nPush it.'],
    ])
    expect(chunks[2]?.embedText).toBe('Deploying\n\nSteps\n\nBuild it.\n\nPush it.')
  })

  test('long sections are packed into chunks of bounded size, splitting long paragraphs at sentence ends (CJK too)', () => {
    const en = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about deployments.`).join(' ')
    const ja = 'これは日本語の長い文章です。'.repeat(80)
    const chunks = buildChunks({ title: 'T', sections: [{ heading: 'A', paragraphs: [en, ja] }] })
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) expect(approxTokens(chunk.content)).toBeLessThanOrEqual(450)
    expect(chunks.map((c) => c.content).join('')).toContain('Sentence number 39')
    expect(chunks.at(-1)?.content.endsWith('です。')).toBe(true)
  })

  test('a post without body text still gets one chunk with its title', () => {
    expect(buildChunks({ title: 'Only a title', sections: [] }).map((c) => c.content)).toEqual(['Only a title'])
  })

  test('the hash changes with the text and with the model', () => {
    expect(chunkHash('a', 'm1')).toBe(chunkHash('a', 'm1'))
    expect(chunkHash('a', 'm1')).not.toBe(chunkHash('b', 'm1'))
    expect(chunkHash('a', 'm1')).not.toBe(chunkHash('a', 'm2'))
  })
})
