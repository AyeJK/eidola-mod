// Pixels for the live drawings, shared by every live Engram: rows of Boxes,
// two to a cell row (8 × 9.5 px on desktop), a coloured Box per run of one
// colour and a bare Box for a gap. A frame that would hold too many Boxes is
// drawn again with fewer shades, then with pixels twice the size each way.

import type { ClientElements } from 'claude-code'

export const PX_W = 8
export const PX_H = 9.5
/** Boxes a frame may hold: about 60,000 characters, well inside the 100,000 bound. */
export const BOX_BUDGET = 700

/** #rrggbb as #rgb, nearest: a few characters less on every Box. */
export function short(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return '#' + [16, 8, 0].map(k => Math.round(((n >> k) & 255) / 17).toString(16)).join('')
}

/** One colour part way to another, as #rrggbb. */
export function mixHex(a: string, b: string, k: number): string {
  const ca = parseInt(a.slice(1), 16)
  const cb = parseInt(b.slice(1), 16)
  const channel = (shift: number) => Math.round(((ca >> shift) & 255) * (1 - k) + ((cb >> shift) & 255) * k)
  return '#' + ((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')
}

/** A ramp part way to another, shade by shade; the shorter one stretched to the longer. */
export function mixRamp(a: readonly string[], b: readonly string[], k: number): string[] {
  const n = Math.max(a.length, b.length)
  const at = (r: readonly string[], i: number) => r[Math.round((i * (r.length - 1)) / (n - 1))]!
  return Array.from({ length: n }, (_, i) => mixHex(at(a, i), at(b, i), k))
}

/** A shade for a brightness, from at most `levels` of a ramp. */
export function pick(ramp: readonly string[], v: number, levels: number): string {
  const n = Math.min(levels, ramp.length)
  const k = Math.min(n - 1, Math.max(0, Math.floor(v * n)))
  return ramp[n === 1 ? ramp.length - 1 : Math.round((k * (ramp.length - 1)) / (n - 1))]!
}

/**
 * The colour at pixel column `x` of pixel row `py` (two to a cell row), from
 * at most `levels` shades; '' for nothing. A coarse pass asks only for even
 * columns and rows.
 */
export type Colour = (x: number, py: number, levels: number) => string

type Box = ClientElements['Box']

/**
 * The pixels as one column of rows, within the Box budget. With a `focus`
 * (a cell row), detail is spent where it matters: full-size pixels from that
 * row outward for as far as the budget goes, and twice the size beyond it.
 */
export function drawPixels(Box: Box, cols: number, rows: number, colour: Colour, focus?: number, steady?: Steady) {
  /** One pixel row as Boxes: a bare Box per gap, a coloured one per run of one shade. */
  const pixelRow = (py: number, levels: number, step: number) => {
    const boxes = []
    let start = 0
    const at = (x: number) => colour(x - (x % step), py, levels)
    let c = at(0)
    for (let x = 1; x <= cols; x += 1) {
      const n = x < cols ? at(x) : '\u0000'
      if (n !== c) {
        if (c) {
          boxes.push(<Box width={x - start} backgroundColor={c} />)
        } else if (n !== '\u0000') {
          boxes.push(<Box width={x - start} />)
        }
        start = x
        c = n
      }
    }
    return boxes
  }

  // Full detail if it fits: 8 × 9.5 px pixels, two rows to a cell row. Else
  // fewer shades; and last, pixels twice as big each way (16 × 19 px, a row
  // to a cell row), so something up at the glass reads as pixel art zoomed in.
  const draw = (levels: number, isCoarse: boolean) => {
    const out = []
    let boxes = 0
    let empty = 0
    for (let y = 0; y < rows; y += 1) {
      const halves = isCoarse ? [pixelRow(y * 2, levels, 2)] : [pixelRow(y * 2, levels, 1), pixelRow(y * 2 + 1, levels, 1)]
      if (halves.every(h => !h.length)) {
        empty += 1
        continue
      }
      if (empty) {
        out.push(<Box height={empty} />)
        empty = 0
      }
      boxes += halves.reduce((sum, h) => sum + h.length, 0)
      out.push(
        isCoarse ? (
          <Box flexDirection="row" height={1} alignItems="stretch">
            {halves[0]}
          </Box>
        ) : (
          <Box flexDirection="column" height={1}>
            <Box flexDirection="row" height="50%" alignItems="stretch">
              {halves[0]}
            </Box>
            <Box flexDirection="row" height="50%" alignItems="stretch">
              {halves[1]}
            </Box>
          </Box>
        ),
      )
    }
    return { out, boxes }
  }
  if (focus !== undefined) {
    return focused(Box, cols, rows, pixelRow, focus)
  }
  if (steady) {
    return held(Box, cols, rows, draw, steady)
  }
  let drawn = draw(8, false)
  for (const [levels, isCoarse] of STEPS.slice(1)) {
    if (drawn.boxes <= BOX_BUDGET) {
      break
    }
    drawn = draw(levels, isCoarse)
  }
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {drawn.out}
    </Box>
  )
}

/** The ways a frame may be drawn, finest first: shades, and whether its pixels are doubled. */
const STEPS = [
  [8, false],
  [6, false],
  [4, false],
  [6, true],
  [4, true],
  [3, true],
] as const

/**
 * A drawing's memory of how fine it drew last, so it does not flicker:
 * deciding afresh each frame, one hovering at the budget flips between
 * resolutions several times a second.
 */
export type Steady = { step: number; calm: number }

/** Frames a drawing must fit comfortably before it tries a finer step again. */
const CALM = 25
/** How far under the budget a finer step must come to be taken. */
const ROOM = 0.82

type Draw = (levels: number, isCoarse: boolean) => { out: ReturnType<typeof h>[]; boxes: number }

/**
 * With hysteresis: coarser at once when a frame will not fit; finer only
 * once frames have fitted for a while and the finer one fits with room.
 */
function held(Box: Box, cols: number, rows: number, draw: Draw, steady: Steady) {
  let step = Math.min(Math.max(0, steady.step), STEPS.length - 1)
  const at = (i: number) => draw(STEPS[i]![0], STEPS[i]![1])
  let drawn = at(step)
  if (drawn.boxes > BOX_BUDGET) {
    while (drawn.boxes > BOX_BUDGET && step < STEPS.length - 1) {
      step += 1
      drawn = at(step)
    }
    steady.calm = 0
  } else if (step > 0 && ++steady.calm >= CALM) {
    const finer = at(step - 1)
    if (finer.boxes <= BOX_BUDGET * ROOM) {
      step -= 1
      drawn = finer
    }
    steady.calm = 0
  }
  steady.step = step
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {drawn.out}
    </Box>
  )
}

