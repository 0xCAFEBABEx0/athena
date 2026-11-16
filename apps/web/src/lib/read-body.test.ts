import { describe, expect, test } from 'bun:test'

import { readBody } from './read-body'

describe('TC-U-64 request body limit', () => {
  const post = (body: BodyInit, headers: Record<string, string> = {}) =>
    new Request('https://web.example/api/ai/ask', { method: 'POST', body, headers })

  test('reads a body up to the limit, in bytes, and stops past it', async () => {
    expect(await readBody(post('{"q":"hi"}'), 2_048)).toBe('{"q":"hi"}')
    // 700 Japanese characters are 2,100 bytes: over a 2,048-byte limit though only 700 characters.
    expect(await readBody(post('あ'.repeat(700)), 2_048)).toBeNull()
    expect(await readBody(post('a'.repeat(2_048)), 2_048)).toBe('a'.repeat(2_048))
  })

  test('a streamed body is cut off once it passes the limit', async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        controller.enqueue(new Uint8Array(1_024))
        if (pulled > 100) controller.close()
      },
    })
    expect(await readBody(post(stream), 2_048)).toBeNull()
    expect(pulled).toBeLessThan(10)
  })

  test('a declared length over the limit is refused without reading', async () => {
    expect(await readBody(post('{}', { 'content-length': '999999' }), 2_048)).toBeNull()
  })
})
