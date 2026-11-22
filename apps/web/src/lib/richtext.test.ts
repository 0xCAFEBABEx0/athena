import { describe, expect, test } from 'bun:test'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { richTextToHTML } from './richtext'

const text = (value: string, format = 0) => ({ type: 'text', text: value, format, version: 1 })
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children, version: 1 })
const cell = (headerState: number, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'tablecell',
  headerState,
  colSpan: 1,
  rowSpan: 1,
  children,
  version: 1,
  ...extra,
})
const row = (...cells: unknown[]) => ({ type: 'tablerow', children: cells, version: 1 })
const table = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  type: 'table',
  children: rows,
  version: 1,
  ...extra,
})
const doc = (...children: unknown[]) =>
  ({ root: { type: 'root', children, version: 1 } }) as unknown as SerializedEditorState

/** The HTML without the converter's outer div and the whitespace between tags. */
const html = (data: SerializedEditorState, locale?: 'en' | 'ja' | 'zh') =>
  richTextToHTML(data, locale)
    .replace(/>\s+</g, '><')
    .trim()
    .replace(/^<div class="payload-richtext">([\s\S]*)<\/div>$/, '$1')

describe('TC-U-69 Rich text tables', () => {
  test('a table is a daisyUI table in a focusable scroll box: header row in thead, th with scope, no inline styles', () => {
    const out = html(
      doc(
        table([
          row(cell(1, [paragraph(text('Plan'))]), cell(1, [paragraph(text('Price'))])),
          row(cell(2, [paragraph(text('Hobby'))]), cell(0, [paragraph(text('$0', 1))])),
        ]),
      ),
    )
    expect(out).toBe(
      '<div class="rt-table not-prose" role="region" tabindex="0" aria-label="Table"><table class="table">' +
        '<thead><tr><th scope="col"><p>Plan</p></th><th scope="col"><p>Price</p></th></tr></thead>' +
        '<tbody><tr><th scope="row"><p>Hobby</p></th><td><p><strong>$0</strong></p></td></tr></tbody>' +
        '</table></div>',
    )
    expect(out).not.toContain('style=')
    expect(out).not.toContain('#ccc')
  })

  test('a cell with more than 24 characters gets rt-long (its column stays wide enough on phones)', () => {
    const out = html(
      doc(
        table([
          row(
            cell(0, [paragraph(text('Short'))]),
            cell(0, [paragraph(text('One build at a time, 100 deploys a day'))]),
            cell(0, [paragraph(text('二十四文字ちょうどの日本語の文章をここに書いておきます。'))]),
          ),
        ]),
      ),
    )
    expect(out).toContain('<td><p>Short</p></td>')
    expect(out).toContain('<td class="rt-long"><p>One build')
    expect(out).toContain('<td class="rt-long"><p>二十四')
  })

  test('the region label follows the page language', () => {
    const data = doc(table([row(cell(0, [paragraph(text('a'))]))]))
    expect(html(data, 'ja')).toContain('aria-label="表"')
    expect(html(data, 'zh')).toContain('aria-label="表格"')
  })

  test('merged cells keep colspan/rowspan; only whole numbers above 1 are written', () => {
    const out = html(
      doc(
        table([
          row(
            cell(0, [paragraph(text('wide'))], { colSpan: 2 }),
            cell(0, [paragraph(text('tall'))], { rowSpan: 3 }),
            cell(0, [paragraph(text('bad'))], { colSpan: '2" onclick="x', rowSpan: 1.5 }),
          ),
        ]),
      ),
    )
    expect(out).toContain('<td colspan="2"><p>wide</p></td>')
    expect(out).toContain('<td rowspan="3"><p>tall</p></td>')
    expect(out).toContain('<td><p>bad</p></td>')
    expect(out).not.toContain('onclick')
  })

  test('row striping and a frozen first column become classes; widths and background colors are dropped', () => {
    const out = html(
      doc(
        table([row(cell(0, [paragraph(text('a'))], { backgroundColor: 'red', width: 300 }))], {
          rowStriping: true,
          frozenColumnCount: 1,
          colWidths: [300],
        }),
      ),
    )
    expect(out).toContain('<table class="table table-zebra rt-table-frozen">')
    expect(out).not.toContain('red')
    expect(out).not.toContain('300')
    expect(out).not.toContain('<thead>')
  })

  test('cell text is escaped like any rich text; links in cells keep their href', () => {
    const out = html(
      doc(
        table([
          row(
            cell(0, [paragraph(text('<b>x</b>'))]),
            cell(0, [
              paragraph({
                type: 'link',
                fields: { linkType: 'custom', url: 'https://example.com/' },
                children: [text('site')],
                version: 1,
              }),
            ]),
          ),
        ]),
      ),
    )
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(out).toContain('href="https://example.com/"')
  })

  test('empty paragraphs right before or after a table are dropped; other empty paragraphs stay', () => {
    const t = table([row(cell(0, [paragraph(text('a'))]))])
    const out = html(
      doc(paragraph(), paragraph(text('x')), paragraph(), t, paragraph(), paragraph(text('y'))),
    )
    expect(out.replace(/<div class="rt-table[\s\S]*<\/table><\/div>/, '[table]')).toBe(
      '<p><br /></p><p>x</p>[table]<p>y</p>',
    )
  })

  test('an empty table renders nothing; text around it is untouched', () => {
    expect(html(doc(paragraph(text('before')), table([]), paragraph(text('after'))))).toBe(
      '<p>before</p><p>after</p>',
    )
  })
})
