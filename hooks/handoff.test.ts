// The hand-off with the test Engram plugin (test/fixtures/engram-plugin):
// it announces and joins the registry; awake, it draws inside Eidola's frame
// in the pane and the band; a plugin whose drawing throws falls back and is
// marked not loading, and the session keeps running. Each runs in both load
// orders: the plugin loaded before Eidola (its hooks above Eidola's, the
// `prepend` tier here) and after it (beneath, `append`).

import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine, Mounted, Plugin } from 'claude-code/testing'

import { register as fixture } from '../test/fixtures/engram-plugin/hooks/register'
import { countBlocks, faultLine, judge, lineOf, ownMs } from './handoff'
import { servePackages } from './packages.data'
import { MANIFEST, validate } from './validate'

const NOW = 1_760_000_000_000
const SURFACES = ['terminal', 'desktop'] as const
/** Above Eidola (loaded first), and beneath it (loaded after). */
const ORDERS = ['prepend', 'append'] as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const SCROLL = { offset: 0, bodyRows: 40 }
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 48, placement: 'dock', scroll: SCROLL, view: {} },
} as const
const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: SCROLL, view: {} },
} as const
const UNPLACED: UiPane[] = []

/** test/fixtures/engram-plugin/engram.json, as the tests' engine serves it (the kit reads no disk). */
const FIXTURE_ENGRAM = {
  $schema: '../../../docs/spec/engram.schema.json',
  spec: 2,
  id: 'fixture',
  name: 'Fixture',
  version: '0.1.0',
  author: 'eidola',
  description: "A small test creature, drawn by its own plugin inside Eidola's pane and band.",
  rights: 'original',
  remixOf: 'kraken',
  vessel: { scene: 'self', shows: ['pane', 'band'], thumbnails: { pane: 'thumb-pane.svg' }, hud: { show: true, meter: 'none', tag: 'name', bracket: '#4ad6c8' } },
}

/** The other test plugins announce from /plugins/<name>, each its own engram.json. */
const BROKEN_ENGRAM = { ...FIXTURE_ENGRAM, id: 'broken', name: 'Broken', remixOf: 'kraken' }
const FALLING_ENGRAM = { ...FIXTURE_ENGRAM, id: 'falling', name: 'Falling', remixOf: undefined }

function file(path: string): string {
  const at = path.replace(/\\/g, '/')
  const owner = /\/plugins\/([^/]+)\//.exec(at)?.[1]
  if (at.endsWith('/hooks/hooks.json')) {
    return '{ "modules": ["./register.tsx"] }'
  }
  if (at.endsWith('/.claude-plugin/plugin.json')) {
    return JSON.stringify({ name: owner ?? 'eidola-engram-fixture' })
  }
  if (at.endsWith('/engram.json')) {
    return JSON.stringify(
      owner === 'broken-engram' ? BROKEN_ENGRAM : owner === 'falling-engram' ? FALLING_ENGRAM : owner === 'bad-engram' ? { ...FIXTURE_ENGRAM, id: 'kraken' } : FIXTURE_ENGRAM,
    )
  }
  throw new Error(`ENOENT: ${path}`)
}

/** The engine beneath the plugins: the bundled packages, the Engram plugins' files, an empty pane and band. */
function engine(on: On): void {
  servePackages(on, file)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? 'fixture' : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

/** The fixture's face for a mood, as it draws it. */
const FACES = { idle: '( o_o )', working: '( >_< )', attention: '( O_O )!' } as const

/** The fixture's drawing, inside Eidola's tree: its Box, and its face. */
async function creature(ui: Pick<Mounted, 'find'>, face: string) {
  return { box: await ui.find({ type: 'Box', key: 'eidola:fixture' }), face: await ui.find({ type: 'Text', text: face }) }
}

/** A plugin whose engram.json takes a bundled Engram's id. */
const BAD: Plugin = {
  name: 'bad-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/bad-engram' })
      return next(e)
    })
  },
}

/** The alt text of every Svg drawn: what tells the fallbacks apart (an Svg carries no searchable key). */
async function alts(ui: Pick<Mounted, 'findAll'>): Promise<string[]> {
  return (await ui.findAll({ type: 'Svg' })).map(svg => String(svg.props['alt']))
}

const FIXTURE: Omit<Plugin, 'tier'> = { name: 'eidola-engram-fixture', register: fixture }

