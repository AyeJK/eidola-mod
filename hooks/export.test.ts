// The exported Lich (test/fixtures/exported-lich, written by
// `node scripts/export-engram.mjs lich test/fixtures/exported-lich`) draws
// exactly as the bundled Lich does. Three ways:
//
// - Eidola hands it the room and the state it gives the bundled Lich: a
//   plugin standing in for its hooks reads the hand-off back, and the bundled
//   Lich's own live drawings, awake in the same pane, are sized and fed the
//   same. Both show in the pane only: neither is drawn in the band.
// - Its drawing module, given that hand-off, draws the very tree Eidola draws
//   for the bundled Lich, the backdrop's source included.
// - The fixed-seed run matches: its lich-live.tsx, run tick by tick from the
//   same seed through the same moods and ink, draws every frame the bundled
//   one draws, in each slice of the pane and in the band, and lives through
//   the same states.
//
// The exported Kraken and Wisp (test/fixtures/exported-kraken and
// exported-wisp, written the same way) get the fixed-seed run too: their
// kraken-live.tsx and wisp-live.tsx draw every frame the bundled ones draw,
// in the pane and in the band.
//
// The kit loads an inline plugin from its register's source alone, so the
// export's own hooks (which import its drawing) can't be loaded as a plugin
// here: `claude plugin validate` and the checker (hooks/check.test.ts) check
// them, and the drawing, the part that draws, is run here.

import { describe, expect, test } from 'claude-code/testing'
import type { ClientElements, ClientSurface, Elements, On, UiPane } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'

import type { EidolaHandoff, Mood } from '../types'
import { draw as exportedDraw } from '../test/fixtures/exported-lich/hooks/draw'
import ExportedLive, { advance as exportedAdvance, born as exportedBorn } from '../test/fixtures/exported-lich/hooks/lich-live'
import { draw as bundledDraw } from '../engrams/lich/hooks/draw'
import BundledLive, { advance as bundledAdvance, born as bundledBorn } from './lich-live'
import ExportedKrakenLive from '../test/fixtures/exported-kraken/hooks/kraken-live'
import BundledKrakenLive from './kraken-live'
import ExportedWispLive from '../test/fixtures/exported-wisp/hooks/wisp-live'
import BundledWispLive from './wisp-live'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const UNPLACED: UiPane[] = []
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const
const BAND = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

/** test/fixtures/exported-lich/engram.json, as the tests' engine serves it (the kit reads no disk). */
const EXPORTED_ENGRAM = {
  spec: 2,
  id: 'exported-lich',
  name: 'Exported Lich',
  version: '0.1.0',
  author: 'eidola',
  description: 'A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.',
  rights: 'licensed',
  remixOf: 'lich',
  vessel: { scene: 'self', shows: ['pane', 'shrine'], thumbnails: { pane: 'thumb-pane.svg' }, hud: { show: true, meter: 'sparks', tag: 'sigil', label: 'serif', bracket: '#9a3c28' } },
  extensions: {},
}

/**
 * Stands in for the exported Lich's hooks: it announces the Engram, and
 * answers each hand-off with a Box keyed as the export's drawing is, holding
 * the hand-off as text for the test to read back.
 */
const STAND_IN: Plugin = {
  name: 'exported-lich',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/exported-lich' })
      return next(e)
    })
    on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => {
      const handoff = (e.props as { eidola?: { engram: string; columns: number; rows: number } }).eidola
      if (!handoff || handoff.engram !== 'exported-lich') {
        return next(e)
      }
      const { Box, Text } = $.ui.resolve(e)
      return Box({ key: 'eidola:exported-lich', width: handoff.columns, height: handoff.rows, children: [Text({ children: [`HANDOFF ${JSON.stringify(handoff)}`] })] })
    })
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const handoff = (e.props as { eidola?: { engram: string; columns: number; rows: number } }).eidola
      if (!handoff || handoff.engram !== 'exported-lich') {
        return next(e)
      }
      const { Box, Text } = $.ui.resolve(e)
      return Box({ key: 'eidola:exported-lich', width: handoff.columns, height: handoff.rows, children: [Text({ children: [`HANDOFF ${JSON.stringify(handoff)}`] })] })
    })
  },
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown }

