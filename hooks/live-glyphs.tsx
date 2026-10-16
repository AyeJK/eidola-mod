// Glyphs for the live drawings: one character a cell (8 × 19 px on desktop),
// each row a run of Boxes, one per stretch of one colour, its characters a
// Text inside. A run's Box holds its width whatever the font makes of a
// glyph, so a wide one can never push the rest of its row out of line.

import type { ClientElements, RenderElement } from 'claude-code'

/**
 * Characters a frame may hold in its tree, as measured here: the page counts
 * more than this measure does, so it stays far inside the 100,000 bound.
 */
export const GLYPH_BUDGET = 60_000

/**
 * The cell at column `x` of row `y`: its colour (from at most `levels`
 * shades) and its character; undefined for nothing.
 */
export type GlyphAt = (x: number, y: number, levels: number) => readonly [string, string] | undefined

type Elements = Pick<ClientElements, 'Box' | 'Text'>

/**
 * The glyphs as one column of rows, within the budget: fewer shades if need
 * be, and past that, short runs merged into their neighbours' colour until
 * it fits. Whatever a frame holds, it is never drawn past the bound.
 */
export function drawGlyphs({ Box, Text }: Elements, cols: number, rows: number, glyphAt: GlyphAt) {
  const draw = (levels: number, minRun: number) => {
    const out: RenderElement[] = []
    let size = 0
    let empty = 0
    for (let y = 0; y < rows; y += 1) {
      const runs: RenderElement[] = []
      let start = 0
      let colour = ''
      let text = ''
      const flush = (end: number) => {
        if (end > start) {
          if (colour) {
            runs.push(
              <Box width={end - start}>
                <Text color={colour} wrap="truncate">
                  {text}
                </Text>
              </Box>,
            )
            size += 115 + text.length
          } else {
            runs.push(<Box width={end - start} />)
            size += 50
          }
        }
      }
      for (let x = 0; x < cols; x += 1) {
        const cell = glyphAt(x, y, levels)
        const c = cell ? cell[0] : ''
        if (c !== colour) {
          if (minRun > 1 && x - start < minRun) {
            // Too short to stand alone: it joins the run, in the run's colour.
            colour ||= c
          } else {
            flush(x)
            start = x
            colour = c
            text = ''
          }
        }
        // A space keeps the glyphs after an empty cell in their columns.
        text += cell ? cell[1] : ' '
      }
      if (colour) {
        flush(cols)
      }
      if (!runs.length) {
        empty += 1
        continue
      }
      if (empty) {
        out.push(<Box height={empty} />)
        empty = 0
      }
      out.push(
        <Box flexDirection="row" height={1}>
          {runs}
        </Box>,
      )
      size += 70
    }
    return { out, size }
  }
  // Measured, not estimated: a frame past the bound is never drawn at all.
  const measure = (d: { out: RenderElement[]; size: number }) => {
    try {
      return JSON.stringify(d.out).length
    } catch {
      return d.size
    }
  }
  let drawn = draw(6, 1)
  for (const [levels, minRun] of [
    [4, 1],
    [3, 1],
    [2, 1],
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 5],
    [1, 8],
    [1, 13],
  ] as const) {
    if (measure(drawn) <= GLYPH_BUDGET) {
      break
    }
    drawn = draw(levels, minRun)
  }
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {drawn.out}
    </Box>
  )
}
