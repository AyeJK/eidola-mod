// The pane's bottom-right corner: a small brass triangle in place of the
// bracket. A click on it opens the Engram picker, and closes it again. It
// lights under the pointer, so it reads as something to press.

import type { ClientModule } from 'claude-code'

import { mixHex } from './live-pixels'

/** `colour`: the brass it is drawn in; `isOpen`: whether the picker is up. */
type Props = { colour: string; isOpen: boolean }
type State = { isHovered: boolean }

/** Strips the triangle is stepped in, top to bottom, each a little wider. */
const STEPS = 8

const FrameCorner: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  let state = surface.state
  if (!state) {
    state = { isHovered: false }
    surface.onPointer(e => {
      if (e.type === 'enter' || e.type === 'leave') {
        surface.setState({ isHovered: e.type === 'enter' })
      } else if (e.type === 'down' && e.button === 'left') {
        surface.post({ corner: 'toggle' })
      }
    })
    surface.setState(state)
  }
  const lit = state.isHovered || props.isOpen
  const colour = lit ? mixHex(props.colour, '#ffffff', 0.35) : props.colour
  // A right triangle in the bottom-right cell pair, its square corner in the
  // pane's corner: strips right-aligned, the bottom one full width.
  const strips = Array.from({ length: STEPS }, (_, i) => (
    // Whole percentages only: the strips alternate 12% and 13% to fill the cell.
    <Box key={`s${i}`} width="100%" height={`${i % 2 ? 13 : 12}%`} flexDirection="row" justifyContent="flex-end">
      <Box width={`${Math.round(((i + 1) / STEPS) * 100)}%`} height="100%" backgroundColor={colour} />
    </Box>
  ))
  // The region is a cell larger each way than the triangle, so it is easy to
  // hit. The triangle is set in its last row and last two columns by spacer
  // cells, not by justifying: it has to sit on the same row as the brackets.
  return (
    <Box width={3} height={2} flexDirection="column">
      <Box key="above" width={3} height={1} />
      <Box key="row" width={3} height={1} flexDirection="row">
        <Box key="left" width={1} height={1} />
        <Box key="triangle" width={2} height={1} flexDirection="column">
          {strips}
        </Box>
      </Box>
    </Box>
  )
}

export default FrameCorner