/** Where the engine beneath hands the test the elements of the last drawing it was asked for. */
type Seen = { els?: Elements['desktop'] }

/** The engine beneath: the bundled packages and the export's files, panes that open placed, the clock fixed. */
function engine(on: On, awake: string, seen: Seen): void {
  servePackages(on, path => {
    const at = path.replace(/\\/g, '/')
    if (at.endsWith('/plugins/exported-lich/engram.json')) {
      return JSON.stringify(EXPORTED_ENGRAM)
    }
    if (at.endsWith('/plugins/exported-lich/.claude-plugin/plugin.json')) {
      return JSON.stringify({ name: 'exported-lich' })
    }
    if (at.endsWith('/plugins/exported-lich/hooks/hooks.json')) {
      return '{ "modules": ["./register.tsx"] }'
    }
    throw new Error(`ENOENT: ${path}`)
  })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    seen.els = $.ui.resolve(e) as Elements['desktop']
    return $.ui.resolve(e).Box({})
  })
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? awake : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

/** Mounts a pane nobody hooks: it reaches the engine beneath, which hands the test the desktop's elements. */
async function elementsOf($: Engine): Promise<void> {
  const probe = await $.ui.mount({ ...PANE, requestId: 'elements' })
  await probe.unmount()
}

/** Every element in a tree, depth first. */
function walk(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, out))
  } else if (node && typeof node === 'object') {
    out.push(node as Node)
    walk((node as Node).children, out)
  }
  return out
}

/** Every hand-off the stand-in drew, as its text. */
function handoffsIn(tree: unknown): string[] {
  return walk(tree)
    .flatMap(node => (Array.isArray(node.children) ? node.children : [node.children]))
    .filter((child): child is string => typeof child === 'string' && child.startsWith('HANDOFF '))
}

/** The hand-off the stand-in was given, read back out of the drawing. */
function handoffIn(tree: unknown): EidolaHandoff {
  const text = handoffsIn(tree)[0]
  expect(text, 'the stand-in drew the hand-off').toBeDefined()
  return JSON.parse(text!.slice('HANDOFF '.length)) as EidolaHandoff
}

/**
 * A drawing as plain data, as the surface is handed it: a Client's module by
 * its file's name (Eidola's drawn tree names it from the mod's folder, a
 * drawing module from its own file), and the engine's own `client` mark left out.
 */
function plain(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(plain)
  }
  if (node && typeof node === 'object') {
    const { client: _client, children, props, ...rest } = node as Node & { client?: unknown }
    const own = props ? { ...props } : undefined
    if (own && typeof own['module'] === 'string') {
      own['module'] = String(own['module']).split('/').pop()
    }
    return JSON.parse(JSON.stringify({ ...rest, ...(own ? { props: own } : {}), ...(children === undefined ? {} : { children: plain(children) }) }))
  }
  return node
}

/** The kit for a drawing: the Engram's name, the clock, and a backdrop built fresh. */
function kit(name: string) {
  return { name, now: NOW, memo: (_key: string, build: () => string) => build() }
}

