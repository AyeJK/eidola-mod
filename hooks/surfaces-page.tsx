// The Surfaces screen: where every Engram may draw. A row each for the Pane
// and the Band with its switch, the "Hide the band while the pane is open"
// check under the Band, a Status line row, and a warning while every surface
// is off. Each control writes the same `userConfig` option `/eidola place`
// writes; register.tsx does the writing and hands this screen the values.
//
// Drawn in the pane's colours (theme.ts) as docs/design/design-system.md
// lays out §Surface row, §Switch and §Check. The desktop draws the icons as
// stills; the terminal and mobile draw the same screen in plain text.

import type { RenderElement } from 'claude-code'

import { ICON_PX } from './icons'
import type { SurfaceIcon } from './icons'
import { header, surfaceIcon, titleBlock } from './engram-page'
import type { Kit } from './engram-page'
import type { Surfaces, Switch } from './placement'
import { THEME } from './theme'

/** A control on the screen: a surfaces switch, or the status line's. */
export type SurfacesControl = Switch | 'status'

/** What the screen draws and what its controls do, from register.tsx. */
export type SurfacesInput = {
  surfaces: Surfaces
  isStatusLineOn: boolean
  back: { onPress: () => void }
  /** A control pressed: write its option, turned to `isOn`. */
  onSet: (control: SurfacesControl, isOn: boolean) => void
}

/** Each row's words: the name in bold white, one muted line under it. */
const ROWS: Record<'pane' | 'band' | 'status', { name: string; text: string }> = {
  pane: { name: 'Pane', text: 'The awake Engram draws in the pane, which opens by itself when it wakes.' },
  band: { name: 'Band', text: 'The awake Engram draws in the band above the prompt.' },
  status: { name: 'Status line', text: "The Engram's name and state under the prompt." },
}

/** The check's label, and the line under it. */
export const HIDE_LABEL = 'Hide the band while the pane is open'
const HIDE_NOTE = 'A band-only Engram, like the Wisp, keeps its band.'

/** The warning while every surface is off. */
export const ALL_OFF_TITLE = 'Every surface is off'
export const ALL_OFF_TEXT = 'No Engram draws anywhere. Turn on Pane or Band to see one.'

/** The status line's icon: a window with a short line of text along its foot. */
function statusIconSvg(colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="${ICON_PX}" height="${ICON_PX}" color="${colour}"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor"/><rect x="3" y="8.5" width="6" height="1.5" fill="currentColor"/></svg>`
}

/** A row's icon: a surface's, or the status line's; its name in text off the desktop. */
function rowIcon(kit: Kit, id: 'pane' | 'band' | 'status', colour: string): RenderElement {
  if (id !== 'status') {
    return surfaceIcon(kit, id as SurfaceIcon, colour, `surface-icon:${id}`)
  }
  const { Box, Text, Svg } = kit.els
  if (!kit.isRich) {
    return (
      <Text key="surface-icon:status" color={colour}>
        status
      </Text>
    )
  }
  return (
    <Box key="surface-icon:status" width={2} height={1} alignItems="center" justifyContent="center">
      <Svg key={`surface-icon:status:${colour}`} source={statusIconSvg(colour)} alt="Status line" width={ICON_PX} height={ICON_PX} />
    </Box>
  )
}

/**
 * A switch: off, a `line` border and a faint knob at the left; on, an
 * `amber-line` border on an `amber-fill` track and an amber knob at the right.
 * A Button takes its label alone, with no colour of ours, so the knob is a
 * coloured glyph beside the press, which says On or Off.
 */
export function switchControl(kit: Kit, key: string, isOn: boolean, onPress: () => void): RenderElement {
  const { Box, Button, Text } = kit.els
  const knob = (
    <Text key={`knob:${key}`} color={isOn ? THEME.amber : THEME.faint}>
      ●
    </Text>
  )
  const press = <Button key={`switch:${key}`} label={isOn ? 'On' : 'Off'} plain {...(isOn ? {} : { dimColor: true })} onPress={onPress} />
  return (
    <Box
      key={`switch-box:${key}`}
      flexDirection="row"
      width={7}
      gap={1}
      flexShrink={0}
      justifyContent={isOn ? 'flex-end' : 'flex-start'}
      borderStyle="round"
      borderColor={isOn ? THEME.amberLine : THEME.line}
      {...(isOn ? { backgroundColor: THEME.amberFill } : {})}
      hover={{ borderColor: THEME.amberLine }}
    >
      {isOn ? [press, knob] : [knob, press]}
    </Box>
  )
}

