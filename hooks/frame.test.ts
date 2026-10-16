import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'


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
  test("each Engram's HUD: the Kraken's on as it ships, with its recording; toggled per Engram", async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })

    // The Kraken ships with its HUD on: its state, its live-cam stamp, its recording.
    let pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Client', key: 'frame-cam' })).toBeDefined()
    await pane.advance(600)
    expect(await pane.find({ type: 'Text', text: ' LIVE', in: 'frame-cam' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /^KRAKEN {2}\d\d:\d\d:\d\d$/, in: 'frame-cam' })).toBeDefined()
    expect(svgsOf(await pane.findAll({ type: 'Svg' })).some(source => source.includes('>IDLE<'))).toBe(true)
    expect(await pane.find({ type: 'Client', key: 'frame-wave' })).toBeDefined()
    await pane.advance(1000)
    expect((await pane.findAll({ type: 'Box', in: 'frame-wave' })).length).toBeGreaterThan(40)
    expect(await pane.find({ type: 'Client', key: 'kraken-live' })).toBeDefined()
    await pane.unmount()

    expect((await $.command.run({ command: 'eidola', args: 'frame', ...TYPED })).text).toBe('Frame off for Kraken.')
    pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Client', key: 'frame-cam' })).toBeUndefined()
    await pane.unmount()

    // Another Engram keeps its own setting: the Lich ships without one.
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, title: 'Lich' } })
    expect(await pane.find({ type: 'Client', key: 'frame-meter' })).toBeUndefined()
    await pane.unmount()
    expect((await $.command.run({ command: 'eidola', args: 'frame', ...TYPED })).text).toBe('Frame on for Lich.')
    pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, title: 'Lich' } })
    expect(await pane.find({ type: 'Client', key: 'frame-meter' })).toBeDefined()
    await pane.unmount()
  })
})
