import { describe, expect, test } from 'bun:test'

import { OWL_FRAMES, OWL_HEIGHT, OWL_WIDTH, owlPaths, type OwlFrame } from './owl'

describe('Hoo sprite', () => {
  const frames = Object.keys(OWL_FRAMES) as OwlFrame[]

  test('TC-U-16 has the four frames the banner animates', () => {
    expect(frames.sort()).toEqual(['awake', 'sleep', 'wave', 'wink'])
  })

  test('TC-U-17 every frame is 30 × 27', () => {
    for (const frame of frames) {
      const rows = OWL_FRAMES[frame] as readonly string[]
      expect(rows.length).toBe(OWL_HEIGHT)
      for (const row of rows) expect(row.length).toBe(OWL_WIDTH)
    }
  })

  test('TC-U-18 paths cover every coloured pixel with one path per colour', () => {
    for (const frame of frames) {
      const paths = owlPaths(frame)
      const colours = paths.map((path) => path.color)
      expect(new Set(colours).size).toBe(colours.length)
      expect(paths.every((path) => /^M\d/.test(path.d))).toBe(true)
    }
  })
})
