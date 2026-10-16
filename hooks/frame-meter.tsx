// The frame's level meter: a row of bars in the corner of the HUD, rising
// and falling on their own clock, busier the busier the Vessel's state.

import type { ClientModule } from 'claude-code'

import type { VesselState } from '../types'

type Props = { state: VesselState; colour: string }
type Meter = { bars: number[]; tick: number }
type State = { meter: Meter }

/** How lively the bars run in each state, 0 to 1. */
const LEVEL: Record<VesselState, number> = {
  idle: 0.15,
  thinking: 0.55,
  working: 0.9,
  attention: 0.7,
  success: 0.3,
  responding: 0.75,
  error: 0.85,
  waiting: 0.25,
  sleeping: 0.05,
}

const BARS = 12
const GLYPHS = ' ▁▂▃▄▅▆▇█'

const FrameMeter: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (!state) {
    const meter: Meter = { bars: Array.from({ length: BARS }, () => 0), tick: 0 }
    state = { meter }
    surface.every(120, () => {
      meter.tick += 1
      surface.setState({ meter })
    })
    surface.setState(state)
  }
  const meter = state.meter
  const level = LEVEL[props.state] ?? 0.2
  // Each bar wanders toward a new height, more and higher the livelier the state.
  meter.bars = meter.bars.map((height, i) => {
    const want = level * (0.35 + 0.65 * Math.abs(Math.sin(meter.tick * 0.7 + i * 1.9) * Math.cos(meter.tick * 0.23 + i)))
    return height + (want - height) * 0.5
  })
  return (
    <Box flexDirection="row" width={BARS} height={1}>
      {meter.bars.map((height, i) => (
        <Box key={`bar-${i}`} width={1}>
          <Text color={props.colour}>{GLYPHS[Math.max(1, Math.round(height * (GLYPHS.length - 1)))]}</Text>
        </Box>
      ))}
    </Box>
  )
}

export default FrameMeter
