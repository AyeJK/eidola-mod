// The pixel "Eidola" wordmark, as eidola.app sets it in a pixel face: baked
// here as one path of squares, since an `Svg` loads no web font. Desktop
// only; the terminal shows `EIDOLA` in bold gold.

/** The letters, 5 × 7, a row a string, # lit: a capital E and lowercase idola. */
const LETTERS: string[][] = [
  ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
]

/** One square of the face, in px. */
const DOT = 2
/** Squares from one letter's left edge to the next's: 5 and a gap. */
const ADVANCE = 6

/** The wordmark's size in px: about 9 cells wide, under a row tall. */
export const WORDMARK_WIDTH = (LETTERS.length * ADVANCE - 1) * DOT
export const WORDMARK_HEIGHT = 7 * DOT

/** Every lit run of each row as one rectangle of the path, baked once. */
const PATH = LETTERS.flatMap((rows, i) =>
  rows.flatMap((row, y) => {
    const runs: string[] = []
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '#') {
        continue
      }
      let end = x
      while (row[end + 1] === '#') {
        end += 1
      }
      runs.push(`M${(i * ADVANCE + x) * DOT} ${y * DOT}h${(end - x + 1) * DOT}v${DOT}h-${(end - x + 1) * DOT}z`)
      x = end
    }
    return runs
  }),
).join('')

/** The wordmark in a colour: one `Svg`, its letters one path. */
export function wordmarkSvg(colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}" width="${WORDMARK_WIDTH}" height="${WORDMARK_HEIGHT}" shape-rendering="crispEdges"><path fill="${colour}" d="${PATH}"/></svg>`
}
