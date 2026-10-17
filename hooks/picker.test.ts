import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000

const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Kraken', isShown: false, isFocused: false, isPlaced: false }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Kraken', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const

describe('the picker', () => {
  test('the corner triangle opens the picker; a card awakens its Engram and closes it', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })

    const pane = await $.ui.mount(PANE)
    // The triangle stands in the bottom-right corner, in place of the bracket.
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()
    expect(await pane.find({ type: 'Box', key: 'frame-br' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'frame-bl' })).toBeDefined()
    expect((await pane.findAll({ type: 'Box', in: 'frame-corner' })).filter(b => b.props?.backgroundColor).length).toBe(8)
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeUndefined()

    // A click on it: every bundled Engram as a card, the awake one to put to sleep.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Client', key: 'kraken-live' })).toBeUndefined()
    for (const id of ['wisp', 'lich']) {
      expect(await pane.find({ type: 'Button', key: `awaken:${id}` })).toBeDefined()
    }
    expect(await pane.find({ type: 'Button', key: 'sleep:kraken' })).toBeDefined()
    expect((await pane.findAll({ type: 'Svg' })).length).toBeGreaterThanOrEqual(3)
    // A card shows the view its Engram draws in: the Wisp's the band, the rest their pane.
    expect(await pane.find({ type: 'Text', text: 'pane + band' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'band only' })).toBeDefined()
    const alts = (await pane.findAll({ type: 'Svg' })).map(svg => String(svg.props?.alt))
    expect(alts.filter(alt => alt.endsWith(', band view'))).toEqual(['Wisp, band view'])
    expect(alts.filter(alt => alt.endsWith(', pane view')).length).toBe(2)

    // The filter: an Engram that draws in both is listed under Pane and under Band.
    expect(await pane.find({ type: 'Text', text: '3 bundled' })).toBeDefined()
    await pane.press({ key: 'filter:band' })
    expect(await pane.find({ type: 'Button', key: 'filter:band' })).toMatchObject({ props: { variant: 'primary' } })
    expect(await pane.find({ type: 'Button', key: 'awaken:wisp' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: '3 of 3' })).toBeDefined()
    await pane.press({ key: 'filter:pane' })
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeDefined()
    await pane.press({ key: 'filter:all' })
    expect(await pane.find({ type: 'Text', text: '3 bundled' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()

    // Awakening the Lich from its card: the picker closes on the Lich.
    await pane.press({ key: 'awaken:lich' })
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-sigil' })).toBeDefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('lich (awake)')

    // Open again; the breadcrumb, named for the awake Engram, leads back.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toMatchObject({ props: { label: '‹ Lich' } })
    await pane.press({ key: 'picker-back' })
    expect(await pane.find({ type: 'Button', key: 'sleep:lich' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-sigil' })).toBeDefined()

    // Open again and close again from the corner.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Button', key: 'sleep:lich' })).toBeDefined()
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Button', key: 'sleep:lich' })).toBeUndefined()
    await pane.unmount()
  })

  test('Sleep on the awake card puts it to sleep and keeps the picker open', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })

    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await pane.press({ key: 'sleep:wisp' })
    expect(await pane.find({ type: 'Button', key: 'awaken:wisp' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'sleep:wisp' })).toBeUndefined()
    await pane.unmount()
  })

  test("a card shows the Engram's own still where it ships one, its scene where that can't be read", async ($, on) => {
    const STILL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 722"><rect width="960" height="722"/></svg>'
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    servePackages(on, path => {
      if (/engrams[\\/]kraken[\\/]vessel[\\/]thumb-pane\.svg$/.test(path)) {
        return STILL
      }
      throw new Error('no such file')
    })
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    const svgs = await pane.findAll({ type: 'Svg' })
    const kraken = svgs.find(svg => String(svg.props?.alt).startsWith('Kraken'))
    // Filling the card's width and the still's height, cropped as a cover image.
    expect(kraken?.props?.source).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 722" width="176" height="190" preserveAspectRatio="xMidYMid slice"><rect width="960" height="722"/></svg>',
    )
    expect(kraken?.props?.width).toBe(176)
    expect(kraken?.props?.height).toBe(190)
    // The Lich's still could not be read: it falls back to its scene.
    const lich = svgs.find(svg => String(svg.props?.alt).startsWith('Lich'))
    expect(String(lich?.props?.source)).not.toBe(STILL)
    await pane.unmount()
  })
})
