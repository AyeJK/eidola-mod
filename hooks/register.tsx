import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { VesselState, VesselView } from '../types'
import { DEFAULT_ENGRAM, ENGRAMS, RESTING, soulSection } from './engrams'
import type { Engram } from './engrams'
import { mediaCases } from './media-test'
import { NET_PROBES, probeLine } from './net-probe'
import { EMPTY, step } from './resolver'
import type { Model, Signal, TurnEndReason } from './resolver'
import { FACES, vesselSvg } from './sprite'

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

function engramOf(id: string | null): Engram | undefined {
  return id === null ? undefined : ENGRAMS[id]
}

async function show($: EngineInterface, view: VesselView): Promise<void> {
  const current = await read($, viewAtom)
  if (current.state === view.state && current.detail === view.detail) {
    return
  }
  await update($, viewAtom, () => view)
  const engram = engramOf(await read($, engramAtom))
  $.ui.status(engram ? `${engram.engram.name} · ${LABELS[view.state].toLowerCase()}` : undefined)
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
  $.ui.status(engram ? `${engram.engram.name} · awake` : undefined)
}

// The band is the fallback for when no pane is up, so it steps aside while
// the pane is placed. Every open and close redraws it to keep that true.
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
  const opened = await $.ui.open({ id: PANE, title: 'Eidola' })
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

export const register: Register = on => {
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

    void openPane($).catch(() => undefined)
    await signal($, { kind: 'session' })

    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    void openPane($).catch(() => undefined)
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
  on('command.run', { command: 'eidola' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'media') {
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
    const panes = await $.ui.panes()
    const mine = panes.find(one => one.id === PANE)
    const probes = await Promise.all(NET_PROBES.map(probe => probeLine($, probe)))
    const lines = [
      `Surfaces: ${surfaces.length ? surfaces.join(', ') : 'none attached'}`,
      opened.isPlaced ? 'Pane: placed.' : `Pane: not placed (${opened.reason})`,
      mine ? `Pane state: shown=${mine.isShown} placed=${mine.isPlaced}` : 'Pane state: not in the pane list',
      opened.isPlaced ? 'Band: hidden while the pane is placed.' : 'Band: showing, as the fallback.',
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
    const detail = awake ? view.detail : 'No Engram awake'
    const ids = Object.keys(ENGRAMS)
    const nextId = ids[(ids.indexOf(engram.engram.id) + 1) % ids.length] ?? DEFAULT_ENGRAM
    const nextName = ENGRAMS[nextId]?.engram.name ?? nextId

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text bold>{engram.engram.name}</Text>
          <Text>{FACES[state]}</Text>
          <Text dimColor>
            {LABELS[state]}
            {detail ? ` · ${detail}` : ''}
          </Text>
          {awake ? (
            <Button key="sleep" label="Sleep" onPress={() => setEngram($, null)} />
          ) : (
            <Button key="awaken" label={`Awaken ${engram.engram.name}`} onPress={() => setEngram($, engram.engram.id)} />
          )}
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const size = Math.max(112, Math.min(208, (e.props.bodyColumns ?? 28) * 6))
    const cacheKey = `${engram.engram.id}:${state}:${size}`
    let svg = svgCache.get(cacheKey)
    if (svg === undefined) {
      svg = vesselSvg(state, engram.vessel.palette, size)
      svgCache.set(cacheKey, svg)
    }

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
          <Svg key={`control:${cacheKey}`} source={svg} alt={`${engram.engram.name}: ${LABELS[state]}`} width={64} isInteractive />
          <Button key="media-off" label="End media test" onPress={() => update($, mediaAtom, () => false)} />
        </Box>
      )
    }

    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Text bold>{engram.engram.name}</Text>
        <Svg key={cacheKey} source={svg} alt={`${engram.engram.name}: ${LABELS[state]}`} width={size} isInteractive />
        <Text dimColor>
          {LABELS[state]}
          {detail ? ` · ${detail}` : ''}
        </Text>
        <Box flexDirection="row" gap={1}>
          {awake ? (
            <Button key="sleep" label="Sleep" onPress={() => setEngram($, null)} />
          ) : (
            <Button key="awaken" variant="primary" label={`Awaken ${engram.engram.name}`} onPress={() => setEngram($, engram.engram.id)} />
          )}
          <Button key="switch" label={`Switch to ${nextName}`} onPress={() => setEngram($, nextId)} />
        </Box>
      </Box>
    )
  })

  // ── The band above the prompt: shown only while no pane is placed ────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await isPanePlaced($))) {
      return next(e)
    }
    const awake = engramOf(await read($, engramAtom))
    const view = await read($, viewAtom)
    const engram = awake ?? RESTING
    const state: VesselState = awake ? view.state : 'sleeping'
    const detail = awake ? view.detail : 'No Engram awake'
    const line = `${engram.engram.name} · ${LABELS[state]}${detail ? ` · ${detail}` : ''}`

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" gap={1}>
          <Text>{FACES[state]}</Text>
          <Text dimColor>{line}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    const size = 44
    const cacheKey = `${engram.engram.id}:${state}:${size}`
    let svg = svgCache.get(cacheKey)
    if (svg === undefined) {
      svg = vesselSvg(state, engram.vessel.palette, size)
      svgCache.set(cacheKey, svg)
    }
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg key={`band:${cacheKey}`} source={svg} alt={line} width={size} isInteractive />
        <Text dimColor>{line}</Text>
      </Box>
    )
  })
}