/** A plugin that announces and whose hooks throw outright: no try, no fault. */
const BROKEN_BENEATH: Plugin = {
  name: 'broken-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/broken-engram' })
      return next(e)
    })
    on('ui.render', { component: 'Pane', requestId: 'eidola' }, async () => {
      throw new Error('the creature fell apart')
    })
    on('ui.render', { component: 'AbovePrompt' }, async () => {
      throw new Error('the creature fell apart')
    })
  },
}
const BROKEN_ABOVE: Plugin = { ...BROKEN_BENEATH, tier: 'prepend' }

/** A plugin that follows the contract, whose drawing throws: it reports the fault, file and line. */
const FALLING_BENEATH: Plugin = {
  name: 'falling-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/falling-engram' })
      return next(e)
    })
    on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => {
      const isAsked = (e.props as { eidola?: unknown }).eidola !== undefined
      const tree = isAsked ? undefined : await next(e)
      try {
        throw new Error('the creature fell apart')
      } catch (error) {
        await $.eidola.fault({ engram: 'falling', message: 'the creature fell apart.', file: 'hooks/creature.tsx', line: 12, stack: String(error) })
        return tree ?? next(e)
      }
    })
  },
}
const FALLING_ABOVE: Plugin = { ...FALLING_BENEATH, tier: 'prepend' }

describe('discovery', () => {
  for (const tier of ORDERS) {
    test(`loaded ${tier === 'prepend' ? 'before' : 'after'} Eidola, it announces and joins the registry`, { plugins: [{ ...FIXTURE, tier }] }, async ($, on) => {
      engine(on)
      await start($)
      // Stored as the awake Engram before the session: awake, whichever announced first.
      const listed = await $.command.run({ command: 'awaken', args: 'nothing-here', ...TYPED })
      expect(listed.text).toContain('fixture (awake): A small test creature')
      const awoken = await $.command.run({ command: 'awaken', args: 'fixture', ...TYPED })
      expect(awoken.text).toBe('Fixture is awake.')
    })
  }

  test("an Engram plugin's engram.json that fails the checks stays out, and /eidola says why", { plugins: [BAD] }, async ($, on) => {
    engine(on)
    await start($)
    const report = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(report.text).toContain("Engram plugin at /plugins/bad-engram didn't load:")
    expect(report.text).toContain(`"kraken" is a bundled Engram's id.`)
    // The bundled Kraken is still the Kraken.
    expect((await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })).text).toBe('Kraken is awake.')
  })
})

