import { describe, expect, test } from 'bun:test'

import { SegmentCollector } from './segments'

const text = (value: string, format = 0) => ({ type: 'text', text: value, format })
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children })
const cell = (headerState: number, ...children: unknown[]) => ({
  type: 'tablecell',
  headerState,
  colSpan: 1,
  children,
})

describe('TC-U-68 Translate: tables', () => {
  test('each cell paragraph is its own segment; inline code and the table structure stay as they are', () => {
    const content = {
      root: {
        type: 'root',
        children: [
          {
            type: 'table',
            colWidths: [120, 240],
            children: [
              {
                type: 'tablerow',
                children: [cell(1, paragraph(text('Plan'))), cell(1, paragraph(text('Limit')))],
              },
              {
                type: 'tablerow',
                children: [
                  cell(0, paragraph(text('Hobby'))),
                  cell(
                    0,
                    paragraph(text('Run '), text('bun build', 16), text(' daily')),
                    paragraph(),
                  ),
                ],
              },
            ],
          },
        ],
      },
    }
    const before = JSON.parse(JSON.stringify(content))
    const collector = new SegmentCollector()
    collector.addTree(content)
    expect(collector.segments.map((s) => s.text)).toEqual([
      'Plan',
      'Limit',
      'Hobby',
      'Run ',
      ' daily',
    ])
    // "Run " and " daily" are one paragraph, so one group; every other cell has its own.
    const groups = collector.segments.map((s) => s.group)
    expect(new Set(groups).size).toBe(4)
    expect(groups[3]).toBe(groups[4])

    collector.apply(
      new Map([
        [0, 'プラン'],
        [1, '上限'],
        [2, 'Hobby'],
        [3, '毎日 '],
        [4, ' を実行'],
      ]),
    )
    const rows = content.root.children[0]?.children ?? []
    expect(rows[0]?.children[0]?.children[0]).toEqual(paragraph(text('プラン')))
    expect(rows[1]?.children[1]?.children[0]).toEqual(
      paragraph(text('毎日 '), text('bun build', 16), text(' を実行')),
    )
    // Everything but the text is unchanged.
    const strip = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value, (key, v) => (key === 'text' ? '' : v)))
    expect(strip(content)).toEqual(strip(before))
  })
})
