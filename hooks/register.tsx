import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import type { Mood, VesselState, VesselView } from '../types'
import { DEFAULT_ENGRAM, ENGRAMS, RESTING, soulSection } from './engrams'
import type { Engram } from './engrams'
import { BLEND_STEPS, blendTestSvg } from './blend-test'
import { MEASURE_HELP, REFERENCE_PX, bandReport, paneReport, referenceSvg } from './measure'
import { mediaCases } from './media-test'
import { NET_PROBES, PROBE_TIMEOUT_MS, describeOutcome } from './net-probe'
import type { NetProbe, Outcome } from './net-probe'
import {
  PLACEMENT_HELP,
  PLACEMENT_SETTINGS,
  bandShows,
  effectivePlacement,
  isPlacementSetting,
  opensPane,
  readPlacement,
  readStatusLine,
} from './placement'
import type { Placement, PlacementSetting } from './placement'
import { EMPTY, step } from './resolver'
import type { Model, Signal, TurnEndReason } from './resolver'
import { FACES, SPRITE_PALETTE, vesselSvg } from './sprite'
import { renderScene } from './field'
import { krakenWaterScene } from './kraken'
import { voidScene } from './lich'
import { SCENES } from './scenes'
import { BAND_SCENE_PX, BAND_STAGE_PX, PX_PER_COLUMN, PX_PER_ROW, sceneSize, stageSize, stageSvg } from './stage'

const PANE = 'eidola'
const STORE_KEY = 'engram'

const viewAtom = atom({ plugin: 'eidola', key: 'view' } as const, {
  state: 'idle',
  detail: '',
} as VesselView)
// The drawings read the mood alone, so a tool's detail never redraws them.
const moodAtom = atom({ plugin: 'eidola', key: 'mood' } as const, 'idle' as Mood)
const engramAtom = atom({ plugin: 'eidola', key: 'engram' } as const, DEFAULT_ENGRAM as string | null)
const mediaAtom = atom({ plugin: 'eidola', key: 'media' } as const, false)
const measureAtom = atom({ plugin: 'eidola', key: 'measure' } as const, false)
const blendAtom = atom({ plugin: 'eidola', key: 'blend' } as const, null as number | null)
const liveAtom = atom({ plugin: 'eidola', key: 'live' } as const, null as Mood | null)
const inkAtom = atom({ plugin: 'eidola', key: 'ink' } as const, 0)
const moodAtAtom = atom({ plugin: 'eidola', key: 'moodAt' } as const, 0)
const moodBeforeAtom = atom({ plugin: 'eidola', key: 'moodBefore' } as const, 'idle' as Mood)
const inkAtAtom = atom({ plugin: 'eidola', key: 'inkAt' } as const, 0)
const epochAtom = atom({ plugin: 'eidola', key: 'epoch' } as const, 0)

const LABELS: Record<VesselState, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  attention: 'Needs you',
  success: 'Done',
  responding: 'Replying',
  error: 'Hit an error',
  waiting: 'Waiting',
  sleeping: 'Asleep',
}

type Timer = ReturnType<EngineInterface['clock']['after']>

/** The state a drawing shows for a mood: its Vessel's idle, working or attention. */
const MOOD_STATE: Record<Mood, VesselState> = { idle: 'idle', working: 'working', attention: 'attention' }

// Resolver bookkeeping. Not drawn, so module variables are fine: a reload
// resets them and the next event puts them right.
let model: Model = EMPTY
let generation = 0
let pending: Timer | undefined
const svgCache = new Map<string, string>()
// Baked Vessel files, read once each. null: the file couldn't be read.
const fileCache = new Map<string, string | null>()
/** Cell rows the live band takes: it fills the band's own minimum height. */
const BAND_ROWS = 7
/** The Lich's band: tall enough for brow, eyes, nose and teeth at the pane's scale. */
const LICH_BAND_ROWS = 12

// What the band hook saw and drew last, for /eidola. Not drawn from.
type BandSeen = { surface: string; hasSurvey: boolean; isWorking: boolean; drew: 'engine' | 'strip' | 'strip+survey' }
let lastBand: BandSeen | undefined
/** Which clock each live drawing keeps, as it reported on starting: for /eidola. */
const liveClocks = new Map<string, string>()
// The scene last built for the pane and the band. A scene's loops are locked
// to the clock when it is built, so it is rebuilt only when its state or
// size changes; a redraw for anything else (a tool's detail) reuses it and
// the surface keeps the running drawing.
const lastScene = new Map<'pane' | 'band', { key: string; svg: string }>()