type PixelRow = (py: number, levels: number, step: number) => ReturnType<typeof h>[]

/** Full-size pixels round the focus row, coarse ones beyond it, within the budget. */
function focused(Box: Box, cols: number, rows: number, pixelRow: PixelRow, focus: number) {
  let chosen: Array<{ fine?: ReturnType<typeof h>[][]; coarse: ReturnType<typeof h>[] }> = []
  for (const levels of [8, 6, 4, 3]) {
    const coarse = Array.from({ length: rows }, (_, y) => pixelRow(y * 2, levels, 2))
    let total = coarse.reduce((sum, row) => sum + row.length, 0)
    chosen = coarse.map(row => ({ coarse: row }))
    if (total > BOX_BUDGET && levels > 3) {
      continue
    }
    // Outward from the focus, one row above and one below in turn, while it fits.
    const order = Array.from({ length: rows }, (_, y) => y).sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus))
    for (const y of order) {
      const fine = [pixelRow(y * 2, levels, 1), pixelRow(y * 2 + 1, levels, 1)]
      const more = fine[0]!.length + fine[1]!.length - coarse[y]!.length
      if (total + more > BOX_BUDGET) {
        break
      }
      total += more
      chosen[y]!.fine = fine
    }
    break
  }
  const out = []
  let empty = 0
  for (const row of chosen) {
    const isEmpty = row.fine ? row.fine.every(h => !h.length) : !row.coarse.length
    if (isEmpty) {
      empty += 1
      continue
    }
    if (empty) {
      out.push(<Box height={empty} />)
      empty = 0
    }
    out.push(
      row.fine ? (
        <Box flexDirection="column" height={1}>
          <Box flexDirection="row" height="50%" alignItems="stretch">
            {row.fine[0]}
          </Box>
          <Box flexDirection="row" height="50%" alignItems="stretch">
            {row.fine[1]}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="row" height={1} alignItems="stretch">
          {row.coarse}
        </Box>
      ),
    )
  }
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {out}
    </Box>
  )
}
