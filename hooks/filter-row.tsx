// One row of a picker dropdown on the desktop: the trigger ("Surface  All ▾")
// or one option of the open menu. The whole row is the hit, pressed on the
// pointer going down, and it lights under the pointer, as a menu row does.
// A Button can't fill a row or light by itself, so this is a Client.

import type { ClientModule } from 'claude-code'

/**
 * `prefix`: the dropdown's name, muted, before the value (the trigger only).
 * `label`: the value or option. `caret`: the trigger's caret, else empty.
 * `pick`: what a press posts: `toggle` for a trigger, else the option's id.
 * `isOn`: the chosen option, drawn in `on` (gold) with its check. `cols`:
 * the region's width. The row's fill, rounding and hover are its host box's
 * (register.tsx); this draws the words. The colours are the theme's, handed
 * in: a surface module has no imports of the mod's own.
 */
type Props = {
  prefix: string
  label: string
  caret: string
  pick: string
  isOn: boolean
  cols: number
  white: string
  text: string
  muted: string
  /** The chosen option's colour, and its check's. */
  on: string
}
type State = { isHovered: boolean }

const FilterRow: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (!state) {
    state = { isHovered: false }
    surface.onPointer(e => {
      if (e.type === 'enter' || e.type === 'leave') {
        surface.setState({ isHovered: e.type === 'enter' })
      } else if (e.type === 'down' && (e.button === 'left' || e.button === undefined)) {
        surface.post({ filter: props.pick })
      }
    })
    surface.setState(state)
  }
  const colour = props.isOn ? props.on : props.prefix ? props.white : state.isHovered ? props.white : props.text
  return (
    <Box width={props.cols} height={1} flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Box flexDirection="row" gap={1}>
        {props.prefix ? <Text color={props.muted}>{props.prefix}</Text> : null}
        <Text color={colour} bold={props.isOn}>
          {props.label}
        </Text>
      </Box>
      <Text color={props.isOn ? props.on : props.muted}>{props.caret}</Text>
    </Box>
  )
}

export default FilterRow