function sceneFor(where: 'pane' | 'band', key: string, build: () => string): string {
  const last = lastScene.get(where)
  if (last?.key === key) {
    return last.svg
  }
  const svg = build()
  lastScene.set(where, { key, svg })
  return svg
}

// Built stages by Engram, state and size. null: this Vessel gets no stage.
const stageCache = new Map<string, string | null>()

// The person's options. A change in /config reloads the module, so these
// are set once per load in register().
let placementSetting: PlacementSetting = 'default'
let isStatusLineOn = true

function engramOf(id: string | null): Engram | undefined {
  return id === null ? undefined : ENGRAMS[id]
}

/** The built-in sprite for a state, at a size. */
function spriteSvg(state: VesselState, size: number): string {
  const key = `sprite:${state}:${size}`
  let svg = svgCache.get(key)
  if (svg === undefined) {
    svg = vesselSvg(state, SPRITE_PALETTE, size)
    svgCache.set(key, svg)
  }
  return svg
}

/**
 * The Engram's baked SVG for a state, from vessels/<pack>/<state>.svg in
 * the mod. A file that can't be read falls back to the built-in sprite, so
 * a Vessel always shows.
 */
async function vesselFor($: EngineInterface, engram: Engram, state: VesselState, size: number): Promise<string> {
  const key = `${engram.vessel.pack}/${state}`
  if (!fileCache.has(key)) {
    try {
      fileCache.set(key, await $.fs.read(`${$.plugin.root}/vessels/${key}.svg`))
    } catch {
      fileCache.set(key, null)
    }
  }
  return fileCache.get(key) ?? spriteSvg(state, size)
}

/** The width that fits a drawing inside a size-by-size box, read from its viewBox. */
function fitWidth(svg: string, size: number): number {
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg)
  const w = Number(box?.[1])
  const h = Number(box?.[2])
  return w > 0 && h > w ? Math.round((size * w) / h) : size
}

/** One probe, never rejecting: the line says what happened. */
async function probeLine($: EngineInterface, probe: NetProbe): Promise<string> {
  let timer: Timer | undefined
  const timeout = new Promise<Outcome>(resolve => {
    timer = $.clock.after(PROBE_TIMEOUT_MS, () => resolve({ kind: 'timeout' }))
  })
  const fetched = $.http
    .fetch(probe.url, { method: 'GET' })
    .then((res): Outcome => ({ kind: 'status', status: res.status }))
    .catch((error: unknown): Outcome => ({
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    }))
  const outcome = await Promise.race([fetched, timeout])
  timer?.cancel()
  return describeOutcome(probe, outcome)
}

function setStatus($: EngineInterface, text: string | undefined): void {
  $.ui.status(isStatusLineOn ? text : undefined)
}

/** Where the Vessel appears now: the person's option, else the Engram's suggestion. */
async function currentPlacement($: EngineInterface): Promise<Placement> {
  const engram = engramOf(await read($, engramAtom)) ?? RESTING
  return effectivePlacement(placementSetting, engram.vessel.placement)
}

async function show($: EngineInterface, view: VesselView): Promise<void> {
  const current = await read($, viewAtom)
  if (current.state === view.state && current.detail === view.detail) {
    return
  }
  await update($, viewAtom, () => view)
  const engram = engramOf(await read($, engramAtom))
  setStatus($, engram ? `${engram.engram.name} · ${LABELS[view.state].toLowerCase()}` : undefined)
}

/** Something went wrong: count it, and when. */
async function bumpInk($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, inkAtom, n => n + 1)
  await update($, inkAtAtom, () => at)
}

/** What the live drawings share in their props: the mood, the ink, and the clock that keeps split drawings in step. */
async function liveProps($: EngineInterface) {
  return {
    mood: await read($, moodAtom),
    moodAt: await read($, moodAtAtom),
    moodBefore: await read($, moodBeforeAtom),
    ink: await read($, inkAtom),
    inkAt: await read($, inkAtAtom),
    epoch: await read($, epochAtom),
  }
}

/** The Lich's pane is drawn by four drawings, one above the next, each within its own bound. */
function lichSlices(rows: number): Array<[number, number]> {
  const cuts = [0, 1, 2, 3, 4].map(i => Math.round((rows * i) / 4))
  return [0, 1, 2, 3].map(i => [cuts[i]!, cuts[i + 1]! - cuts[i]!] as [number, number])
}

