// The body of a picker card, as something to click: a clear region laid over
// the card's still, name and description. A click on it opens that Engram's
// page; the card's Awaken sits over it and acts at once.
// A Box can't be pressed and a Button can't hold a still, so this is a Client.
//
// It fills its region with rows of blank text. On the desktop a Client takes
// the pointer where it draws something, and an empty box draws nothing: the
// region of an empty box took no clicks at all. A row of no-break spaces is
// drawn, and still shows nothing.

import type { ClientModule } from 'claude-code'

/** `id`: the Engram whose page a click opens (empty: the menu's catcher); `cols` × `rows`: the region. */
type Props = { id: string; cols: number; rows: number }
type State = { isListening: true }

const CardHit: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (!surface.state) {
    surface.onPointer(e => {
      if (e.type === 'down' && (e.button === 'left' || e.button === undefined)) {
        surface.post({ open: props.id })
      }
    })
    surface.setState({ isListening: true })
  }
  const blank = ' '.repeat(Math.max(1, props.cols))
  return (
    <Box width={props.cols} height={props.rows} flexDirection="column" overflow="hidden">
      {Array.from({ length: Math.max(1, props.rows) }, (_, i) => (
        <Box key={`r${i}`} width={props.cols} height={1} overflow="hidden">
          <Text>{blank}</Text>
        </Box>
      ))}
    </Box>
  )
}

export default CardHit
