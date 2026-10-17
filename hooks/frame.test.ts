import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import { servePackages } from './packages.data'


const NOW = 1_760_000_000_000

/** The sources of the Svgs a drawing holds. */
const svgsOf = (found: Array<{ props?: Record<string, unknown> }>) => found.map(svg => String(svg.props?.source))
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Kraken', isShown: false, isFocused: false, isPlaced: false }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Kraken', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const

describe('the frame', () => {
  // Some 5 s alone; given room for a full run, where every test file runs at once.
  test("each Engram's HUD: the Kraken's on as it ships, with no meter; toggled per Engram", { timeoutMs: 15_000 }, async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })

    // The Kraken ships with its HUD on: its state and its live-cam stamp.
    let pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Client', key: 'frame-cam' })).toBeDefined()
    await pane.advance(600)
    expect(await pane.find({ type: 'Text', text: ' LIVE', in: 'frame-cam' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /^KRAKEN {2}\d\d:\d\d:\d\d$/, in: 'frame-cam' })).toBeDefined()
    expect(svgsOf(await pane.findAll({ type: 'Svg' })).some(source => source.includes('>IDLE<'))).toBe(true)
    // No meter: no recording along the bottom, no level bars in the corner.
    expect(await pane.find({ type: 'Client', key: 'frame-wave' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-meter' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'kraken-live' })).toBeDefined()
    await pane.unmount()

    expect((await $.command.run({ command: 'eidola', args: 'frame', ...TYPED })).text).toBe('Frame off for Kraken.')
    pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Client', key: 'frame-cam' })).toBeUndefined()
    await pane.unmount()

    // Another Engram keeps its own setting: the Lich ships with its own HUD on, sparks and a sigil.
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, title: 'Lich' } })
    expect(await pane.find({ type: 'Client', key: 'frame-sparks' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-sigil' })).toBeDefined()
    expect(svgsOf(await pane.findAll({ type: 'Svg' })).some(source => source.includes('font-variant="small-caps"'))).toBe(true)
    await pane.advance(3000)
    expect((await pane.findAll({ type: 'Box', in: 'frame-sparks' })).length).toBeGreaterThan(5)
    // The sigil is drawn live, in Boxes of its colour, and within its bound.
    expect((await pane.findAll({ type: 'Box', in: 'frame-sigil' })).filter(b => b.props?.backgroundColor).length).toBeGreaterThan(40)
    expect(JSON.stringify(await pane.drawn({ in: 'frame-sigil' })).length).toBeLessThan(100_000)
    await pane.unmount()
    expect((await $.command.run({ command: 'eidola', args: 'frame', ...TYPED })).text).toBe('Frame off for Lich.')
    pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, title: 'Lich' } })
    expect(await pane.find({ type: 'Client', key: 'frame-sparks' })).toBeUndefined()
    await pane.unmount()
  })
})
