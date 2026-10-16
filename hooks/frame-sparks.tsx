// The HUD's arcane sparks along the bottom: motes rising from the pane's
// bottom edge, swaying, shrinking and fading as they climb. A live drawing,
// so a new mood eases in: how many rise, how fast, and their colour all
// fade to the new one, never a cut. Each spark sits within its cell to a
// hundredth, so they drift rather than hop from cell to cell.

import type { ClientModule } from 'claude-code'

import { mixHex } from './live-pixels'

/** `level`: how many rise and how fast; `colour`: the colour they fade to. */
type Props = { colour: string; level: 'idle' | 'working' | 'attention'; cols: number; rows: number }

/** A spark: where it is, in cells, how fast it climbs, its sway, how long it has lived of its life. */
type Spark = { x: number; y: number; rise: number; sway: number; phase: number; age: number; life: number; size: number }

type Field = {
  t: number
  seed: number
  colour: string
  /** Eased toward the level's own: sparks born a second, how fast they climb. */
  rate: number
  speed: number
  sparks: Spark[]
  owed: number
  want: { colour: string; level: Props['level'] }
}
type State = { field: Field }

const LOOKS = {
  idle: { rate: 3, speed: 0.9 },
  working: { rate: 16, speed: 2.2 },
  attention: { rate: 9, speed: 1.5 },
} as const

const TICK_MS = 100
/** Sparks there may be at once: each is a handful of Boxes. */
const MOST = 70

function random(field: Field): number {
  field.seed = (field.seed + 0x6d2b79f5) >>> 0
  let t = field.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const FrameSparks: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (!state) {
    const field: Field = { t: 0, seed: 991, colour: props.colour, ...LOOKS[props.level], sparks: [], owed: 0, want: { colour: props.colour, level: props.level } }
    state = { field }
    surface.every(TICK_MS, () => {
      const look = LOOKS[field.want.level]
      const dt = TICK_MS / 1000
      field.rate += (look.rate - field.rate) * 0.05
      field.speed += (look.speed - field.speed) * 0.05
      field.colour = mixHex(field.colour, field.want.colour, 0.08)
      field.t += dt
      // Born along the bottom edge, at the rate the mood sets.
      field.owed += field.rate * dt
      while (field.owed >= 1 && field.sparks.length < MOST) {
        field.owed -= 1
        field.sparks.push({
          x: random(field) * props.cols,
          y: props.rows - 0.05,
          rise: 0.6 + random(field) * 0.8,
          sway: 0.15 + random(field) * 0.35,
          phase: random(field) * 6.3,
          age: 0,
          life: 1.6 + random(field) * 2.2,
          size: 0.55 + random(field) * 0.45,
        })
      }
      field.owed = Math.min(field.owed, 1)
      for (const s of field.sparks) {
        s.age += dt
        s.y -= s.rise * field.speed * dt
        s.x += Math.sin(field.t * 2 + s.phase) * s.sway * dt
      }
      field.sparks = field.sparks.filter(s => s.age < s.life && s.y > 0.02 && s.x >= 0 && s.x < props.cols)
      surface.setState({ field })
    })
    surface.setState(state)
  }
  const field = state.field
  field.want = { colour: props.colour, level: props.level }

  // One spark a cell at most; each drawn at its place within the cell, smaller and dimmer as it ages.
  const byCell = new Map<number, Spark>()
  for (const s of field.sparks) {
    byCell.set(Math.floor(s.y) * props.cols + Math.floor(s.x), s)
  }
  const bright = mixHex(field.colour, '#ffffff', 0.3)
  const lines = Array.from({ length: props.rows }, (_, row) => {
    const cells = []
    let gap = 0
    for (let col = 0; col < props.cols; col += 1) {
      const s = byCell.get(row * props.cols + col)
      if (!s) {
        gap += 1
        continue
      }
      if (gap) {
        cells.push(<Box key={`g${col}`} width={gap} />)
        gap = 0
      }
      const k = s.age / s.life
      // Brightest just born, fading into the dark as it dies.
      const colour = mixHex(bright, '#000000', Math.min(0.85, k * 0.9))
      // Square: a cell is 8 px wide and 19 tall, so its height share is under half its width share.
      const wide = Math.max(14, Math.round(s.size * (1 - k * 0.5) * 34))
      const tall = Math.max(6, Math.round(wide * 0.42))
      const left = Math.min(100 - wide, Math.round((s.x % 1) * 100))
      const top = Math.min(100 - tall, Math.round((s.y % 1) * 100))
      cells.push(
        <Box key={`s${col}`} width={1} height={1} flexDirection="column">
          <Box height={`${top}%`} />
          <Box flexDirection="row" height={`${tall}%`}>
            <Box width={`${left}%`} />
            <Box width={`${wide}%`} height="100%" backgroundColor={colour} />
          </Box>
        </Box>,
      )
    }
    return (
      <Box key={`r${row}`} flexDirection="row" height={1}>
        {cells}
      </Box>
    )
  })
  return (
    <Box flexDirection="column" width={props.cols} height={props.rows}>
      {lines}
    </Box>
  )
}

export default FrameSparks
