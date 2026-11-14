import { describe, expect, test } from 'bun:test'

import { frameAncestors, withFramePolicy } from './frame-policy'

describe('TC-U-62 frame policy', () => {
  test('only the site and the CMS (Live Preview) may frame a page', () => {
    expect(frameAncestors(() => 'https://cms.whoa.me/')).toBe("frame-ancestors 'self' https://cms.whoa.me")
    expect(frameAncestors(() => 'not a url')).toBe("frame-ancestors 'self'")
    expect(
      frameAncestors(() => {
        throw new Error('Missing CMS_URL')
      }),
    ).toBe("frame-ancestors 'self'")
  })

  test('set on HTML responses only; fixed headers are left alone', () => {
    const html = withFramePolicy(new Response('<p>', { headers: { 'content-type': 'text/html' } }), 'P')
    expect(html.headers.get('content-security-policy')).toBe('P')
    const json = withFramePolicy(Response.json({}), 'P')
    expect(json.headers.get('content-security-policy')).toBeNull()
    expect(() => withFramePolicy(Response.redirect('https://whoa.me/', 308), 'P')).not.toThrow()
  })
})
