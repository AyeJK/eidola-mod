// The HUD's recording along the bottom: bars rising from the pane's bottom
// edge, scrolling left, a low murmur with calls swelling out of it. A live
// drawing, so a new mood eases in: its colour, its loudness and its pace
// all fade to the new one over a couple of seconds, never a cut.

import type { ClientModule } from 'claude-code'

import { mixHex } from './live-pixels'

/** `level`: how busy the recording runs; `colour`: the colour it fades to. */
type Props = { colour: string; level: 'idle' | 'working' | 'attention'; cols: number }

type Wave = {
  /** How far along the tile the recording has scrolled, in bars. */
  offset: number
  colour: string
  /** Eased toward the level's own: bars a second, calls sounding, their loudness, the murmur under them. */
  speed: number
  calls: number
  loud: number
  floor: number
  /** What it is fading toward: the latest props. */
  want: { colour: string; level: Props['level'] }
}
type State = { wave: Wave }

const LOOKS = {
  idle: { speed: 4, calls: 2, loud: 0.5, floor: 0.06 },
  working: { speed: 11, calls: 7, loud: 0.85, floor: 0.16 },
  attention: { speed: 7, calls: 3, loud: 1, floor: 0.1 },
} as const

/** Bars in one tile of the recording, which repeats. */
const TILE = 160
const TICK_MS = 100

/** A stable value in [0, 1) for a whole number. */
const lot = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** The calls: where each swells in the tile, how wide and how loud; the first `calls` of them sound. */
const SWELLS = Array.from({ length: 7 }, (_, i) => ({ at: lot(i + 1) * TILE, width: 4 + lot(i + 11) * 14, height: 0.55 + 0.45 * lot(i + 21) }))

/** How loud bar `i` of the tile is, 0 to 1. */
function amp(i: number, wave: Wave): number {
  let e = wave.floor
  SWELLS.forEach((sw, k) => {
    const weight = Math.min(1, Math.max(0, wave.calls - k))
    if (weight > 0) {
      const d = Math.min(Math.abs(i - sw.at), TILE - Math.abs(i - sw.at))
      e += weight * sw.height * wave.loud * Math.exp(-((d / sw.width) ** 2))
    }
  })
  return Math.min(1, e) * (0.45 + 0.55 * lot(Math.round(i) + 101))
}

const FrameWave: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (!state) {
    const wave: Wave = { offset: 0, colour: props.colour, ...LOOKS[props.level], want: { colour: props.colour, level: props.level } }
    state = { wave }
    surface.every(TICK_MS, () => {
      // Everything about it fades toward the new mood's; nothing jumps.
      const look = LOOKS[wave.want.level]
      wave.speed += (look.speed - wave.speed) * 0.05
      wave.calls += (look.calls - wave.calls) * 0.05
      wave.loud += (look.loud - wave.loud) * 0.05
      wave.floor += (look.floor - wave.floor) * 0.05
      wave.colour = mixHex(wave.colour, wave.want.colour, 0.08)
      wave.offset = (wave.offset + (wave.speed * TICK_MS) / 1000) % TILE
      surface.setState({ wave })
    })
    surface.setState(state)
  }
  const wave = state.wave
  wave.want = { colour: props.colour, level: props.level }
  // Two bars a cell, each a little under half its width, rising from the bottom.
  const cells = Array.from({ length: props.cols }, (_, x) => {
    const bars = [0, 1].map(k => {
      const at = x * 2 + k + wave.offset
      const a = amp(Math.floor(at) % TILE, wave) * (1 - (at % 1)) + amp(Math.ceil(at) % TILE, wave) * (at % 1)
      const height = Math.max(3, Math.round(a * 96))
      return (
        <Box key={`b${k}`} width="50%" height="100%" flexDirection="column" justifyContent="flex-end" alignItems="center">
          <Box width="45%" height={`${height}%`} backgroundColor={wave.colour} />
        </Box>
      )
    })
    return (
      <Box key={`c${x}`} width={1} height={3} flexDirection="row">
        {bars}
      </Box>
    )
  })
  return (
    <Box flexDirection="row" width={props.cols} height={3}>
      {cells}
    </Box>
  )
}

export default FrameWave