// Every hook goes through here, and nothing here may break a tool call or
// a turn: failures are swallowed and the Vessel just misses a beat.
async function signal($: EngineInterface, s: Signal): Promise<void> {
  try {
    const out = step(model, s)
    model = out.model
    generation += 1
    const mine = generation
    pending?.cancel()
    pending = undefined
    if ((await read($, moodAtom)) !== model.mood) {
      const mood = model.mood
      const at = await $.clock.now()
      const before = await read($, moodAtom)
      await update($, moodBeforeAtom, () => before)
      await update($, moodAtom, () => mood)
      await update($, moodAtAtom, () => at)
    }
    // Something went wrong: the live Kraken inks; the Lich is scorched.
    if ((s.kind === 'toolEnd' && !s.isOk) || (s.kind === 'turnEnd' && (s.reason === 'error' || s.reason === 'refusal'))) {
      await bumpInk($)
    }
    await show($, out.view)
    if (out.then) {
      const later = out.then.view
      pending = $.clock.after(out.then.ms, () => {
        if (generation === mine) {
          void show($, later).catch(() => undefined)
        }
      })
    }
  } catch {
    // The Vessel is decoration; never let it cost the session anything.
  }
}

async function setEngram($: EngineInterface, id: string | null): Promise<void> {
  await $.store.set(STORE_KEY, id)
  await update($, engramAtom, () => id)
  const engram = engramOf(id)
  setStatus($, engram ? `${engram.engram.name} · awake` : undefined)
  // An open pane is retitled with the new name; a closed one stays closed.
  try {
    const panes = await $.ui.panes()
    if (panes.some(one => one.id === PANE)) {
      await $.ui.open({ id: PANE, title: paneTitle(engram) })
    }
  } catch {
    // The old title is only cosmetic.
  }
  // A different Engram may suggest a different placement.
  $.ui.invalidate('ui.render')
}

/** The pane's title: the awake Engram's name, else Eidola. */
function paneTitle(engram: Engram | undefined): string {
  return engram ? engram.engram.name : 'Eidola'
}

// Under the `auto` placement the band steps aside while the pane is placed.
// Every open and close redraws it to keep that true.
async function isPanePlaced($: EngineInterface): Promise<boolean> {
  try {
    const panes = await $.ui.panes()
    return panes.some(one => one.id === PANE && one.isPlaced)
  } catch {
    // Can't tell: show the band rather than risk showing no Vessel at all.
    return false
  }
}

async function openPane($: EngineInterface) {
  const opened = await $.ui.open({ id: PANE, title: paneTitle(engramOf(await read($, engramAtom))) })
  $.ui.invalidate('ui.render')
  return opened
}

function listText(active: string | null): string {
  return Object.values(ENGRAMS)
    .map(one => {
      const mark = one.engram.id === active ? ' (awake)' : ''
      return `${one.engram.id}${mark}: ${one.engram.meta.description}`
    })
    .join('\n')
}

async function placeText($: EngineInterface): Promise<string> {
  const now = await currentPlacement($)
  const options = PLACEMENT_SETTINGS.map(one => `  ${one}: ${PLACEMENT_HELP[one]}`).join('\n')
  return `Placement: ${now} (setting: ${placementSetting}).\nChange it with /eidola place <setting>:\n${options}`
}

