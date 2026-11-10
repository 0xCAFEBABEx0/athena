/**
 * Hoo, the CLI banner owl: 30 × 27 pixel sprites, one character per pixel
 * (designed in the banner thread, /mnt/project-files/redesign/banner/).
 *
 *   .  empty      W  body     S  wing      O  outline   G  glasses frame
 *   L  lens       K  eyes     I  eye glint  R  tuft     B  beak
 *   F  feet       H  ground shadow
 *
 * Rendered as SVG paths (one per color) with crispEdges, never text glyphs:
 * browsers draw block characters with seams. Colors live in global.css
 * (`.owl-W` …), with a dark-mode palette.
 */
export const OWL_WIDTH = 30
export const OWL_HEIGHT = 27

export const OWL_FRAMES = {
  sleep: [
    '...............RR.............',
    '.............RRR..............',
    '..............R...............',
    '........OOOOOOROOOOOOO........',
    '.......OWWWWWWRWWWWWWWO.......',
    '......OWWWWWWWWWWWWWWWWO......',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '....OWGGGGGWWWWWWWWWGGGGGO....',
    '...OGGGLLLGGGWWWWWGGGLLLGGG...',
    '...OGGLLLLLGGWWWWWGGLLLLLGG...',
    '...GGLLLLLLLGGWWWGGLLLLLLLGG..',
    '...GGLLLLLLLGGGGGGGLLLLLLLGG..',
    '...GGLKLLLKLGGWWWGGLKLLLKLGG..',
    '...GGLLKKKLLGGWWWGGLLKKKLLGG..',
    '..OGGLLLLLLLGGWWWGGLLLLLLLGGO.',
    '..OSGGLLLLLGGBBBBWGGLLLLLGGSO.',
    '..OSGGGLLLGGGWBBWWGGGLLLGGGSO.',
    '..OSSSGGGGGWWWWWWWWWGGGGGSSSO.',
    '..OSSSWWWWWWWWWWWWWWWWWWWSSSO.',
    '..OSSSWWWWWWWWWWWWWWWWWWWSSSO.',
    '...OOWWWWWWWWWWWWWWWWWWWWSSO..',
    '....OWWWWWWWWWWWWWWWWWWWWOO...',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '......OWWWWWWWWWWWWWWWWO......',
    '.......OOOOWWWWWWWWOOOO.......',
    '.........FFFOOOOOOOFFF........',
    '.....HHHHFFFFHHHHHHFFFFHH.....',
  ],
  awake: [
    '...............RR.............',
    '.............RRR..............',
    '..............R...............',
    '........OOOOOOROOOOOOO........',
    '.......OWWWWWWRWWWWWWWO.......',
    '......OWWWWWWWWWWWWWWWWO......',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '....OWGGGGGWWWWWWWWWGGGGGO....',
    '...OGGGLLLGGGWWWWWGGGLLLGGG...',
    '...OGGLLLLLGGWWWWWGGLLLLLGG...',
    '...GGLLKKLLLGGWWWGGLLKKLLLGG..',
    '...GGLKKIKLLGGGGGGGLKKIKLLGG..',
    '...GGLKKKKLLGGWWWGGLKKKKLLGG..',
    '...GGLLKKLLLGGWWWGGLLKKLLLGG..',
    '...GGLLLLLLLGGWWWGGLLLLLLLGGO.',
    '..OSGGLLLLLGGBBBBWGGLLLLLGGSO.',
    '.OSSGGGLLLGGGWBBWWGGGLLLGGGSO.',
    'OSSSSWGGGGGWWWWWWWWWGGGGGSSSO.',
    'SSSSWWWWWWWWWWWWWWWWWWWWWSSSO.',
    'OOOOWWWWWWWWWWWWWWWWWWWWWSSSO.',
    '....OWWWWWWWWWWWWWWWWWWWWSSO..',
    '....OWWWWWWWWWWWWWWWWWWWWOO...',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '......OWWWWWWWWWWWWWWWWO......',
    '.......OOOOWWWWWWWWOOOO.......',
    '.........FFFOOOOOOOFFF........',
    '.....HHHHFFFFHHHHHHFFFFHH.....',
  ],
  wave: [
    '...............RR.............',
    '.............RRR..............',
    '..............R...............',
    '........OOOOOOROOOOOOO........',
    '.......OWWWWWWRWWWWWWWO.......',
    '......OWWWWWWWWWWWWWWWWO......',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '....OWGGGGGWWWWWWWWWGGGGGO....',
    '...OGGGLLLGGGWWWWWGGGLLLGGG...',
    '...OGGLLLLLGGWWWWWGGLLLLLGG...',
    '...GGLLKKLLLGGWWWGGLLKKLLLGG..',
    '...GGLKKIKLLGGGGGGGLKKIKLLGG..',
    '..OGGLKKKKLLGGWWWGGLKKKKLLGG..',
    'OOSGGLLKKLLLGGWWWGGLLKKLLLGG..',
    'SSSGGLLLLLLLGGWWWGGLLLLLLLGGO.',
    'SSSSGGLLLLLGGBBBBWGGLLLLLGGSO.',
    'OSSOGGGLLLGGGWBBWWGGGLLLGGGSO.',
    '.OOOWWGGGGGWWWWWWWWWGGGGGSSSO.',
    '...OWWWWWWWWWWWWWWWWWWWWWSSSO.',
    '...OWWWWWWWWWWWWWWWWWWWWWSSSO.',
    '....OWWWWWWWWWWWWWWWWWWWWSSO..',
    '....OWWWWWWWWWWWWWWWWWWWWOO...',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '......OWWWWWWWWWWWWWWWWO......',
    '.......OOOOWWWWWWWWOOOO.......',
    '.........FFFOOOOOOOFFF........',
    '.....HHHHFFFFHHHHHHFFFFHH.....',
  ],
  wink: [
    '...............RR.............',
    '.............RRR..............',
    '..............R...............',
    '........OOOOOOROOOOOOO........',
    '.......OWWWWWWRWWWWWWWO.......',
    '......OWWWWWWWWWWWWWWWWO......',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '....OWGGGGGWWWWWWWWWGGGGGO....',
    '...OGGGLLLGGGWWWWWGGGLLLGGG...',
    '...OGGLLLLLGGWWWWWGGLLLLLGG...',
    '...GGLLKKLLLGGWWWGGLLLLLLLGG..',
    '...GGLKKIKLLGGGGGGGLLLLLLLGG..',
    '...GGLKKKKLLGGWWWGGLKLLLKLGG..',
    '...GGLLKKLLLGGWWWGGLLKKKLLGG..',
    '...GGLLLLLLLGGWWWGGLLLLLLLGGO.',
    '..OSGGLLLLLGGBBBBWGGLLLLLGGSO.',
    '.OSSGGGLLLGGGWBBWWGGGLLLGGGSO.',
    'OSSSSWGGGGGWWWWWWWWWGGGGGSSSO.',
    'SSSSWWWWWWWWWWWWWWWWWWWWWSSSO.',
    'OOOOWWWWWWWWWWWWWWWWWWWWWSSSO.',
    '....OWWWWWWWWWWWWWWWWWWWWSSO..',
    '....OWWWWWWWWWWWWWWWWWWWWOO...',
    '.....OWWWWWWWWWWWWWWWWWWO.....',
    '......OWWWWWWWWWWWWWWWWO......',
    '.......OOOOWWWWWWWWOOOO.......',
    '.........FFFOOOOOOOFFF........',
    '.....HHHHFFFFHHHHHHFFFFHH.....',
  ],
} as const

export type OwlFrame = keyof typeof OWL_FRAMES

/** One `<path d>` per color: each horizontal run of a color is a 1-pixel-tall rectangle. */
export const owlPaths = (frame: OwlFrame): { color: string; d: string }[] => {
  const runs = new Map<string, string[]>()
  OWL_FRAMES[frame].forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const color = row[x] ?? '.'
      let end = x + 1
      while (end < row.length && row[end] === color) end++
      if (color !== '.') {
        const list = runs.get(color) ?? []
        list.push(`M${x} ${y}h${end - x}v1h-${end - x}z`)
        runs.set(color, list)
      }
      x = end
    }
  })
  return [...runs].map(([color, parts]) => ({ color, d: parts.join('') }))
}