describe('the hand-off', () => {
  for (const tier of ORDERS) {
    for (const surface of SURFACES) {
      test(`${tier === 'prepend' ? 'above' : 'beneath'} Eidola, it draws inside the pane on ${surface}`, { plugins: [{ ...FIXTURE, tier }] }, async ($, on) => {
        engine(on)
        await start($)
        const ui = await $.ui.mount({ ...PANE, surface })
        const drawn = await creature(ui, FACES.idle)
        expect(drawn.box).toBeDefined()
        expect(drawn.face).toBeDefined()
        // Eidola's own drawing stays out of the way: no fallback slot left.
        expect(await ui.find({ type: 'Box', key: 'eidola-slot:fixture' })).toBeUndefined()
        expect(await ui.find({ type: 'Box', key: 'eidola-fallback:fixture' })).toBeUndefined()
        if (surface === 'desktop') {
          // Inside Eidola's frame (its HUD shows), with the corner over it.
          expect(await ui.find({ type: 'Box', key: 'frame-tl' })).toBeDefined()
          expect(await ui.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()
        }
        await ui.unmount()
      })

      test(`${tier === 'prepend' ? 'above' : 'beneath'} Eidola, it draws inside the band on ${surface}`, { plugins: [{ ...FIXTURE, tier }] }, async ($, on) => {
        engine(on)
        await start($)
        const ui = await $.ui.mount({ ...BAND, surface })
        const drawn = await creature(ui, FACES.idle)
        expect(drawn.box).toBeDefined()
        expect(drawn.face).toBeDefined()
        if (surface === 'desktop') {
          expect(await ui.find({ type: 'Client', key: 'band-corner' })).toBeDefined()
        }
        await ui.unmount()
      })
    }

    test(`${tier === 'prepend' ? 'above' : 'beneath'} Eidola, it draws each of the three moods`, { plugins: [{ ...FIXTURE, tier }] }, async ($, on) => {
      engine(on)
      await start($)
      for (const mood of ['working', 'attention', 'idle'] as const) {
        await $.command.run({ command: 'eidola', args: `mood ${mood}`, ...TYPED })
        const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
        expect((await creature(ui, FACES[mood])).face).toBeDefined()
        await ui.unmount()
      }
    })
  }

  test('beneath Eidola, it is handed the room and the state on e.props.eidola', { plugins: [{ ...FIXTURE, tier: 'append' }] }, async ($, on) => {
    engine(on)
    await start($)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const box = await ui.find({ type: 'Box', key: 'eidola:fixture' })
    // The pane's body less the row the corner sits on.
    expect(box?.props['width']).toBe(48)
    expect(box?.props['height']).toBe(39)
    await ui.unmount()
  })

  test('asleep, nothing is handed off: the fixture never draws', { plugins: [{ ...FIXTURE, tier: 'append' }] }, async ($, on) => {
    engine(on)
    await start($)
    await $.command.run({ command: 'sleep', args: '', ...TYPED })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Box', key: 'eidola:fixture' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('a broken Engram plugin', () => {
  test('beneath Eidola, a hook that throws falls back to the Engram it was remixed from and is marked not loading', { plugins: [BROKEN_BENEATH] }, async ($, on) => {
    engine(on)
    await start($)
    await $.command.run({ command: 'awaken', args: 'broken', ...TYPED })
    for (const mount of [PANE, BAND]) {
      const ui = await $.ui.mount({ ...mount, surface: 'desktop' })
      const slot = await ui.find({ type: 'Box', key: 'eidola-fallback:broken' })
      expect(slot).toBeDefined()
      // The Kraken it was remixed from, as a still.
      expect(await alts(ui)).toContain('Broken, drawn as the kraken it was remixed from: Idle')
      await ui.unmount()
    }
    const report = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(report.text).toContain('Not loading: Broken, from broken-engram. hooks/register.tsx: its ui.render hook threw.')
    // The session keeps running: commands answer, and another Engram wakes and draws.
    expect((await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })).text).toBe('Kraken is awake.')
    const after = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await after.find({ type: 'Client', key: 'kraken-live' })).toBeDefined()
    await after.unmount()
  })

  test('above Eidola, a hook that throws leaves the fallback drawn and the session running', { plugins: [BROKEN_ABOVE] }, async ($, on) => {
    engine(on)
    await start($)
    await $.command.run({ command: 'awaken', args: 'broken', ...TYPED })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Box', key: 'eidola-slot:broken' })).toBeDefined()
    expect(await alts(ui)).toContain('Broken, drawn as the kraken it was remixed from: Idle')
    expect(await ui.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()
    await ui.unmount()
    const report = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(report.text).toContain('Pane:')
  })

  for (const plugin of [FALLING_BENEATH, FALLING_ABOVE]) {
    test(`${plugin.tier === 'prepend' ? 'above' : 'beneath'} Eidola, a drawing that throws and says so is marked not loading with its file and line`, { plugins: [plugin] }, async ($, on) => {
      engine(on)
      await start($)
      await $.command.run({ command: 'awaken', args: 'falling', ...TYPED })
      let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
      await ui.unmount()
      // Drawn again: the fallback in a slot no plugin fills, the resting sprite (it names no remixOf).
      ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
      expect(await ui.find({ type: 'Box', key: 'eidola-fallback:falling' })).toBeDefined()
      expect(await alts(ui)).toContain('Falling, drawn as the resting sprite: Idle')
      await ui.unmount()
      const report = await $.command.run({ command: 'eidola', args: '', ...TYPED })
      expect(report.text).toContain('Not loading: Falling, from falling-engram. hooks/creature.tsx:12: the creature fell apart.')
      expect(report.text).toContain('the resting sprite')
      // /engrams reads the Engrams afresh, and the mark goes until it fails again.
      await $.command.run({ command: 'engrams', args: '', ...TYPED })
      expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).not.toContain('Not loading')
    })
  }
})

