// The label of a button on the desktop: one row, the whole of it the hit,
// pressed on the pointer going down. The rounded box around it (its fill,
// border and hover) is the host's, in register.tsx; this draws the words and
// lights them under the pointer. A plain Button inverts under the pointer and
// can't take a colour, so the desktop's buttons are this instead.

import type { ClientModule } from 'claude-code'

/** `label`: the words; `fg`, `hoverFg`: their colour at rest and under the pointer; `bold`, `underline`: how they are drawn; `cols`: the region's width. */
type Props = { label: string; fg: string; hoverFg: string; bold: boolean; underline?: boolean; cols: number }
type State = { isHovered: boolean }

const Pill: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (!state) {
    state = { isHovered: false }
    surface.onPointer(e => {
      if (e.type === 'enter' || e.type === 'leave') {
        surface.setState({ isHovered: e.type === 'enter' })
      } else if (e.type === 'down' && (e.button === 'left' || e.button === undefined)) {
        surface.post({ press: true })
      }
    })
    surface.setState(state)
  }
  return (
    <Box width={props.cols} height={1} flexDirection="row" justifyContent="center">
      <Text color={state.isHovered ? props.hoverFg : props.fg} bold={props.bold} underline={props.underline === true}>
        {props.label}
      </Text>
    </Box>
  )
}

export default Pill