describe('the exported Lich, handed off to', () => {
  test('Eidola hands it the room and the state it hands the bundled Lich, in the pane; neither draws in the band', { plugins: [STAND_IN] }, async ($, on) => {
    engine(on, 'exported-lich', {})
    await start($)
    expect((await $.command.run({ command: 'awaken', args: 'exported-lich', ...TYPED })).text).toBe('Exported Lich is awake.')
    await $.command.run({ command: 'eidola', args: 'mood working', ...TYPED })

    const pane = await $.ui.mount(PANE)
    const inPane = handoffIn(await pane.drawn())
    await pane.unmount()
    expect(inPane).toMatchObject({ engram: 'exported-lich', where: 'pane', columns: 52, rows: 75, mood: 'working' })
    // Pane only: the band is never handed off.
    const band = await $.ui.mount(BAND)
    expect(handoffsIn(await band.drawn())).toEqual([])
    await band.unmount()

    // The bundled Lich, awake in the same pane: its live drawing gets the same room and state.
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const lichPane = await $.ui.mount(PANE)
    const slice = (await lichPane.find({ type: 'Client', key: 'lich-0' }))?.props?.['props']
    await lichPane.unmount()
    const { contract: _contract, engram: _engram, where: _where, columns, rows, ...state } = inPane
    expect(slice).toMatchObject({ ...state, cols: columns, rows })
    // Pane only: no live strip in the band.
    const lichBand = await $.ui.mount(BAND)
    expect(await lichBand.find({ type: 'Client', key: 'lich-band' })).toBeUndefined()
    await lichBand.unmount()
  })

  test('its drawing module draws, from that hand-off, the tree Eidola draws for the bundled Lich', { plugins: [STAND_IN], timeoutMs: 30_000 }, async ($, on) => {
    const seen: Seen = {}
    engine(on, 'exported-lich', seen)
    await start($)
    await elementsOf($)
    for (const mood of ['idle', 'working', 'attention'] as const) {
      await $.command.run({ command: 'eidola', args: `mood ${mood}`, ...TYPED })
      if (mood === 'attention') {
        await $.command.run({ command: 'eidola', args: 'ink', ...TYPED })
      }
      // The pane only: both show nowhere else Eidola hands off.
      await $.command.run({ command: 'awaken', args: 'exported-lich', ...TYPED })
      const asked = await $.ui.mount(PANE)
      const handoff = handoffIn(await asked.drawn())
      await asked.unmount()

      await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
      const bundled = await $.ui.mount(PANE)
      const drawn = (await bundled.drawn()) as Node
      await bundled.unmount()
      // Eidola's frame holds the creature first.
      const creature = (((drawn.children as Node[])[0] as Node).children as Node[])[0] as Node

      const els = seen.els!
      const ours = exportedDraw(els, handoff, kit('Lich'))
      expect(plain(ours), `Pane, ${mood}`).toEqual(plain(creature))
      expect(plain(ours), `Pane, ${mood}`).toEqual(plain(bundledDraw(els, handoff, kit('Lich'))))
    }
  })
})

/** A surface for a Client module run by hand: its timer stepped one tick at a time, its state kept. */
function runner<P>(module: unknown, elements: ClientElements, columns: number, rows: number) {
  let state: unknown
  let tick: (() => void) | undefined
  const surface: ClientSurface<unknown> = {
    elements,
    get state() {
      return state
    },
    setState: next => {
      state = next
    },
    columns,
    rows,
    every: (_ms, fn) => {
      tick = fn
      return () => {
        tick = undefined
      }
    },
    onPointer: () => () => undefined,
    onKey: () => () => undefined,
    post: () => undefined,
  }
  const draw = module as (props: P, surface: ClientSurface<unknown>) => unknown
  return {
    frame: (props: P) => JSON.stringify(draw(props, surface)),
    step: () => tick?.(),
  }
}

type LiveProps = { mood: Mood; ink: number; cols: number; rows: number; slice?: [number, number]; view?: 'pane' | 'band' }

/**
 * Runs a bundled live module and its exported copy side by side, tick by
 * tick, through idle, work, an error and attention, and returns the frames
 * each draws every third tick and on every change. No epoch: each keeps its
 * own clock, from the same seed. (A frame costs tens of milliseconds to
 * draw; between frames the ticks still run, so every tick's state is in the
 * next.)
 */
function bothRuns(
  modules: { ours: unknown; theirs: unknown },
  elements: ClientElements,
  base: Omit<LiveProps, 'mood' | 'ink'>,
  ticks: number,
): [string[], string[]] {
  const script = (t: number): Pick<LiveProps, 'mood' | 'ink'> => ({ mood: t < 25 ? 'idle' : t < 55 ? 'working' : 'attention', ink: t < 45 ? 0 : 1 })
  const height = base.slice ? base.slice[1] : base.rows
  const ours = runner<LiveProps>(modules.ours, elements, base.cols, height)
  const theirs = runner<LiveProps>(modules.theirs, elements, base.cols, height)
  const a: string[] = []
  const b: string[] = []
  for (let t = 0; t < ticks; t += 1) {
    const props = { ...base, ...script(t) }
    if (t % 3 === 0 || JSON.stringify(script(t)) !== JSON.stringify(script(t - 1))) {
      a.push(ours.frame(props))
      b.push(theirs.frame(props))
    }
    ours.step()
    theirs.step()
  }
  return [a, b]
}