describe('judging a drawing (handoff.ts)', () => {
  const asked = { engram: 'fixture', plugin: 'eidola-engram-fixture', module: 'hooks/register.tsx', trace: [], tookMs: 0 }
  const box = (key: string, children: unknown[] = []) => ({ type: 'Box', props: { key }, children })

  test('a Box keyed eidola:<id> is placed', () => {
    expect(judge({ ...asked, got: box('eidola:fixture') })).toEqual({ tree: box('eidola:fixture') })
  })

  test('nothing back and the plugin not beneath: the slot is left for it', () => {
    expect(judge({ ...asked, got: undefined })).toEqual({ slot: true })
  })

  test('over 700 blocks, or over its time, is a fault', () => {
    const big = box('eidola:fixture', Array.from({ length: 700 }, () => ({ type: 'Text', children: ['x'] })))
    expect(countBlocks(big)).toBe(701)
    expect(judge({ ...asked, got: big })).toEqual({ fault: { file: 'hooks/register.tsx', problem: 'its drawing holds 701 blocks, over the 700 a drawing may hold.' } })
    expect(judge({ ...asked, got: box('eidola:fixture'), tookMs: 900 })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'its drawing took 900 ms, over the 250 ms a drawing may take.' },
    })
  })

  test("its time is its own hooks': a slow plugin elsewhere in the chain isn't counted against it", () => {
    const fixtureLink = (ms: number) => ({ plugin: 'eidola-engram-fixture', outcome: 'returned' as const, ms })
    const slow = { plugin: 'slow-neighbour', outcome: 'passed' as const, ms: 880 }
    // The whole chain took 900 ms, the Engram's own hook 20 of them: placed.
    expect(judge({ ...asked, got: box('eidola:fixture'), tookMs: 900, trace: [slow, fixtureLink(20)] })).toEqual({ tree: box('eidola:fixture') })
    // Its own two links, 140 ms each: over, whatever the rest took.
    expect(judge({ ...asked, got: box('eidola:fixture'), tookMs: 300, trace: [fixtureLink(140), slow, fixtureLink(140)] })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'its drawing took 280 ms, over the 250 ms a drawing may take.' },
    })
    // Its plugin not in the trace by name: the whole chain's time.
    expect(judge({ ...asked, got: box('eidola:fixture'), tookMs: 900, trace: [slow] })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'its drawing took 900 ms, over the 250 ms a drawing may take.' },
    })
    expect(ownMs([fixtureLink(20)], 900)).toBe(20)
    expect(ownMs([], 900)).toBe(900)
  })

  test('beneath and skipped, expired or answering with something else, is a fault', () => {
    expect(judge({ ...asked, got: undefined, trace: [{ plugin: 'eidola-engram-fixture', outcome: 'skipped' }] })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'its ui.render hook threw.' },
    })
    expect(judge({ ...asked, got: undefined, trace: [{ plugin: 'eidola-engram-fixture', outcome: 'expired' }] })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'its ui.render hook ran out of time.' },
    })
    expect(judge({ ...asked, got: box('other'), trace: [{ plugin: 'eidola-engram-fixture', outcome: 'returned' }] })).toEqual({
      fault: { file: 'hooks/register.tsx', problem: 'it drew nothing Eidola can place: its drawing must be one Box keyed "eidola:fixture".' },
    })
  })

  test('a stack gives its line; a fault reads as file:line: problem', () => {
    expect(lineOf('Error: boom\n    at draw (hooks/creature.tsx:12:5)\n    at run (x.js:1:1)')).toBe(12)
    expect(lineOf(undefined)).toBeUndefined()
    expect(faultLine({ file: 'hooks/creature.tsx', line: 12, problem: 'it threw.' })).toBe('hooks/creature.tsx:12: it threw.')
  })
})

describe("an Engram plugin's engram.json (validate.ts)", () => {
  const check = (json: unknown, scenes?: string[]) =>
    validate({ folder: 'fixture', files: { [MANIFEST]: JSON.stringify(json) } }, { thumbnails: false, ...(scenes ? { scenes } : {}) }).errors.map(issue => issue.problem)

  test(`scene "self" and a remixOf load as an Engram plugin's`, () => {
    expect(check(FIXTURE_ENGRAM, ['self'])).toEqual([])
  })

  test('scene "self" in a folder package is refused: only a plugin draws its own', () => {
    expect(check(FIXTURE_ENGRAM)).toEqual([`vessel.scene is "self", which isn't a scene this mod has.`])
  })

  test(`remixOf must be an Engram's id, and not its own`, () => {
    expect(check({ ...FIXTURE_ENGRAM, remixOf: 'Not An Id' }, ['self'])).toEqual([`remixOf is "Not An Id", not an Engram's id.`])
    expect(check({ ...FIXTURE_ENGRAM, remixOf: 'fixture' }, ['self'])).toEqual(['remixOf names this Engram itself.'])
  })
})
