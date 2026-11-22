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

describe('TC-U-67 AI index: tables', () => {
  const cell = (value: string, headerState = 0, ...more: unknown[]) => ({
    type: 'tablecell',
    headerState,
    children: [paragraph(text(value)), ...more],
  })
  const row = (...cells: unknown[]) => ({ type: 'tablerow', children: cells })
  const table = (...rows: unknown[]) => ({ type: 'table', children: rows })

  test('a table becomes Markdown rows: header row, separator, one line per row; "|" escaped, empty rows dropped', () => {
    const value = root(
      heading('Plans'),
      table(
        row(cell('Plan', 1), cell('Price', 1)),
        row(cell('Hobby'), cell('$0', 0, paragraph(text('forever')))),
        row(cell(' '), cell('')),
        row(cell('a|b'), cell('Line one\nline two')),
      ),
    )
    expect(lexicalToSections(value)).toEqual([
      {
        heading: 'Plans',
        paragraphs: ['| Plan | Price |\n| --- | --- |\n| Hobby | $0 forever |\n| a\\|b | Line one line two |'],
      },
    ])
  })

  test('a table without header rows has no separator; a corner cell (row + column header) still counts as header', () => {
    const plain = root(table(row(cell('a'), cell('b')), row(cell('c'), cell('d'))))
    expect(lexicalToSections(plain)[0]?.paragraphs).toEqual(['| a | b |\n| c | d |'])
    const corner = root(table(row(cell('', 3), cell('Q1', 1)), row(cell('Sales', 2), cell('10'))))
    expect(lexicalToSections(corner)[0]?.paragraphs).toEqual(['|  | Q1 |\n| --- | --- |\n| Sales | 10 |'])
  })

  test('a long table is cut into parts that each repeat the header rows and fit in one chunk', () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(cell(`Service number ${i}`), cell(`Notes about service ${i} and its limits`)),
    )
    const sections = lexicalToSections(root(table(row(cell('Service', 1), cell('Notes', 1)), ...rows)))
    const parts = sections[0]?.paragraphs ?? []
    expect(parts.length).toBeGreaterThan(2)
    for (const part of parts) {
      expect(part.startsWith('| Service | Notes |\n| --- | --- |\n')).toBe(true)
      expect(approxTokens(part)).toBeLessThanOrEqual(300)
    }
    expect(parts.join('\n')).toContain('| Service number 59 |')
    const chunks = buildChunks({ title: 'T', sections })
    for (const chunk of chunks) expect(chunk.content.startsWith('| Service | Notes |')).toBe(true)
  })

  test('merged cells repeat in every position they cover, so values stay under their headers', () => {
    const value = root(
      table(
        row(cell('Plan', 1), cell('Price', 1), cell('Limit', 1)),
        row({ ...cell('Hobby'), rowSpan: 2 }, cell('$0'), cell('1 build')),
        row(cell('$5'), cell('2 builds')),
        row(cell('Pro'), { ...cell('Ask us'), colSpan: 2 }),
        row({ ...cell('Odd'), colSpan: 1.5, rowSpan: -1 }),
      ),
    )
    expect(lexicalToSections(value)[0]?.paragraphs).toEqual([
      [
        '| Plan | Price | Limit |',
        '| --- | --- | --- |',
        '| Hobby | $0 | 1 build |',
        '| Hobby | $5 | 2 builds |',
        '| Pro | Ask us | Ask us |',
        '| Odd |  |  |',
      ].join('\n'),
    ])
  })

  test('a row too long for one part is split by cell: each piece keeps its column header and the row label', () => {
    const notes = Array.from({ length: 80 }, (_, i) => `Sentence ${i} about the plan limits.`).join(' ')
    const ja = 'とても長いメモです'.repeat(120)
    const sections = lexicalToSections(
      root(
        table(
          row(cell('Plan', 1), cell('Price', 1), cell('Notes', 1)),
          row(cell('Hobby'), cell('$0'), cell(notes)),
          row(cell('Pro'), cell('$20'), cell(ja)),
        ),
      ),
    )
    const parts = sections[0]?.paragraphs ?? []
    expect(parts.length).toBeGreaterThan(3)
    for (const part of parts) {
      expect(part.startsWith('| Plan | Price | Notes |\n| --- | --- | --- |\n')).toBe(true)
      expect(approxTokens(part)).toBeLessThanOrEqual(300)
    }
    const lines = parts.flatMap((part) => part.split('\n').slice(2))
    expect(lines[0]).toBe('| Hobby | $0 |  |')
    const hobby = lines.filter((line) => line.startsWith('| Hobby |  | Sentence'))
    expect(hobby.length).toBeGreaterThan(1)
    expect(hobby.join(' ')).toContain('Sentence 79 about the plan limits.')
    expect(lines).toContain('| Pro | $20 |  |')
    const pro = lines.filter((line) => line.startsWith('| Pro |  | '))
    expect(pro.length).toBeGreaterThan(1)
    expect(pro.map((line) => line.slice('| Pro |  | '.length, -2)).join('')).toBe(ja)
    // No chunk loses the table: every one still opens with the header row.
    for (const chunk of buildChunks({ title: 'T', sections })) {
      expect(chunk.content.startsWith('| Plan | Price | Notes |')).toBe(true)
    }
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