/** The desktop's elements, as a Client module is handed them. */
async function clientElements($: Engine, on: On): Promise<ClientElements> {
  const seen: Seen = {}
  engine(on, 'lich', seen)
  await elementsOf($)
  expect(seen.els).toBeDefined()
  return seen.els as unknown as ClientElements
}

/** Every frame of the exported run is the bundled run's, and the bundled one moves. */
function expectSameRun([ours, theirs]: [string[], string[]], label: string, moves: number): void {
  expect(new Set(theirs).size, `${label} moves`).toBeGreaterThan(moves)
  expect(ours.length, label).toBe(theirs.length)
  for (let t = 0; t < theirs.length; t += 1) {
    expect(ours[t], `${label}, tick ${t}`).toBe(theirs[t])
  }
}

const LICH = { ours: ExportedLive, theirs: BundledLive }
const KRAKEN = { ours: ExportedKrakenLive, theirs: BundledKrakenLive }
const WISP = { ours: ExportedWispLive, theirs: BundledWispLive }

describe('the exported Lich, run', () => {
  test("the fixed-seed run matches: the frames of the pane's four slices and of the band, through each mood and an error", { timeoutMs: 60_000 }, async ($, on) => {
    const elements = await clientElements($, on)
    const [cols, rows] = [52, 75]
    const cuts = [0, 19, 38, 56, 75]
    for (let i = 0; i < 4; i += 1) {
      expectSameRun(bothRuns(LICH, elements, { cols, rows, slice: [cuts[i]!, cuts[i + 1]! - cuts[i]!] }, 90), `slice ${i}`, 5)
    }
    expectSameRun(bothRuns(LICH, elements, { cols: 100, rows: 12, view: 'band' }, 90), 'the band', 3)
  })

  test('from the same seed it lives through the same states, tick for tick', () => {
    const carry = { mood: 'idle', moodNext: 'idle', moodTick: 0, inkSeen: 0, inkPending: false, inkTick: 0 } as const
    const [W, H] = [416, 1425]
    for (const view of ['pane', 'band'] as const) {
      const ours = exportedBorn(carry, view, 0)
      const theirs = bundledBorn(carry, view, 0)
      const pastOurs: Parameters<typeof exportedAdvance>[1] = []
      const pastTheirs: Parameters<typeof bundledAdvance>[1] = []
      for (let t = 0; t < 600; t += 1) {
        if (t === 100) {
          ours.moodNext = theirs.moodNext = 'working'
          ours.moodTick = theirs.moodTick = 101
        }
        if (t === 300) {
          ours.inkSeen = theirs.inkSeen = 1
          ours.inkPending = theirs.inkPending = true
          ours.inkTick = theirs.inkTick = 301
        }
        if (t === 400) {
          ours.moodNext = theirs.moodNext = 'attention'
          ours.moodTick = theirs.moodTick = 401
        }
        exportedAdvance(ours, pastOurs, W, H)
        bundledAdvance(theirs, pastTheirs, W, H)
        if (t % 25 === 0) {
          expect(JSON.stringify(ours), `${view}, tick ${t}`).toBe(JSON.stringify(theirs))
        }
      }
      expect(ours.tick).toBe(600)
      expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs))
    }
  })
})

describe('the exported Kraken, run', () => {
  test('the fixed-seed run matches: the frames of the pane and of the band, through each mood and an error', { timeoutMs: 60_000 }, async ($, on) => {
    const elements = await clientElements($, on)
    expectSameRun(bothRuns(KRAKEN, elements, { cols: 52, rows: 75 }, 90), 'the pane', 5)
    expectSameRun(bothRuns(KRAKEN, elements, { cols: 100, rows: 7, view: 'band' }, 90), 'the band', 3)
  })
})

describe('the exported Wisp, run', () => {
  test('the fixed-seed run matches: the frames of the band, and of a pane opened on it, through each mood and an error', { timeoutMs: 60_000 }, async ($, on) => {
    const elements = await clientElements($, on)
    expectSameRun(bothRuns(WISP, elements, { cols: 100, rows: 9 }, 90), 'the band', 3)
    // An exported Wisp's pane gets full height: the band view, drawn as tall as the pane.
    expectSameRun(bothRuns(WISP, elements, { cols: 52, rows: 75 }, 90), 'the pane', 3)
  })
})
