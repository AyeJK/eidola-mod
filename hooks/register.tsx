import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { VesselState, VesselView } from '../types'
import { DEFAULT_ENGRAM, ENGRAMS, RESTING, soulSection } from './engrams'
import type { Engram } from './engrams'
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

const PANE = 'eidola'
const STORE_KEY = 'engram'

const viewAtom = atom({ plugin: 'eidola', key: 'view' } as const, {
  state: 'idle',
  detail: '',
} as VesselView)
const engramAtom = atom({ plugin: 'eidola', key: 'engram' } as const, DEFAULT_ENGRAM as string | null)
const mediaAtom = atom({ plugin: 'eidola', key: 'media' } as const, false)

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

// Resolver bookkeeping. Not drawn, so module variables are fine: a reload
// resets them and the next event puts them right.
let model: Model = EMPTY
let generation = 0
let pending: Timer | undefined
const svgCache = new Map<string, string>()
// Baked Vessel files, read once each. null: the file couldn't be read.
const fileCache = new Map<string, string | null>()

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
      'Network, from where this session runs:',
      ...probes.map(line => `  ${line}`),
    ]
    return { text: lines.join('\n') }
  })

  // The person closing the pane brings the band back.
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
    const view = await read($, viewAtom)
    const awake = engramOf(id)
    const engram = awake ?? RESTING
    const state: VesselState = awake ? view.state : 'sleeping'

    // The Vessel alone: the pane's title names the Engram and the status
    // line carries the state, so the body repeats neither.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{FACES[state]}</Text>
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const size = Math.max(112, Math.min(208, (e.props.bodyColumns ?? 28) * 6))
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
    return (
      <Box flexDirection="column" alignItems="center">
        <Svg key={cacheKey} source={svg} alt={`${engram.engram.name}: ${LABELS[state]}`} width={fitWidth(svg, size)} isInteractive />
      </Box>
    )
  })

  // ── The band above the prompt: shown only while no pane is placed ────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    const placement = await currentPlacement($)
    if (!bandShows(placement, placement === 'auto' && (await isPanePlaced($)))) {
      return next(e)
    }
    const awake = engramOf(await read($, engramAtom))
    const view = await read($, viewAtom)
    const engram = awake ?? RESTING
    const state: VesselState = awake ? view.state : 'sleeping'
    const detail = awake ? view.detail : 'No Engram awake'
    const line = `${engram.engram.name} · ${LABELS[state]}${detail ? ` · ${detail}` : ''}`

    // The Vessel alone, as in the pane; the line stays as its alt text.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{FACES[state]}</Text>
    }

    const { Box, Svg } = $.ui.resolve(e)
    const size = 44
    const cacheKey = `${engram.engram.id}:${state}:${size}`
    const svg = await vesselFor($, engram, state, size)
    return (
      <Box flexDirection="row" alignItems="center">
        <Svg key={`band:${cacheKey}`} source={svg} alt={line} width={fitWidth(svg, size)} isInteractive />
      </Box>
    )
  })
}
