// The body of a picker card, as something to click: a clear region laid over
// the card's still, name and description. A click on it opens that Engram's
// page; the card's Awaken or Sleep button sits outside it and acts at once.
// A Box can't be pressed and a Button can't hold a still, so this is a Client.

import type { ClientModule } from 'claude-code'

/** `id`: the Engram whose page a click opens. */
type Props = { id: string }
type State = { isListening: true }

const CardHit: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  if (!surface.state) {
    surface.onPointer(e => {
      if (e.type === 'down' && e.button === 'left') {
        surface.post({ open: props.id })
      }
    })
    surface.setState({ isListening: true })
  }
  // Nothing drawn: the card shows through.
  return <Box width="100%" height="100%" />
}

export default CardHit
