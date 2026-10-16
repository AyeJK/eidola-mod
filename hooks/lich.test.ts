import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import type { VesselState } from '../types'
import { renderScene } from './field'
import { lichBandScene, lichPaneScene, voidScene } from './lich'
import { SVG_LIMIT } from './stage'

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
  test('draws it live in glyphs, in four slices that tile the pane, and in the band', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    expect((await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })).text).toContain('Lich is awake')

    const pane = await $.ui.mount(PANE)
    expect(String((await pane.find({ type: 'Svg' }))?.props?.alt)).toBe('Lich in the dark')
    const slices = await pane.findAll({ type: 'Client' })
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
    const strip = await band.find({ type: 'Client' })
    expect(strip?.key ?? strip?.props?.key).toBe('lich-band')
    expect((strip?.props?.props as { view?: string }).view).toBe('band')
    await band.advance(1500)
    expect(JSON.stringify(await band.drawn({ in: 'lich-band' })).length).toBeLessThan(TREE_LIMIT)
    await band.unmount()
  })

  test('where nothing draws live it is a field scene', async ($, on) => {
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
