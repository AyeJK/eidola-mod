import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import type { VesselState } from '../types'
import { renderScene } from './field'
import { lichBandScene, lichPaneScene, voidScene } from './lich'
import { advance, born, replay } from './lich-live'
import type { Live } from './lich-live'
import { SVG_LIMIT } from './stage'
import { servePackages } from './packages.data'

const STATES: VesselState[] = ['idle', 'thinking', 'working', 'attention', 'success', 'responding', 'error', 'waiting', 'sleeping']
const NOW = 1_760_000_000_000
const SCROLL = { offset: 0, bodyRows: 40 }
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Lich', isShown: false, isFocused: false, isPlaced: false }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Lich', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const
/** What a Client may draw before it is unmounted. */
const TREE_LIMIT = 100_000

describe('the Lich as a field scene', () => {
  for (const state of STATES) {
    test(`${state} fits under the Svg limit, pane and band`, () => {
      for (const [name, scene] of [
        ['pane', lichPaneScene(state, 412, 1442)],
        ['band', lichBandScene(state, 1200, 131)],
      ] as const) {
        const svg = renderScene(scene, NOW)
        expect(svg.length, `${state} ${name}: ${svg.length}`).toBeLessThan(SVG_LIMIT)
        expect(svg).not.toContain('NaN')
      }
    })
  }

  test('the dark it hangs in is one still drawing, all its motion CSS', () => {
    for (const view of ['pane', 'band'] as const) {
      const svg = renderScene(voidScene(412, 1442, view), NOW)
      expect(svg.length).toBeLessThan(SVG_LIMIT)
      expect(svg).toContain('@keyframes rise')
      expect(svg).toBe(renderScene(voidScene(412, 1442, view), NOW + 60_000))
    }
  })
})

describe('the Lich Engram', () => {
  test('draws it live in glyphs, in four slices that tile the pane, and nothing in the band', async ($, on) => {
    servePackages(on)
    // What the engine draws in the band when the mod passes it on: an empty Box.
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    expect((await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })).text).toContain('Lich is awake')

    const pane = await $.ui.mount(PANE)
    expect(String((await pane.find({ type: 'Svg' }))?.props?.alt)).toBe('Lich in the dark')
    // Its own drawings: the HUD's drawings are in the pane too.
    const slices = (await pane.findAll({ type: 'Client' })).filter(c => String(c.key ?? c.props?.key).startsWith('lich-'))
    expect(slices.map(c => c.key ?? c.props?.key)).toEqual(['lich-0', 'lich-1', 'lich-2', 'lich-3'])
    let next = 0
    for (const c of slices) {
      const props = c.props?.props as { slice: [number, number]; rows: number; mood: string }
      expect(props.slice[0]).toBe(next)
      expect(String(c.props?.module)).toMatch(/lich-live.tsx$/)
      expect(props.mood).toBe('idle')
      next += props.slice[1]
    }
    expect(next).toBe((slices[0]!.props?.props as { rows: number }).rows)

    // Each slice keeps within its own bound, and draws in glyphs.
    for (let i = 0; i < 4; i += 1) {
      for (const key of ['lich-0', 'lich-1', 'lich-2', 'lich-3']) {
        const size = JSON.stringify(await pane.drawn({ in: key })).length
        expect(size, `${key}: ${size}`).toBeLessThan(TREE_LIMIT)
      }
      await pane.advance(1500)
    }
    expect((await pane.findAll({ type: 'Text', in: 'lich-0' })).length).toBeGreaterThan(10)
    await pane.unmount()

    // Something going wrong reaches it as a rising count, with its time.
    expect((await $.command.run({ command: 'eidola', args: 'ink', ...TYPED })).text).toBe('The Lich is scorched.')
    const scorched = await $.ui.mount(PANE)
    const props = (await scorched.find({ type: 'Client' }))?.props?.props as { ink: number; inkAt: number }
    expect(props.ink).toBe(1)
    expect(props.inkAt).toBe(NOW)
    await scorched.advance(2000)
    expect(JSON.stringify(await scorched.drawn({ in: 'lich-0' })).length).toBeLessThan(TREE_LIMIT)
    await scorched.unmount()

    const band = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 95, scroll: { offset: 0, bodyRows: 11 }, view: {} },
    })
    // Pane only: the band is passed on to the engine, with nothing of the Lich's in it.
    expect(await band.find({ type: 'Client' })).toBeUndefined()
    expect(await band.find({ type: 'Svg' })).toBeUndefined()
    await band.unmount()
  })

  test('where nothing draws live it is a field scene', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const pane = await $.ui.mount({ ...PANE, surface: 'vscode', props: { ...PANE.props, bodyColumns: 32, scroll: SCROLL } })
    expect(await pane.find({ type: 'Client' })).toBeUndefined()
    expect(await pane.find({ type: 'Svg' })).toBeDefined()
    await pane.unmount()
  })
})

describe('the Lich in slices', () => {
  test('a slice that hears of a mood late lives it again, and stays one with the rest', () => {
    const [W, H] = [416, 1444]
    const carry = { mood: 'idle', moodNext: 'idle', moodTick: 0, inkSeen: 0, inkPending: false, inkTick: 0 } as const
    const onTime = born(carry, 0)
    const late = born(carry, 0)
    const pastOnTime: Live[] = []
    const pastLate: Live[] = []
    const to = (live: Live, past: Live[], tick: number) => {
      while (live.tick < tick) {
        advance(live, past, W, H)
      }
    }
    to(onTime, pastOnTime, 30)
    to(late, pastLate, 30)
    // The mood turns at tick 33: one copy hears at once, the other a second late.
    onTime.moodNext = 'working'
    onTime.moodTick = 33
    to(onTime, pastOnTime, 43)
    to(late, pastLate, 43)
    expect(JSON.stringify(late)).not.toBe(JSON.stringify(onTime))
    late.moodNext = 'working'
    late.moodTick = 33
    replay(late, pastLate, 33, W, H)
    expect(JSON.stringify(late)).toBe(JSON.stringify(onTime))
    // Ink heard late, too.
    onTime.inkSeen = 1
    onTime.inkPending = true
    onTime.inkTick = 50
    to(onTime, pastOnTime, 60)
    to(late, pastLate, 60)
    late.inkSeen = 1
    late.inkPending = true
    late.inkTick = 50
    replay(late, pastLate, 50, W, H)
    to(onTime, pastOnTime, 120)
    to(late, pastLate, 120)
    expect(JSON.stringify(late)).toBe(JSON.stringify(onTime))
  })
})
