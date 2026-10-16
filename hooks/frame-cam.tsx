// The live-cam tag in the HUD's corner: a blinking recording dot, LIVE and
// the camera, and under it the Vessel's name and the time, ticking, as an
// underwater camera feed stamps its picture.

import type { ClientModule } from 'claude-code'

type Props = { name: string; camera: string }
type Cam = { tick: number }
type State = { cam: Cam }

const RED = '#ff3b3b'
const DIM_RED = '#5a1a1a'
const WHITE = '#e6edf3'
const GREY = '#9aa3b2'

const two = (n: number) => String(n).padStart(2, '0')

/** The time now, as a camera stamps it. */
function stamp(): string {
  if (typeof Date === 'undefined') {
    return '--:--:--'
  }
  const now = new Date(Date.now())
  return `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

const FrameCam: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (!state) {
    const cam: Cam = { tick: 0 }
    state = { cam }
    surface.every(500, () => {
      cam.tick += 1
      surface.setState({ cam })
    })
    surface.setState(state)
  }
  // The dot is lit for a second, dark for half of one.
  const isLit = state.cam.tick % 3 !== 2
  return (
    <Box flexDirection="column" width={20} height={2}>
      <Box flexDirection="row" justifyContent="flex-end">
        <Text color={isLit ? RED : DIM_RED}>●</Text>
        <Text color={WHITE} bold>
          {' LIVE'}
        </Text>
        <Text color={GREY}>{`  ${props.camera}`}</Text>
      </Box>
      <Box flexDirection="row" justifyContent="flex-end">
        <Text color={GREY}>{`${props.name}  ${stamp()}`}</Text>
      </Box>
    </Box>
  )
}

export default FrameCam
