import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'

import { mediaCases } from './media-test'
import { describeOutcome } from './net-probe'
import { servePackages } from './packages.data'

const SCROLL = { offset: 0, bodyRows: 60 }
const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
} as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

/** What the engine answers beneath the plugin: a desktop with the pane placed. */
function desktopWithPane(on: On): void {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: PLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
}

describe('media test', () => {
  test('every case stays under the 131,072-character Svg limit', () => {
    const cases = mediaCases()
    expect(cases.length).toBe(3)
    for (const one of cases) {
      expect(one.source.length).toBeLessThan(131072)
      expect(one.source.startsWith('<svg')).toBe(true)
    }
  })

  test('/eidola media swaps the pane to the three clips on desktop, and back', async ($, on) => {
    servePackages(on)
    desktopWithPane(on)

    const turnedOn = await $.command.run({ command: 'eidola', args: 'media', ...TYPED })
    expect(turnedOn.text).toContain('Media test on')
    expect(turnedOn.text).toContain('It is in the Eidola pane.')

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    // Svg is a leaf with no address, so check by its alt and draw mode.
    const svgs = await ui.findAll({ type: 'Svg' })
    const drawn = svgs.map(one => ({ alt: one.props?.alt, isInteractive: one.props?.isInteractive }))
    for (const one of mediaCases()) {
      expect(await ui.find({ type: 'Text', text: one.label }), one.label).toBeDefined()
      expect(drawn, one.key).toContainEqual({ alt: one.label, isInteractive: one.isInteractive })
    }
    // The three clips plus the sprite control.
    expect(svgs.length).toBe(4)
    expect(await ui.find({ key: 'media-off' })).toBeDefined()
    await ui.unmount()

    const turnedOff = await $.command.run({ command: 'eidola', args: 'media', ...TYPED })
    expect(turnedOff.text).toBe('Media test off.')
    const back = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await back.find({ type: 'Text', text: 'Media test' })).toBeUndefined()
    expect(await back.find({ type: 'Svg' })).toBeDefined()
    await back.unmount()
  })
})

describe('network probes', () => {
  test('a reached host, a failure and a timeout each read plainly', () => {
    const probe = { label: 'x', url: 'https://x.test/' }
    expect(describeOutcome(probe, { kind: 'status', status: 200 })).toBe('x: reached, HTTP 200')
    expect(describeOutcome(probe, { kind: 'error', message: 'ECONNREFUSED' })).toBe('x: failed (ECONNREFUSED)')
    expect(describeOutcome(probe, { kind: 'timeout' })).toBe('x: no answer in 6s')
  })

  test('/eidola reports each probe, and a refused fetch does not break it', async ($, on) => {
    servePackages(on)
    desktopWithPane(on)
    on('http.fetch', ($2, e) => {
      if (e.url.startsWith('https://eidola.app')) {
        return { value: { status: 200, ok: true, headers: {}, text: '' } }
      }
      throw new Error('blocked by egress policy')
    })

    const out = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(out.text).toContain('Surfaces: desktop')
    // The default switches; the resting Wisp is band-only, so its band stays beside the pane /eidola opened.
    expect(out.text).toContain('Switches: pane on · band on (hidden while the pane is open). Band: showing.')
    expect(out.text).toContain('eidola.app (hosted relay): reached, HTTP 200')
    expect(out.text).toContain('example.com (control): failed (')
    expect(out.text).toContain('Shrine on this host (127.0.0.1:9743): failed (')
  })
})

describe('pane title', () => {
  test('is Eidola, whichever Engram is awake: the status line names the Engram', async ($, on) => {
    servePackages(on)
    const titles: (string | undefined)[] = []
    on('ui.open', ($2, e) => {
      titles.push(e.title)
      return { value: { isPlaced: true as const } }
    })
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
    on('store.set', () => ({ value: undefined }))

    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    expect(titles.length).toBeGreaterThan(0)
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    await $.command.run({ command: 'sleep', args: '', ...TYPED })
    expect(titles.at(-1)).toBe('Eidola')
    expect(titles.filter(title => title !== 'Eidola')).toEqual([])
  })
})
