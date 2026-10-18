// An Engram's own page, and the pieces it shares with the picker: the
// header, the title and its accent rule, chips, panels and buttons, all in
// the pane's colours (theme.ts) as docs/design/design-system.md lays them
// out. The desktop draws them with stills and icons; the terminal and mobile
// draw the same screens in plain text, no `Svg` and no `Client`.
//
// Nothing here reaches the engine: register.tsx hands each screen what it
// shows and what each button does, and draws the live preview scene itself,
// since a `Client` is named in the hooks module's own source.

import type { Elements, RenderElement } from 'claude-code'

import type { Mood, Preview, VesselState } from '../types'
import type { Engram, SceneName, SelfScene } from './engram-types'
import { FRAME_STATES } from './hud'
import { ICON_NAMES, ICON_PX, iconSvg } from './icons'
import type { SurfaceIcon } from './icons'
import { showsLabel, whereItDraws } from './placement'
import type { Surfaces } from './placement'
import { RULE, THEME } from './theme'
import { WORDMARK_HEIGHT, WORDMARK_WIDTH, wordmarkSvg } from './wordmark'

/** The elements a screen draws with. `Svg` only where `isRich`. */
export type Els = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'>

/** What every screen piece needs: its elements, whether it may draw stills, and its width in cells. */
export type Kit = { els: Els; isRich: boolean; cols: number }

/** The surfaces, in the order their icons stand. */
export const SURFACE_ICONS: readonly SurfaceIcon[] = ['pane', 'band', 'shrine']

/** The moods a preview chip sets, in order. */
export const PREVIEW_MOODS: readonly Mood[] = ['idle', 'working', 'attention']

/** A fresh preview: idle, no error, nothing scorched. */
export const FRESH_PREVIEW: Preview = { mood: 'idle', isError: false, ink: 0, inkAt: 0, moodAt: 0, moodBefore: 'idle' }

const MOOD_NAMES: Record<Mood, string> = { idle: 'Idle', working: 'Working', attention: 'Attention' }
const MOOD_STATE: Record<Mood, VesselState> = { idle: 'idle', working: 'working', attention: 'attention' }

// ── Pieces ──────────────────────────────────────────────────────────────

/** A surface icon in a colour: a small still on the desktop, the surface's name in text elsewhere. */
export function surfaceIcon(kit: Kit, icon: SurfaceIcon, colour: string, key: string): RenderElement {
  const { Box, Text, Svg } = kit.els
  if (!kit.isRich) {
    return (
      <Text key={key} color={colour}>
        {icon}
      </Text>
    )
  }
  return (
    <Box key={key} width={2} height={1} alignItems="center" justifyContent="center">
      <Svg key={`${key}:${colour}`} source={iconSvg(icon, colour)} alt={ICON_NAMES[icon]} width={ICON_PX} height={ICON_PX} />
    </Box>
  )
}

/**
 * A button: the surface's secondary style, normal case. Every button the
 * screens draw is this one, so Awaken, Sleep, Details and Create with Claude
 * read alike; the engine's primary fill outshouts the cards it sits on.
 */
export function button(kit: Kit, key: string, label: string, onPress: () => void): RenderElement {
  const { Button } = kit.els
  return <Button key={key} label={label} variant="secondary" onPress={onPress} />
}

/**
 * A chip: a `line` border and its label dimmed, or, selected, an `amber-line`
 * border on an amber fill and its label at full strength. A Button takes its
 * label alone, so the label keeps the surface's text colour.
 */
export function chip(kit: Kit, key: string, label: string, isOn: boolean, onPress: () => void): RenderElement {
  const { Box, Button } = kit.els
  return (
    <Box
      key={`chip-${key}`}
      borderStyle="round"
      borderColor={isOn ? THEME.amberLine : THEME.line}
      {...(isOn ? { backgroundColor: THEME.amberFill } : {})}
      hover={{ borderColor: THEME.amberLine }}
    >
      <Button key={key} label={label.toUpperCase()} plain {...(isOn ? {} : { dimColor: true })} onPress={onPress} />
    </Box>
  )
}