export const register: Register = (on, options) => {
  placementSetting = readPlacement(options)
  isStatusLineOn = readStatusLine(options)

  // ── Session ────────────────────────────────────────────────────────────

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'eidola', description: 'Open the Eidola Vessel pane' })
    await $.command.register({
      name: 'awaken',
      description: 'Awaken an Engram: its Vessel reacts and its Soul joins the system prompt',
      argumentHint: '<engram>',
    })
    await $.command.register({ name: 'sleep', description: 'Put the awake Engram to sleep and remove its Soul' })
    await $.command.register({ name: 'engrams', description: 'List the bundled Engrams' })

    if (!(await read($, epochAtom))) {
      const now = await $.clock.now()
      await update($, epochAtom, () => now)
    }

    const stored = await $.store.get(STORE_KEY)
    const id = stored === undefined ? DEFAULT_ENGRAM : typeof stored === 'string' && ENGRAMS[stored] ? stored : null
    await update($, engramAtom, () => id)

    if (!isStatusLineOn) {
      $.ui.status(undefined)
    }
    if (opensPane(await currentPlacement($))) {
      void openPane($).catch(() => undefined)
    }
    await signal($, { kind: 'session' })

    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if (opensPane(await currentPlacement($))) {
      void openPane($).catch(() => undefined)
    }
    return result
  })

  // ── Engine events → Vessel state ──────────────────────────────────────

  // The Soul also rides each typed prompt as hidden context. prompt.compose
  // alone didn't reach the model in the Claude app's cloud sessions, which
  // bring their own system prompt; this path works on every surface.
  on('prompt.submit', async ($, e, next) => {
    await signal($, { kind: 'prompt' })
    const engram = engramOf(await read($, engramAtom))
    if (!engram) {
      return next(e)
    }
    const soul = `<eidola-soul engram="${engram.engram.id}">\n${soulSection(engram)}\n</eidola-soul>`
    return next({ ...e, context: [...(e.context ?? []), soul] })
  }).catch(($, e, next) => next(e))

  // turn.start carries no agentId: it fires for the main loop only.
  on('turn.start', async ($, e, next) => {
    await signal($, { kind: 'turnStart' })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await signal($, { kind: 'toolStart', tool: e.tool })
    let isOk = true
    try {
      const ran = await next(e)
      isOk = !(ran.deny === undefined && ran.isError === true)
      return ran
    } catch (error) {
      isOk = false
      throw error
    } finally {
      await signal($, { kind: 'toolEnd', tool: e.tool, isOk })
    }
  }).catch(($, e, next) => next(e))

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask') {
      await signal($, { kind: 'ask', tool: e.tool })
    }
    return verdict
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    await signal($, { kind: 'compact' })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await signal($, { kind: 'turnEnd', reason: e.reason as TurnEndReason })
    }
    return next(e)
  })

  // ── Soul ───────────────────────────────────────────────────────────────

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const engram = engramOf(await read($, engramAtom))
    if (!engram) {
      return composed
    }
    return {
      ...composed,
      sections: [
        ...composed.sections.filter(one => one.id !== 'eidola:soul'),
        { id: 'eidola:soul', text: soulSection(engram), scope: 'session' as const },
      ],
    }
  })

  // ── Commands ───────────────────────────────────────────────────────────

  // /eidola        diagnostics: surfaces, pane, band, network reach
  // /eidola media  toggles the media test in the pane
  // /eidola place  shows or sets where the Vessel appears
  on('command.run', { command: 'eidola' }, async ($, e) => {
    const [sub = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)

    if (sub === 'place') {
      if (!value) {
        return { text: await placeText($) }
      }
      if (!isPlacementSetting(value)) {
        return { text: `"${value}" isn't a placement.\n${await placeText($)}` }
      }
      // Written as the person's own /config choice; the module reloads with it.
      const written = await $.config.set({ key: 'eidola.placement', value })
      if ('deny' in written && written.deny !== undefined) {
        return { text: `Couldn't change the placement here (${written.deny}). Set it in /config instead.` }
      }
      return { text: `Placement set to ${value}: ${PLACEMENT_HELP[value]}.` }
    }

    if (sub === 'ink') {
      await bumpInk($)
      const awake = engramOf(await read($, engramAtom))
      return { text: awake?.vessel.scene === 'lich' ? 'The Lich is scorched.' : 'The Kraken inks.' }
    }

    if (sub === 'live') {
      // Each run moves to the next mood; `off` ends it.
      const order: Mood[] = ['idle', 'working', 'attention']
      const was = await read($, liveAtom)
      const next = value === 'off' ? null : order[was === null ? 0 : (order.indexOf(was) + 1) % order.length]!
      await update($, liveAtom, () => next)
      const opened = await openPane($)
      if (next === null) {
        return { text: 'Live test off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Live test: ${next}.${where}\n` +
          'Run /eidola live again to move to the next mood. Watch the pane as you do:\n' +
          '  continuous: the disc glides to its new spot, the frame count keeps climbing\n' +
          '  restarted: a blink, and the frame count starts over\n' +
          '/eidola live off ends it.',
      }
    }

    if (sub === 'blend') {
      // Each run moves to the next mood; `off` ends it.
      const was = await read($, blendAtom)
      const next = value === 'off' ? null : was === null ? 0 : (was + 1) % BLEND_STEPS.length
      await update($, blendAtom, () => next)
      const opened = await openPane($)
      if (next === null) {
        return { text: 'Blend test off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Blend test: ${BLEND_STEPS[next]} (the drawing is ${next}px shorter; its source is unchanged).${where}\n` +
          'Run /eidola blend again to move to the next mood. Watch the pane as you do:\n' +
          '  blends: the disc glides, the colour shifts, the bar keeps filling\n' +
          '  reloads: a blink, and the bar and ring start over\n' +
          '/eidola blend off ends it.',
      }
    }

    if (sub === 'measure') {
      const isOn = !(await read($, measureAtom))
      await update($, measureAtom, () => isOn)
      const opened = await openPane($)
      if (!isOn) {
        return { text: 'Measure off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so only the band shows.`
      return { text: MEASURE_HELP + where }
    }

    if (sub === 'media') {
      const isOn = !(await read($, mediaAtom))
      await update($, mediaAtom, () => isOn)
      const opened = await openPane($)
      if (!isOn) {
        return { text: 'Media test off.' }
      }
      const where = opened.isPlaced ? 'It is in the Eidola pane.' : `But the pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Media test on. ${where}\n` +
          'Three clips, each a square sliding across with frames numbered 1-8:\n' +
          '  A · GIF in SVG, sandboxed frame\n' +
          '  B · GIF in SVG, plain image\n' +
          '  C · WebM in SVG, sandboxed frame\n' +
          'Report which ones move. Run /eidola media again to turn it off.',
      }
    }

    const surfaces = await $.session.surfaces()
    const opened = await openPane($)
    const placement = await currentPlacement($)
    const panes = await $.ui.panes()
    const mine = panes.find(one => one.id === PANE)
    const probes = await Promise.all(NET_PROBES.map(probe => probeLine($, probe)))
    const lines = [
      `Surfaces: ${surfaces.length ? surfaces.join(', ') : 'none attached'}`,
      opened.isPlaced ? 'Pane: placed.' : `Pane: not placed (${opened.reason})`,
      mine ? `Pane state: shown=${mine.isShown} placed=${mine.isPlaced}` : 'Pane state: not in the pane list',
      `Placement: ${placement} (setting: ${placementSetting}). Band: ${
        bandShows(placement, opened.isPlaced) ? 'showing' : 'hidden'
      }. Status line: ${isStatusLineOn ? 'on' : 'off'}.`,
      lastBand
        ? `Band hook last saw: ${lastBand.surface}, survey=${lastBand.hasSurvey}, working=${lastBand.isWorking}; drew ${lastBand.drew}.`
        : 'Band hook: not asked to draw since the mod loaded.',
      liveClocks.size
        ? `Live drawings' clocks: ${[...liveClocks].map(([k, v]) => `${k} ${v}`).join(', ')}.`
        : "Live drawings' clocks: none reported.",
      'Network, from where this session runs:',
      ...probes.map(line => `  ${line}`),
    ]
    return { text: lines.join('\n') }
  })

  // The person closing the pane brings the band back.
  // A live drawing reports, on starting, whether it keeps the shared clock.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { clock?: unknown } | null
    if (data && typeof data === 'object' && typeof data.clock === 'string') {
      liveClocks.set(e.element, data.clock)
      return {}
    }
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE) {
      $.ui.invalidate('ui.render')
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'awaken' }, async ($, e) => {
    const id = e.args.trim().toLowerCase() || DEFAULT_ENGRAM
    const engram = ENGRAMS[id]
    if (!engram) {
      return { text: `No Engram called "${id}". Bundled Engrams:\n${listText(await read($, engramAtom))}` }
    }
    await setEngram($, id)
    void openPane($).catch(() => undefined)
    return { text: `${engram.engram.name} is awake. Their Soul applies from your next message.` }
  })

  on('command.run', { command: 'sleep' }, async $ => {
    const engram = engramOf(await read($, engramAtom))
    await setEngram($, null)
    return { text: engram ? `${engram.engram.name} is asleep. Their Soul is gone from your next message.` : 'Nothing was awake.' }
  })

  on('command.run', { command: 'engrams' }, async $ => ({ text: listText(await read($, engramAtom)) }))

  // ── The pane ───────────────────────────────────────────────────────────

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const id = await read($, engramAtom)
    const mood = await read($, moodAtom)
    const awake = engramOf(id)
    const engram = awake ?? RESTING
    const state: VesselState = awake ? MOOD_STATE[mood] : 'sleeping'

    if (await read($, measureAtom)) {
      const columns = e.props.bodyColumns
      const rows = e.props.scroll.bodyRows
      const lines = paneReport(e.surface, e.props.placement, columns, rows)
      if (e.surface === 'terminal') {
        const { Box, Text } = $.ui.resolve(e)
        return <Box flexDirection="column">{lines.map(line => <Text key={line}>{line}</Text>)}</Box>
      }
      const { Box, Text, Svg } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" height="100%" backgroundColor="#1e3a5f">
          <Box flexDirection="column" width={columns} height={rows} borderStyle="single" borderColor="yellow" gap={1}>
            {lines.map(line => (
              <Text key={line}>{line}</Text>
            ))}
            <Svg key="measure:ref" source={referenceSvg()} alt={`${REFERENCE_PX}px reference square`} width={REFERENCE_PX} height={REFERENCE_PX} />
          </Box>
        </Box>
      )
    }

    // The Vessel on its stage, no text: the pane's title names the Engram and
    // the status line carries the state, so the body repeats neither.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{FACES[state]}</Text>
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)

    const live = await read($, liveAtom)
    if (live !== null && e.surface === 'desktop') {
      const surface = e.surface
      const { Client } = $.ui.resolve(e)
      // A row short of the body, so the drawing never asks the pane to scroll.
      const cols = e.props.bodyColumns
      const rows = Math.max(4, e.props.scroll.bodyRows - 1)
      return <Client key="live" module="./live-test.tsx" props={{ mood: live, cols, rows, surface }} width={cols} height={rows} />
    }

    const blend = await read($, blendAtom)
    if (blend !== null) {
      const { width, height } = sceneSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
      return <Svg key="blend" source={blendTestSvg(width, height)} alt={`Blend test: ${BLEND_STEPS[blend]}`} width={width} height={height - blend} isInteractive />
    }

    // The live Kraken, where a Client can draw (desktop): still water drawn
    // once as an SVG whose source never changes, the creature drawn live over
    // it. A new mood reaches the running Client as props: no reload, no cut.
    if (awake?.vessel.scene === 'kraken' && e.surface === 'desktop' && e.props.placement === 'dock' && !(await read($, mediaAtom))) {
      const { Client } = $.ui.resolve(e)
      const { width, height } = sceneSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
      const now = await $.clock.now()
      const water = sceneFor('pane', `kraken-water:${width}x${height}`, () => renderScene(krakenWaterScene(width, height), now))
      const cols = e.props.bodyColumns
      const rows = Math.max(4, e.props.scroll.bodyRows - 1)
      return (
        <Box width={cols} height={rows}>
          {/* Nothing here may change with the mood, alt included: a changed prop reloads the drawing. */}
          <Svg key="scene:water" source={water} alt={`${awake.engram.name} in deep water`} width={width} height={height} isInteractive />
          <Box position="absolute" top={0} left={0}>
            <Client key="kraken-live" module="./kraken-live.tsx" props={{ mood, cols, rows, ink: await read($, inkAtom) }} width={cols} height={rows} />
          </Box>
        </Box>
      )
    }

    // The Lich live, the same way: the dark it hangs in drawn once, and it
    // drawn over that in glyphs, in four slices, top to bottom, that keep in step.
    if (awake?.vessel.scene === 'lich' && e.surface === 'desktop' && e.props.placement === 'dock' && !(await read($, mediaAtom))) {
      const { Client } = $.ui.resolve(e)
      const { width, height } = sceneSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
      const now = await $.clock.now()
      const backdrop = sceneFor('pane', `lich-void:${width}x${height}`, () => renderScene(voidScene(width, height, 'pane'), now))
      const cols = e.props.bodyColumns
      const rows = Math.max(6, e.props.scroll.bodyRows - 1)
      const shared = { ...(await liveProps($)), cols, rows }
      const [a, b, c, d] = lichSlices(rows)
      return (
        <Box width={cols} height={rows}>
          {/* Nothing here may change with the mood, alt included: a changed prop reloads the drawing. */}
          <Svg key="scene:void" source={backdrop} alt={`${awake.engram.name} in the dark`} width={width} height={height} isInteractive />
          <Box position="absolute" top={0} left={0} flexDirection="column">
            <Client key="lich-0" module="./lich-live.tsx" props={{ ...shared, slice: a! }} width={cols} height={a![1]} />
            <Client key="lich-1" module="./lich-live.tsx" props={{ ...shared, slice: b! }} width={cols} height={b![1]} />
            <Client key="lich-2" module="./lich-live.tsx" props={{ ...shared, slice: c! }} width={cols} height={c![1]} />
            <Client key="lich-3" module="./lich-live.tsx" props={{ ...shared, slice: d! }} width={cols} height={d![1]} />
          </Box>
        </Box>
      )
    }

    // A scene Engram fills the whole body: its pane view in a tall dock, its
    // band view in a short or inline one.
    if (awake?.vessel.scene && !(await read($, mediaAtom))) {
      const views = SCENES[awake.vessel.scene]
      const { width, height } = sceneSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
      const isDeep = e.props.placement === 'dock' && height > width * 1.1
      const now = await $.clock.now()
      const scene = sceneFor('pane', `${isDeep ? 'deep' : 'surface'}:${state}:${width}x${height}`, () =>
        renderScene(isDeep ? views.pane(state, width, height) : views.band(state, width, height), now),
      )
      return <Svg key="scene:pane" source={scene} alt={`${awake.engram.name}: ${LABELS[state]}`} width={width} height={height} isInteractive />
    }

    // The Vessel alone, when it gets no stage.
    const size = Math.max(112, Math.min(208, e.props.bodyColumns * PX_PER_COLUMN))
    const cacheKey = `${engram.engram.id}:${state}:${size}`

    if (await read($, mediaAtom)) {
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Text bold>Media test</Text>
          <Text dimColor>Which ones move? Frames are numbered 1-8.</Text>
          {mediaCases().map(one => (
            <Box key={`media:${one.key}`} flexDirection="column" alignItems="center">
              <Text>{one.label}</Text>
              <Svg key={one.key} source={one.source} alt={one.label} width={96} isInteractive={one.isInteractive} />
            </Box>
          ))}
          <Text dimColor>Control: the sprite below uses CSS animation, which is known to work.</Text>
          <Svg key={`control:${state}`} source={spriteSvg(state, 64)} alt={`Sprite: ${LABELS[state]}`} width={64} isInteractive />
          <Button key="media-off" label="End media test" onPress={() => update($, mediaAtom, () => false)} />
        </Box>
      )
    }

    const svg = await vesselFor($, engram, state, size)
    const alt = `${engram.engram.name}: ${LABELS[state]}`
    const stage = stageSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
    const stageKey = `stage:${cacheKey}:${stage.width}x${stage.height}`
    let scene = stageCache.get(stageKey)
    if (scene === undefined) {
      scene = stageSvg(svg, state, stage) ?? null
      if (stageCache.size >= 64) {
        stageCache.clear()
      }
      stageCache.set(stageKey, scene)
    }
    if (scene !== null) {
      return <Svg key={stageKey} source={scene} alt={alt} width={stage.width} height={stage.height} isInteractive />
    }
    // No stage for this Vessel (no viewBox, or too large): the Vessel alone.
    return (
      <Box flexDirection="column" alignItems="center">
        <Svg key={cacheKey} source={svg} alt={alt} width={fitWidth(svg, size)} isInteractive />
      </Box>
    )
  })

  // ── The band above the prompt: shown only while no pane is placed ────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    lastBand = { surface: e.surface, hasSurvey: e.props.hasSurvey, isWorking: e.props.isWorking, drew: 'engine' }
    if (await read($, measureAtom)) {
      if (e.props.hasSurvey) {
        return next(e)
      }
      const lines = bandReport(e.surface, e.props.bodyColumns, e.props.maxRows, e.props.scroll.bodyRows)
      if (e.surface === 'terminal') {
        const { Box, Text } = $.ui.resolve(e)
        return <Box flexDirection="column">{lines.map(line => <Text key={line}>{line}</Text>)}</Box>
      }
      const { Box, Text, Svg } = $.ui.resolve(e)
      // Yellow: bodyColumns wide, 4 rows tall; the square under it.
      return (
        <Box flexDirection="column" gap={1} backgroundColor="#1e3a5f">
          <Box flexDirection="column" width={e.props.bodyColumns} height={4} borderStyle="single" borderColor="yellow">
            {lines.map(line => (
              <Text key={line}>{line}</Text>
            ))}
          </Box>
          <Svg key="measure:band-ref" source={referenceSvg()} alt={`${REFERENCE_PX}px reference square`} width={REFERENCE_PX} height={REFERENCE_PX} />
        </Box>
      )
    }
    const placement = await currentPlacement($)
    if (!bandShows(placement, placement === 'auto' && (await isPanePlaced($)))) {
      return next(e)
    }
    const awake = engramOf(await read($, engramAtom))
    const mood = await read($, moodAtom)
    const engram = awake ?? RESTING
    const state: VesselState = awake ? MOOD_STATE[mood] : 'sleeping'
    // The tool's detail lives in the status line; the band redraws only on a mood change.
    const detail = awake ? '' : 'No Engram awake'
    const line = `${engram.engram.name} · ${LABELS[state]}${detail ? ` · ${detail}` : ''}`

    // A survey (a question the engine or the app asks here) keeps the slot
    // too: the strip stays and the survey draws under it, rather than the
    // Vessel vanishing whenever a turn ends on a question.
    const withSurvey = async (strip: RenderElement): Promise<RenderElement> => {
      if (!e.props.hasSurvey) {
        lastBand = { ...lastBand!, drew: 'strip' }
        return strip
      }
      const survey = await next(e)
      lastBand = { ...lastBand!, drew: 'strip+survey' }
      const { Box } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" gap={1}>
          {strip}
          {survey}
        </Box>
      )
    }

    // The terminal draws the face alone; the line stays as the Svg's alt text.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return withSurvey(<Text>{FACES[state]}</Text>)
    }

    // The live Kraken in the band, where a Client can draw (desktop): still
    // water under the creature, framed for a wide strip. As in the pane,
    // nothing here changes with the mood but the Client's props.
    if (awake?.vessel.scene === 'kraken' && e.surface === 'desktop') {
      const { Box, Svg, Client } = $.ui.resolve(e)
      const cols = e.props.bodyColumns
      const rows = BAND_ROWS
      const width = Math.max(96, cols * PX_PER_COLUMN - 4)
      const height = rows * PX_PER_ROW - 2
      const now = await $.clock.now()
      const water = sceneFor('band', `kraken-water:${width}x${height}`, () => renderScene(krakenWaterScene(width, height), now))
      return withSurvey(
        <Box width={cols} height={rows}>
          <Svg key="scene:band-water" source={water} alt={`${engram.engram.name} in deep water`} width={width} height={height} isInteractive />
          <Box position="absolute" top={0} left={0}>
            <Client key="kraken-band" module="./kraken-live.tsx" props={{ mood, cols, rows, view: 'band', ink: await read($, inkAtom) }} width={cols} height={rows} />
          </Box>
        </Box>,
      )
    }

    // The Lich in the band: a strip across its face, over the dark, as tall
    // as the band allows up to twelve rows: fewer, and its face is a smear.
    if (awake?.vessel.scene === 'lich' && e.surface === 'desktop') {
      const { Box, Svg, Client } = $.ui.resolve(e)
      const cols = e.props.bodyColumns
      const rows = e.props.hasSurvey ? BAND_ROWS : Math.max(BAND_ROWS, Math.min(LICH_BAND_ROWS, e.props.maxRows))
      const width = Math.max(96, cols * PX_PER_COLUMN - 4)
      const height = rows * PX_PER_ROW - 2
      const now = await $.clock.now()
      const backdrop = sceneFor('band', `lich-void:${width}x${height}`, () => renderScene(voidScene(width, height, 'band'), now))
      return withSurvey(
        <Box width={cols} height={rows}>
          <Svg key="scene:band-void" source={backdrop} alt={`${engram.engram.name} in the dark`} width={width} height={height} isInteractive />
          <Box position="absolute" top={0} left={0}>
            <Client key="lich-band" module="./lich-live.tsx" props={{ ...(await liveProps($)), cols, rows, view: 'band' }} width={cols} height={rows} />
          </Box>
        </Box>,
      )
    }

    // A scene Engram fills the band edge to edge, no text: the status line
    // under the prompt names the state.
    if (awake?.vessel.scene) {
      const views = SCENES[awake.vessel.scene]
      const { Svg } = $.ui.resolve(e)
      const width = Math.max(96, e.props.bodyColumns * PX_PER_COLUMN - 4)
      const height = BAND_SCENE_PX
      const now = await $.clock.now()
      const scene = sceneFor('band', `${state}:${width}x${height}`, () => renderScene(views.band(state, width, height), now))
      return withSurvey(<Svg key="scene:band" source={scene} alt={line} width={width} height={height} isInteractive />)
    }

    // A status strip: the Vessel on a small square stage, its name and state
    // beside it.
    const { Box, Svg, Text } = $.ui.resolve(e)
    const size = BAND_STAGE_PX
    const cacheKey = `${engram.engram.id}:${state}:${size}`
    const svg = await vesselFor($, engram, state, size)
    const stageKey = `band-stage:${cacheKey}`
    let scene = stageCache.get(stageKey)
    if (scene === undefined) {
      scene = stageSvg(svg, state, { width: size, height: size }) ?? null
      stageCache.set(stageKey, scene)
    }
    return withSurvey(
      <Box flexDirection="row" alignItems="center" gap={1}>
        {scene !== null ? (
          <Svg key={stageKey} source={scene} alt={line} width={size} height={size} isInteractive />
        ) : (
          <Svg key={`band:${cacheKey}`} source={svg} alt={line} width={fitWidth(svg, 2 * PX_PER_ROW + 10)} isInteractive />
        )}
        <Box flexDirection="column">
          <Text bold>{`${engram.engram.name} · ${LABELS[state]}`}</Text>
          {detail ? (
            <Text dimColor wrap="truncate-end">
              {detail}
            </Text>
          ) : null}
        </Box>
      </Box>,
    )
  })
}
