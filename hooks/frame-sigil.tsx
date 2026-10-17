// The HUD's arcane sigil, top right: two rings turning against each other, a
// seven-pointed star between them, ticks round the rim like runes. A live
// drawing, as the recording is, so a new mood eases in: its colour fades and
// its turning quickens or slows over a couple of seconds, and the rings
// carry on from wherever they had turned to. Nothing is swapped, so nothing
// flashes.
//
// Drawn in Boxes, fine ones: each cell split four across and ten down, so a
// pixel is 2 × 1.9 px, square near enough for a ring to be round.

import type { ClientModule, RenderElement } from 'claude-code'

import { mixHex, short } from './live-pixels'

/** `level`: how busy it turns; `colour`: the colour it fades to. */
type Props = { colour: string; level: 'idle' | 'working' | 'attention'; cols: number; rows: number }

type Sigil = {
  colour: string
  /** Seconds a turn of the outer ring takes, eased toward the level's. */
  turn: number
  /** How far each ring has turned, in radians. */
  outer: number
  inner: number
  want: { colour: string; level: Props['level'] }
}
type State = { sigil: Sigil }

/** Seconds the outer ring takes to go round; the inner one takes 1.6 times as long, the other way. */
const TURNS = { idle: 40, working: 9, attention: 18 } as const
const TICK_MS = 100
const CW = 8
const CH = 19
/** Pixels a cell, across and down. */
const PX = 4
const PY = 10
/** What it is drawn over: the dark the Lich hangs in, near its top corner. */
const DARK = '#0c0506'

/** The distance from a point to the segment a→b. */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - dx * k, y - ay - dy * k)
}

/** How much ink a stroke `width` px wide leaves at `d` px from its line: 0 to 1. */
const stroke = (d: number, width: number) => Math.max(0, Math.min(1, width / 2 + 0.6 - d))

/** How strongly the sigil shows at a point (pixels from its centre), 0 to 1. */
function inkAt(x: number, y: number, R: number, sigil: Sigil): number {
  const r = Math.hypot(x, y)
  let ink = 0.7 * stroke(Math.abs(r - R), 1.3)
  ink = Math.max(ink, 0.45 * stroke(Math.abs(r - R * 0.72), 1.1))
  ink = Math.max(ink, 0.9 * stroke(Math.abs(r - R * 0.16), 1.1))
  // The ticks round the rim, turning with the outer ring: every third one long.
  if (r > R * 0.76 && r < R * 0.97) {
    const a = Math.atan2(y, x) - sigil.outer
    const step = (Math.PI * 2) / 21
    const n = Math.round(a / step)
    const reach = ((n % 3) + 3) % 3 === 0 ? R * 0.95 : R * 0.88
    if (r > R * 0.8 && r < reach) {
      ink = Math.max(ink, 0.7 * stroke(Math.abs(a - n * step) * r, 1.1))
    }
  }
  // The star, turning with the inner ring the other way: each point joined to the third one on.
  if (r < R * 0.7) {
    const p = (i: number) => {
      const a = -Math.PI / 2 + (i * Math.PI * 6) / 7 + sigil.inner
      return [R * 0.66 * Math.cos(a), R * 0.66 * Math.sin(a)] as const
    }
    let d = Infinity
    for (let i = 0; i < 7; i += 1) {
      const [ax, ay] = p(i)
      const [bx, by] = p(i + 1)
      d = Math.min(d, toSegment(x, y, ax, ay, bx, by))
    }
    ink = Math.max(ink, 0.85 * stroke(d, 1.2))
  }
  return ink
}

const FrameSigil: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (!state) {
    const sigil: Sigil = { colour: props.colour, turn: TURNS[props.level], outer: 0, inner: 0, want: { colour: props.colour, level: props.level } }
    state = { sigil }
    surface.every(TICK_MS, () => {
      // It turns on from where it is; only its pace and colour change, and those gently.
      sigil.turn += (TURNS[sigil.want.level] - sigil.turn) * 0.05
      sigil.colour = mixHex(sigil.colour, sigil.want.colour, 0.08)
      const dt = TICK_MS / 1000
      sigil.outer = (sigil.outer + (Math.PI * 2 * dt) / sigil.turn) % (Math.PI * 2)
      sigil.inner = (sigil.inner - (Math.PI * 2 * dt) / (sigil.turn * 1.6)) % (Math.PI * 2)
      surface.setState({ sigil })
    })
    surface.setState(state)
  }
  const sigil = state.sigil
  sigil.want = { colour: props.colour, level: props.level }

  const W = props.cols * CW
  const H = props.rows * CH
  const R = Math.min(W, H) / 2 - 2
  // Three strengths of ink, so neighbours share a Box.
  const shades = [0, 0.4, 0.7, 1].map(k => short(mixHex(DARK, sigil.colour, k)))
  const shadeAt = (gx: number, gy: number) => {
    const ink = inkAt((gx + 0.5) * (CW / PX) - W / 2, (gy + 0.5) * (CH / PY) - H / 2, R, sigil)
    return ink < 0.2 ? 0 : ink < 0.45 ? 1 : ink < 0.75 ? 2 : 3
  }

  const rows: RenderElement[] = []
  for (let cy = 0; cy < props.rows; cy += 1) {
    const subrows: RenderElement[] = []
    for (let sy = 0; sy < PY; sy += 1) {
      const gy = cy * PY + sy
      const cells: RenderElement[] = []
      let blank = 0
      for (let cx = 0; cx < props.cols; cx += 1) {
        const px = Array.from({ length: PX }, (_, k) => shadeAt(cx * PX + k, gy))
        if (px.every(s => s === 0)) {
          blank += 1
          continue
        }
        if (blank) {
          cells.push(<Box width={blank} />)
          blank = 0
        }
        // One Box a run of one shade within the cell, its width a share of the cell's.
        const runs: RenderElement[] = []
        let start = 0
        for (let k = 1; k <= PX; k += 1) {
          if (k === PX || px[k] !== px[start]) {
            const share = ((k - start) * 100) / PX
            runs.push(px[start] ? <Box width={`${share}%`} height="100%" backgroundColor={shades[px[start]!]} /> : <Box width={`${share}%`} />)
            start = k
          }
        }
        cells.push(
          <Box width={1} height="100%" flexDirection="row">
            {runs}
          </Box>,
        )
      }
      subrows.push(
        cells.length ? (
          <Box width={props.cols} height={`${100 / PY}%`} flexDirection="row">
            {cells}
          </Box>
        ) : (
          <Box width={props.cols} height={`${100 / PY}%`} />
        ),
      )
    }
    rows.push(
      <Box width={props.cols} height={1} flexDirection="column">
        {subrows}
      </Box>,
    )
  }
  return (
    <Box flexDirection="column" width={props.cols} height={props.rows}>
      {rows}
    </Box>
  )
}

export default FrameSigil