/** A label: gold capitals, as "AWAKE" and "WHERE IT DRAWS". */
export function label(kit: Kit, text: string, key = 'label'): RenderElement {
  const { Text } = kit.els
  return (
    <Text key={key} color={THEME.gold}>
      {text.toUpperCase()}
    </Text>
  )
}

/** The accent rule: about 15 cells, ember to amber to gold, fading out. Thin bars on the desktop, a line of rules in text. */
export function accentRule(kit: Kit, key = 'rule'): RenderElement {
  const { Box, Text } = kit.els
  if (!kit.isRich) {
    return (
      <Box key={key} flexDirection="row">
        {RULE.map((colour, i) => (
          <Text key={`rule-${i}`} color={colour}>
            ━━━
          </Text>
        ))}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="row" height={1} alignItems="center">
      {RULE.map((colour, i) => (
        <Box key={`rule-${i}`} width={3} height="12%" backgroundColor={colour} />
      ))}
    </Box>
  )
}

/** The header: back, then the wordmark. */
export function header(kit: Kit, back: { key: string; onPress: () => void }): RenderElement {
  const { Box, Text, Svg } = kit.els
  return (
    <Box key="head" flexDirection="row" alignItems="center" gap={1} flexShrink={0}>
      {button(kit, back.key, '‹', back.onPress)}
      {kit.isRich ? (
        <Svg key="wordmark" source={wordmarkSvg(THEME.gold)} alt="Eidola" width={WORDMARK_WIDTH} height={WORDMARK_HEIGHT} />
      ) : (
        <Text key="wordmark" bold color={THEME.gold}>
          EIDOLA
        </Text>
      )}
    </Box>
  )
}

/** A screen's title, bold white, its count label at the right, the accent rule under them. */
export function titleBlock(kit: Kit, title: string, count: string): RenderElement {
  const { Box, Text } = kit.els
  return (
    <Box key="title" flexDirection="column">
      <Box key="title-row" flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text bold color={THEME.white}>
          {title}
        </Text>
        <Text color={THEME.gold}>{count.toUpperCase()}</Text>
      </Box>
      {accentRule(kit)}
    </Box>
  )
}

/** A panel: its label at the top left, a link at the top right, rows split by soft dividers. */
export function panel(kit: Kit, key: string, title: string, link: RenderElement | null, rows: RenderElement[]): RenderElement {
  const { Box } = kit.els
  const body: RenderElement[] = []
  rows.forEach((row, i) => {
    if (i > 0) {
      body.push(divider(kit, `${key}-divider-${i}`))
    }
    body.push(row)
  })
  return (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={THEME.line} backgroundColor={THEME.panel} paddingX={1}>
      <Box key={`${key}-head`} flexDirection="row" justifyContent="space-between" alignItems="center">
        {label(kit, title)}
        {link}
      </Box>
      {body}
    </Box>
  )
}

/** A soft divider inside a panel or card: a thin line on the desktop, a rule of dashes in text. */
export function divider(kit: Kit, key: string): RenderElement {
  const { Box, Text } = kit.els
  if (!kit.isRich) {
    return (
      <Text key={key} color={THEME.lineSoft}>
        {'─'.repeat(Math.max(4, kit.cols - 6))}
      </Text>
    )
  }
  return (
    <Box key={key} height={1} flexDirection="column" justifyContent="center">
      <Box width="100%" height="8%" backgroundColor={THEME.lineSoft} />
    </Box>
  )
}

// ── Where it draws ─────────────────────────────────────────────────────

/** The surfaces an Engram draws on now, from `whereItDraws` with the pane closed. */
export function drawingPlaces(surfaces: Surfaces, engram: Engram): string[] {
  const drawing = whereItDraws(surfaces, engram, false)
  return [...(drawing.opensPane ? ['Pane'] : []), ...(drawing.band ? ['Band'] : [])]
}

/** "drawing in Pane and Band", for the awake strip. */
export function drawingLine(surfaces: Surfaces, engram: Engram): string {
  const places = drawingPlaces(surfaces, engram)
  return places.length ? `drawing in ${places.join(' and ')}` : 'drawing nowhere: its surfaces are off'
}

/** One row of the Where it draws panel: whether it draws on that surface now, and why. */
type WhereRow = { icon: SurfaceIcon; isOn: boolean; text: string }

/** Where an Engram draws, surface by surface, as `whereItDraws` decides it under the surfaces setting. */
export function whereRows(surfaces: Surfaces, engram: Engram): WhereRow[] {
  const shows = engram.vessel.shows
  const closed = whereItDraws(surfaces, engram, false)
  const open = whereItDraws(surfaces, engram, true)
  const pane: WhereRow = !shows.includes('pane')
    ? { icon: 'pane', isOn: false, text: "Doesn't show in the pane. Opened by hand, the pane draws its band view." }
    : closed.opensPane
      ? { icon: 'pane', isOn: true, text: 'Draws in the pane, which opens by itself when it wakes.' }
      : { icon: 'pane', isOn: false, text: 'The Pane switch is off: the pane opens only when you ask.' }
  const band: WhereRow = !shows.includes('band')
    ? { icon: 'band', isOn: false, text: "Doesn't draw in the band." }
    : !surfaces.band
      ? { icon: 'band', isOn: false, text: 'The Band switch is off.' }
      : open.band
        ? { icon: 'band', isOn: true, text: 'Draws in the band above the prompt.' }
        : { icon: 'band', isOn: true, text: 'Draws in the band, hidden while the pane is open.' }
  const shrine: WhereRow = shows.includes('shrine')
    ? { icon: 'shrine', isOn: false, text: 'Made for the Shrine too, which arrives in a later version.' }
    : { icon: 'shrine', isOn: false, text: "Doesn't draw in the Shrine." }
  return [pane, band, shrine]
}

// ── The page ───────────────────────────────────────────────────────────

/** What an Engram does when something goes wrong, by scene. */
const ON_ERROR: Record<SceneName | SelfScene, string> = {
  kraken: 'It inks and flees into the deep.',
  lich: 'It is scorched, and its fire flares.',
  wisp: 'It gutters, and a lantern goes out.',
  self: 'It plays its own error effect.',
}

const RIGHTS: Record<Engram['rights'], string> = {
  original: 'Original: made by its author.',
  licensed: 'Licensed: shared with permission.',
}

/** The preview's rows: a pane view tall, a band-only Engram's band strip. */
export function previewRows(engram: Engram): number {
  return engram.vessel.shows.includes('pane') ? 14 : 9
}

/** What the page draws and what its buttons do, from register.tsx. */
export type PageInput = {
  engram: Engram
  isAwake: boolean
  surfaces: Surfaces
  preview: Preview
  /** The live scene at the preview's mood, `cols - 2` wide and `previewRows` tall: desktop only. */
  scene: RenderElement | null
  /** The terminal's picture of the preview's mood: its face. */
  face: string
  back: { onPress: () => void }
  onSurfaces: () => void
  onMood: (mood: Mood) => void
  onError: () => void
  onAwaken: () => void
  onSleep: () => void
  /** Remix with Claude: on every Engram's page. */
  onRemix: () => void
  /** Publish: on the pages of your own Engrams alone. */
  onPublish: (() => void) | undefined
}

/** The HUD preview's corner mark: a short gold L, one cell. */
function cornerMark(kit: Kit, key: string, top: number, left: number, isRight: boolean, isBottom: boolean): RenderElement {
  const { Box } = kit.els
  const across = <Box key="across" width="100%" height="8%" backgroundColor={THEME.gold} />
  const down = (
    <Box key="down" flexDirection="row" height="92%" justifyContent={isRight ? 'flex-end' : 'flex-start'}>
      <Box width="18%" height="100%" backgroundColor={THEME.gold} />
    </Box>
  )
  return (
    <Box key={key} position="absolute" top={top} left={left} flexDirection="column" width={1} height={1}>
      {isBottom ? [down, across] : [across, down]}
    </Box>
  )
}

/** The preview's words: the Engram, its mood (or the error) in amber, and a line under it. */
function previewWords(input: PageInput): { tag: string; mood: string; colour: string; line: string; corner: string } {
  const look = input.preview.isError ? FRAME_STATES.error : FRAME_STATES[MOOD_STATE[input.preview.mood]]
  return {
    tag: `EIDOLA · ${input.engram.name.toUpperCase()}`,
    mood: look.name,
    colour: input.preview.isError ? THEME.errorText : THEME.amber,
    line: look.line,
    corner: input.isAwake ? 'PREVIEW · AWAKE' : 'PREVIEW · NOT AWAKE',
  }
}

/** The HUD preview: the live scene in its dark frame with gold corners and its words, or the same in text. */
function hudPreview(kit: Kit, input: PageInput): RenderElement {
  const { Box, Text } = kit.els
  const words = previewWords(input)
  if (!kit.isRich || input.scene === null) {
    return (
      <Box key="preview" flexDirection="column" borderStyle="round" borderColor={THEME.gold} paddingX={1}>
        <Box key="preview-top" flexDirection="row" justifyContent="space-between">
          <Text color={THEME.gold}>{words.tag}</Text>
          <Text color={THEME.faint}>{words.corner}</Text>
        </Box>
        <Text key="preview-mood" bold color={words.colour}>
          {words.mood}
        </Text>
        <Text key="preview-line" color={THEME.muted}>
          {words.line}
        </Text>
        <Text key="preview-face" color={THEME.frost}>
          {input.face}
        </Text>
      </Box>
    )
  }
  const width = kit.cols - 2
  const rows = previewRows(input.engram)
  return (
    <Box key="preview" width={width} height={rows} overflow="hidden" backgroundColor={THEME.preview}>
      {input.scene}
      {cornerMark(kit, 'preview-tl', 0, 0, false, false)}
      {cornerMark(kit, 'preview-tr', 0, width - 1, true, false)}
      {cornerMark(kit, 'preview-bl', rows - 1, 0, false, true)}
      {cornerMark(kit, 'preview-br', rows - 1, width - 1, true, true)}
      <Box key="preview-words" position="absolute" top={1} left={2} flexDirection="column">
        <Text color={THEME.gold}>
          {words.tag}
        </Text>
        <Text key="preview-mood" bold color={words.colour}>
          {words.mood}
        </Text>
        <Text key="preview-line" color={THEME.muted}>
          {words.line}
        </Text>
      </Box>
      <Box key="preview-corner" position="absolute" top={1} left={Math.max(2, width - words.corner.length - 2)}>
        <Text color={THEME.faint}>
          {words.corner}
        </Text>
      </Box>
    </Box>
  )
}

/** A small card of the page: its label, and what it says. */
function factCard(kit: Kit, key: string, title: string, text: string, width: number): RenderElement {
  const { Box, Text } = kit.els
  return (
    <Box key={key} flexDirection="column" width={width} borderStyle="round" borderColor={THEME.line} backgroundColor={THEME.card} paddingX={1}>
      {label(kit, title, `${key}-label`)}
      <Text key={`${key}-text`} color={THEME.frost} wrap="wrap">
        {text}
      </Text>
    </Box>
  )
}

/**
 * An Engram's page: back to the picker; the HUD preview running its live
 * scene, with three mood chips and an Error button that change the preview
 * only; its label, name, rule and description; Awaken or Sleep, Remix with
 * Claude, and Publish on the pages of your own Engrams; where it
 * draws; and what it draws, where it comes from, its rights and what it does
 * on an error.
 */
export function engramPage(kit: Kit, input: PageInput): RenderElement {
  const { Box, Text, Button } = kit.els
  const { engram, preview } = input
  const id = engram.id
  const perRow = kit.cols >= 40 ? 2 : 1
  const factCols = Math.floor((kit.cols - 2 - (perRow - 1)) / perRow)
  const facts = [
    factCard(kit, 'fact-draws', 'Draws', `${engram.plugin ? 'its own' : engram.vessel.scene} scene · ${showsLabel(engram)}`, factCols),
    factCard(
      kit,
      'fact-source',
      'Source',
      `${engram.plugin ? `Engram plugin ${engram.plugin.name || engram.id}` : 'Bundled with Eidola'} · v${engram.version} · by ${engram.author}`,
      factCols,
    ),
    factCard(kit, 'fact-rights', 'Rights', RIGHTS[engram.rights], factCols),
    factCard(kit, 'fact-error', 'On error', ON_ERROR[engram.vessel.scene], factCols),
  ]
  const factRows: RenderElement[] = []
  for (let i = 0; i < facts.length; i += perRow) {
    factRows.push(
      <Box key={`facts:${i}`} flexDirection="row" gap={1}>
        {facts.slice(i, i + perRow)}
      </Box>,
    )
  }
  const where = whereRows(input.surfaces, engram).map(row => (
    <Box key={`where:${row.icon}`} flexDirection="row" gap={1} alignItems="flex-start">
      {surfaceIcon(kit, row.icon, row.isOn ? THEME.amber : THEME.faint, `where-icon:${row.icon}`)}
      <Box key="where-text" flexDirection="column" flexShrink={1}>
        <Text bold color={THEME.white}>
          {ICON_NAMES[row.icon]}
        </Text>
        <Text color={THEME.muted} wrap="wrap">
          {row.text}
        </Text>
      </Box>
    </Box>
  ))
  const surfacesLink = <Button key="page-surfaces" label="Surfaces" plain onPress={input.onSurfaces} />
  return (
    <Box key={`page:${id}`} flexDirection="column" width={kit.cols} paddingX={1} gap={1} backgroundColor={THEME.void}>
      {header(kit, { key: 'page-back', ...input.back })}
      {hudPreview(kit, input)}
      <Box key="preview-row" flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
        <Box key="preview-moods" flexDirection="row" gap={1}>
          {PREVIEW_MOODS.map(mood => chip(kit, `preview-mood:${mood}`, MOOD_NAMES[mood], !preview.isError && preview.mood === mood, () => input.onMood(mood)))}
        </Box>
        <Box key="preview-error-box" borderStyle="round" borderColor={THEME.ember}>
          <Button key="preview-error" label="Error" plain onPress={input.onError} />
        </Box>
      </Box>
      <Box key="about" flexDirection="column">
        {label(kit, `${input.isAwake ? 'Awake · ' : ''}${engram.plugin ? 'your Engram' : 'bundled Engram'}`, 'about-label')}
        <Text key="about-name" bold color={THEME.white}>
          {engram.name}
        </Text>
        {accentRule(kit, 'about-rule')}
        <Text key="about-description" color={THEME.body} wrap="wrap">
          {engram.description}
        </Text>
      </Box>
      <Box key="actions" flexDirection="row" flexWrap="wrap" gap={1}>
        {input.isAwake ? button(kit, 'page-sleep', 'Sleep', input.onSleep) : button(kit, 'page-awaken', 'Awaken', input.onAwaken)}
        {button(kit, 'page-remix', 'Remix with Claude', input.onRemix)}
        {input.onPublish ? button(kit, 'page-publish', 'Publish', input.onPublish) : null}
      </Box>
      {panel(kit, 'where', 'Where it draws', surfacesLink, where)}
      <Box key="facts" flexDirection="column" gap={1}>
        {factRows}
      </Box>
    </Box>
  )
}
