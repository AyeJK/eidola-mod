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
import type { Engram } from './engram-types'
import { FRAME_STATES } from './hud'
import { ICON_NAMES, ICON_PX, iconSvg } from './icons'
import type { SurfaceIcon } from './icons'
import { showsLabel, whereItDraws } from './placement'
import type { Surfaces } from './placement'
import { RULE, THEME } from './theme'
import { WORDMARK_HEIGHT, WORDMARK_WIDTH, wordmarkSvg } from './wordmark'

/** The elements a screen draws with. `Svg` only where `isRich`. */
export type Els = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'>

/** How a button looks: the gold primary (Awaken), the deep red danger (Sleep), a neutral button, a chip on or off, or a gold underlined link. */
export type PillTone = 'primary' | 'danger' | 'neutral' | 'on' | 'off' | 'link'

/** Draws a button on the desktop, where register.tsx draws its label as a Client and wires the press. */
export type PillDraw = (key: string, label: string, onPress: () => void, tone: PillTone) => RenderElement

/**
 * What every screen piece needs: its elements, whether it may draw stills,
 * its width in cells, and, on the desktop, how a button is drawn.
 */
export type Kit = { els: Els; isRich: boolean; cols: number; pill?: PillDraw }

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
 * The one control every screen draws, in four tones: the gold primary, a
 * neutral button, and a chip on or off. On the desktop it is register.tsx's
 * (`kit.pill`): a rounded box with its label drawn as a Client, the whole
 * label the hit, one click, no inverting under the pointer. In text, a
 * Button in a bordered box.
 */
function pill(kit: Kit, key: string, label: string, onPress: () => void, tone: PillTone): RenderElement {
  if (kit.pill) {
    return kit.pill(key, label, onPress, tone)
  }
  const { Box, Button } = kit.els
  return (
    <Box key={`pill-${key}`} borderStyle="round" borderColor={tone === 'on' || tone === 'primary' ? THEME.gold : THEME.line} paddingX={1}>
      <Button key={key} label={label} plain {...(tone === 'off' ? { dimColor: true } : {})} onPress={onPress} />
    </Box>
  )
}

/** A button: neutral, the gold primary, or the deep red danger. */
export function button(kit: Kit, key: string, label: string, onPress: () => void, tone: 'neutral' | 'primary' | 'danger' = 'neutral'): RenderElement {
  return pill(kit, key, label, onPress, tone)
}

