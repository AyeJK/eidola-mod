// Pictures for the HUD frame: the state's name, drawn large.

/** The state's label, drawn large: its height in pixels (two cell rows). */
export const LABEL_PX = 34

/**
 * A 5 × 7 bitmap face for the `pixel` label: the letters the states' names
 * spell, a row a string, # lit.
 */
const BITMAP: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
}

/** The small label's height: one cell row. */
export const SMALL_LABEL_PX = 18

/**
 * The name in the bitmap face, its dots `dot` px square (5 × 7 to a letter):
 * one path of square dots, a letter's gap between, set `top` px down.
 */
function pixelText(name: string, colour: string, dot: number, top: number): { body: string; width: number } {
  let d = ''
  let x = 1
  for (const ch of name.toUpperCase()) {
    const glyph = BITMAP[ch]
    if (glyph) {
      glyph.forEach((row, y) => {
        for (let i = 0; i < row.length; i += 1) {
          if (row[i] === '#') {
            d += `M${x + i * dot} ${top + y * dot}h${dot}v${dot}h-${dot}z`
          }
        }
      })
    }
    x += 6 * dot
  }
  return { body: `<path fill="${colour}" shape-rendering="crispEdges" d="${d}"/>`, width: x }
}

/**
 * The state's name as a picture, large in its colour: text in a pane has one
 * size. `bold`, a heavy sans in capitals; `serif`, an old-style serif in
 * small capitals, as a grimoire heads its chapters; `pixel`, a bitmap face
 * of square dots, as a pixel spirit's.
 */
export function labelSvg(
  name: string,
  colour: string,
  style: 'bold' | 'serif' | 'pixel' = 'bold',
  size: 'large' | 'small' = 'large',
): { svg: string; width: number; height: number } {
  const isSmall = size === 'small'
  const height = isSmall ? SMALL_LABEL_PX : LABEL_PX
  const wrap = (body: string, width: number) => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`,
    width,
    height,
  })
  if (style === 'pixel') {
    // Large, dots of 4 px; small, of 2 px, the letters 14 px tall in an 18 px row.
    const { body, width } = isSmall ? pixelText(name, colour, 2, 2) : pixelText(name, colour, 4, 3)
    return wrap(body, width)
  }
  // Generous: wide letters (W, M, G) in a heavy face run past an average width.
  const k = isSmall ? 0.55 : 1
  const width = Math.ceil((name.length * 20 + 12) * k)
  const y = isSmall ? 14 : 26
  const text =
    style === 'serif'
      ? `<text x="1" y="${y}" font-family="'Cormorant Garamond','Garamond','Palatino Linotype','Book Antiqua',Georgia,serif" font-weight="700" font-size="${Math.round(27 * k)}" font-variant="small-caps" letter-spacing="${1.5 * k}" fill="${colour}">${name.charAt(0)}${name.slice(1).toLowerCase()}</text>`
      : `<text x="1" y="${y}" font-family="Inter,'Segoe UI',system-ui,sans-serif" font-weight="800" font-size="${Math.round(24 * k)}" letter-spacing="${1.2 * k}" fill="${colour}">${name}</text>`
  return wrap(text, width)
}