/**
 * A check: a one-cell box instead of a native checkbox. Off, a `line` border;
 * on, an `amber-line` border on `amber-fill` with an amber tick. Its label
 * sits to its right and is the press, as a form's label is.
 */
export function checkControl(kit: Kit, key: string, text: string, isOn: boolean, onPress: () => void): RenderElement {
  const { Box, Button, Text } = kit.els
  return (
    <Box key={`check-row:${key}`} flexDirection="row" alignItems="center" gap={1}>
      <Box
        key={`check-box:${key}`}
        width={3}
        flexShrink={0}
        borderStyle="round"
        borderColor={isOn ? THEME.amberLine : THEME.line}
        {...(isOn ? { backgroundColor: THEME.amberFill } : {})}
      >
        <Text key={`tick:${key}`} color={THEME.amber}>
          {isOn ? '✓' : ' '}
        </Text>
      </Box>
      <Button key={`check:${key}`} label={text} plain onPress={onPress} />
    </Box>
  )
}

/** A surface row: its icon, the name in bold white, a muted line, and its switch; the border amber while on. */
function surfaceRow(kit: Kit, id: 'pane' | 'band' | 'status', isOn: boolean, onPress: () => void, under: RenderElement | null): RenderElement {
  const { Box, Text } = kit.els
  const row = ROWS[id]
  return (
    <Box key={`surface-row:${id}`} flexDirection="column" borderStyle="round" borderColor={isOn ? THEME.amberLine : THEME.line} backgroundColor={THEME.panel} paddingX={1}>
      <Box key={`surface-main:${id}`} flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box key={`surface-left:${id}`} flexDirection="row" alignItems="center" gap={1} flexShrink={1}>
          {rowIcon(kit, id, isOn ? THEME.amber : THEME.faint)}
          <Box key={`surface-text:${id}`} flexDirection="column" flexShrink={1}>
            <Text bold color={THEME.white}>
              {row.name}
            </Text>
            <Text color={THEME.muted} wrap="wrap">
              {row.text}
            </Text>
          </Box>
        </Box>
        {switchControl(kit, id, isOn, onPress)}
      </Box>
      {under}
    </Box>
  )
}

/** The Surfaces screen. */
export function surfacesPage(kit: Kit, input: SurfacesInput): RenderElement {
  const { Box, Text } = kit.els
  const { surfaces } = input
  const onCount = [surfaces.pane, surfaces.band].filter(Boolean).length
  const isAllOff = onCount === 0
  const hide = (
    <Box key="hide" flexDirection="column" paddingLeft={3}>
      {checkControl(kit, 'hide', HIDE_LABEL, surfaces.hideBand, () => input.onSet('hide', !surfaces.hideBand))}
      <Text key="hide-note" color={THEME.muted} wrap="wrap">
        {HIDE_NOTE}
      </Text>
    </Box>
  )
  return (
    <Box key="surfaces-page" flexDirection="column" width={kit.cols} paddingX={1} gap={1} backgroundColor={THEME.void}>
      {header(kit, { key: 'surfaces-back', ...input.back })}
      {titleBlock(kit, 'Surfaces', `${onCount} of 2 on`)}
      {isAllOff ? (
        <Box key="surfaces-warning" flexDirection="column" borderStyle="round" borderColor={THEME.ember} backgroundColor={THEME.panel} paddingX={1}>
          <Text bold color={THEME.errorText}>
            {ALL_OFF_TITLE}
          </Text>
          <Text color={THEME.muted} wrap="wrap">
            {ALL_OFF_TEXT}
          </Text>
        </Box>
      ) : null}
      {surfaceRow(kit, 'pane', surfaces.pane, () => input.onSet('pane', !surfaces.pane), null)}
      {surfaceRow(kit, 'band', surfaces.band, () => input.onSet('band', !surfaces.band), hide)}
      {surfaceRow(kit, 'status', input.isStatusLineOn, () => input.onSet('status', !input.isStatusLineOn), null)}
    </Box>
  )
}