/** A chip: raised in bold when on, muted when off. */
export function chip(kit: Kit, key: string, label: string, isOn: boolean, onPress: () => void): RenderElement {
  return pill(kit, key, label, onPress, isOn ? 'on' : 'off')
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

/** The wordmark's scale in the header: twice its own size, so it reads as the screen's name. */
const WORDMARK_SCALE = 2

/**
 * The header: Back, then the wordmark at twice its size, and at the right
 * the screen's main action where it has one (a page's Awaken or Sleep). In
 * text, the same in bold.
 */
export function header(kit: Kit, back: { key: string; onPress: () => void }, action: RenderElement | null = null): RenderElement {
  const { Box, Text, Svg } = kit.els
  return (
    <Box key="head" flexDirection="row" justifyContent="space-between" alignItems="center" flexShrink={0}>
      <Box key="head-left" flexDirection="row" alignItems="center" gap={2}>
        {button(kit, back.key, '← Back', back.onPress)}
        {kit.isRich ? (
          <Svg key="wordmark" source={wordmarkSvg(THEME.gold)} alt="Eidola" width={WORDMARK_WIDTH * WORDMARK_SCALE} height={WORDMARK_HEIGHT * WORDMARK_SCALE} />
        ) : (
          <Text key="wordmark" bold color={THEME.gold}>
            EIDOLA
          </Text>
        )}
      </Box>
      {action}
    </Box>
  )
}

/** One choice of a dropdown. */
export type DropdownOption = { id: string; label: string }

/**
 * The filter dropdown in text, where no `Client` draws: the chosen option
 * and a caret as a chip, and, open, the options as chips in the flow under
 * it. The desktop draws its own (register.tsx), every row a full-width hit.
 */
export function dropdown(
  kit: Kit,
  input: { key: string; prefix: string; options: readonly DropdownOption[]; value: string; isOpen: boolean; onToggle: () => void; onPick: (id: string) => void },
): { trigger: RenderElement; menu: RenderElement | null } {
  const { Box } = kit.els
  const { key, options, value, isOpen } = input
  const chosen = options.find(one => one.id === value) ?? options[0]
  const trigger = chip(kit, `${key}-toggle`, `${input.prefix}: ${chosen?.label ?? ''} ${isOpen ? '▴' : '▾'}`, isOpen, input.onToggle)
  const menu = isOpen ? (
    <Box key={`${key}-menu`} flexDirection="row" flexWrap="wrap" gap={1}>
      {options.map(one => chip(kit, `${key}:${one.id}`, one.label, one.id === value, () => input.onPick(one.id)))}
    </Box>
  ) : null
  return { trigger, menu }
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
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={THEME.line} backgroundColor={THEME.panel} paddingX={kit.isRich ? 2 : 1} paddingY={kit.isRich ? 1 : 0}>
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

const RIGHTS: Record<Engram['rights'], string> = {
  original: 'Original: made by its author.',
  licensed: 'Licensed: shared with permission.',
}

/** A screen's side padding, in cells: roomier on the desktop. */
export function screenPad(kit: Kit): number {
  return kit.isRich ? 2 : 1
}

/** A screen's width inside its padding, in cells. */
export function screenInner(kit: Kit): number {
  return kit.cols - 2 * screenPad(kit)
}

/**
 * The preview's rows, from the pane's: a pane view about half the pane tall,
 * a band-only Engram's band strip about a third, each within bounds so it
 * neither shrinks to a sliver nor pushes the page off the pane.
 */
export function previewRows(engram: Engram, paneRows = 0): number {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
  return engram.vessel.shows.includes('pane') ? clamp(Math.round(paneRows * 0.45), 14, 28) : clamp(Math.round(paneRows * 0.32), 10, 18)
}

/** What the page draws and what its buttons do, from register.tsx. */
export type PageInput = {
  engram: Engram
  isAwake: boolean
  surfaces: Surfaces
  preview: Preview
  /** The live scene at the preview's mood, `screenInner` wide and `previewRows` tall: desktop only. */
  scene: RenderElement | null
  /** The pane's rows: the page fills them, and the preview is sized from them. */
  rows: number
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

/**
 * The preview: the live scene alone, edge to edge, nothing written over it:
 * the chips under it say which mood it shows. In text, the mood and the face.
 */
function hudPreview(kit: Kit, input: PageInput): RenderElement {
  const { Box, Text } = kit.els
  if (!kit.isRich || input.scene === null) {
    const look = input.preview.isError ? FRAME_STATES.error : FRAME_STATES[MOOD_STATE[input.preview.mood]]
    return (
      <Box key="preview" flexDirection="column" borderStyle="round" borderColor={THEME.line} paddingX={1}>
        <Text key="preview-mood" bold color={input.preview.isError ? THEME.errorText : THEME.amber}>
          {look.name}
        </Text>
        <Text key="preview-face" color={THEME.frost}>
          {input.face}
        </Text>
      </Box>
    )
  }
  return (
    <Box key="preview" width={screenInner(kit)} height={previewRows(input.engram, input.rows)} overflow="hidden" backgroundColor={THEME.preview}>
      {input.scene}
    </Box>
  )
}

/** A small card of the page: its label, and what it says, with room around both. */
function factCard(kit: Kit, key: string, title: string, text: string, width: number): RenderElement {
  const { Box, Text } = kit.els
  return (
    <Box key={key} flexDirection="column" width={width} gap={kit.isRich ? 1 : 0} borderStyle="round" borderColor={THEME.line} backgroundColor={THEME.card} paddingX={kit.isRich ? 2 : 1} paddingY={kit.isRich ? 1 : 0}>
      {label(kit, title, `${key}-label`)}
      <Text key={`${key}-text`} color={THEME.frost} wrap="wrap">
        {text}
      </Text>
    </Box>
  )
}

/**
 * An Engram's page, filling the pane. Back, and Awaken (gold) or Sleep at
 * the header's right; the live preview, about half the pane tall; the mood
 * chips and Error under it, which change the preview only; the name with
 * Remix with Claude (and Publish, on your own) at its right; what it is; and
 * three facts: what it draws, where it comes from, its rights.
 * Nothing is said twice: the action says whether it is awake, the chips say
 * the preview's mood, the Draws fact says where it draws.
 */
export function engramPage(kit: Kit, input: PageInput): RenderElement {
  const { Box, Text } = kit.els
  const { engram, preview } = input
  const id = engram.id
  const inner = screenInner(kit)
  const gap = kit.isRich ? 2 : 1
  const perRow = inner >= 60 ? 3 : inner >= 40 ? 2 : 1
  const factCols = Math.floor((inner - gap * (perRow - 1)) / perRow)
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
  ]
  const factRows: RenderElement[] = []
  for (let i = 0; i < facts.length; i += perRow) {
    factRows.push(
      <Box key={`facts:${i}`} flexDirection="row" alignItems="stretch" gap={gap}>
        {facts.slice(i, i + perRow)}
      </Box>,
    )
  }
  return (
    <Box key={`page:${id}`} flexDirection="column" width={kit.cols} minHeight={input.rows} paddingX={screenPad(kit)} paddingY={1} gap={gap} backgroundColor={THEME.void}>
      {header(
        kit,
        { key: 'page-back', ...input.back },
        input.isAwake ? button(kit, 'page-sleep', 'Sleep', input.onSleep, 'danger') : button(kit, 'page-awaken', 'Awaken', input.onAwaken, 'primary'),
      )}
      <Box key="hero" flexDirection="column" gap={1}>
        {hudPreview(kit, input)}
        <Box key="preview-moods" flexDirection="row" flexWrap="wrap" gap={1}>
          {PREVIEW_MOODS.map(mood => chip(kit, `preview-mood:${mood}`, MOOD_NAMES[mood], !preview.isError && preview.mood === mood, () => input.onMood(mood)))}
          {chip(kit, 'preview-error', 'Error', preview.isError, input.onError)}
        </Box>
      </Box>
      <Box key="about" flexDirection="column" gap={1}>
        <Box key="about-head" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
          <Text key="about-name" bold color={THEME.white}>
            {engram.name}
          </Text>
          <Box key="actions" flexDirection="row" flexWrap="wrap" gap={1}>
            {button(kit, 'page-remix', 'Remix with Claude', input.onRemix)}
            {input.onPublish ? button(kit, 'page-publish', 'Publish', input.onPublish) : null}
          </Box>
        </Box>
        <Text key="about-description" color={THEME.body} wrap="wrap">
          {engram.description}
        </Text>
      </Box>
      <Box key="facts" flexDirection="column" gap={gap}>
        {factRows}
      </Box>
    </Box>
  )
}
