import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import type { VesselState } from '../types'
import { EMPTY, INKS, renderScene } from './field'
import type { FieldScene } from './field'
import { krakenBandScene, krakenPaneScene } from './kraken'
import { SVG_LIMIT } from './stage'

const STATES: VesselState[] = ['idle', 'thinking', 'working', 'attention', 'success', 'responding', 'error', 'waiting', 'sleeping']
const NOW = 1_760_000_000_000

describe('field engine', () => {
  /** A disc that moves right one cell a frame, over a still backdrop. */
  const disc: FieldScene = {
    width: 160,
    height: 160,
    ink: 'pixel',
    layers: [
      { chars: ' ', shades: [], fill: 'none' },
      { chars: ' .', shades: ['#111', '#222'], fill: '#123', ink: 'particle' },
      { chars: ' #', shades: ['#888', '#fff'], fill: '#fff' },
    ],
    period: 4,
    under: '',
    over: '',
    defs: [],
    css: [],
    sample: (x, y, frame) => (Math.hypot(x - 60 - frame * 8, y - 80) < 30 ? [2, 1] : EMPTY),
    still: () => [1, 0.6],
  }

  test('runs of layers sharing an ink are drawn as one pass each, in layer order', () => {
    const svg = renderScene(disc, NOW)
    const particle = svg.indexOf('stroke-linecap="round"')
    const pixel = svg.indexOf('shape-rendering="crispEdges"')
    expect(particle).toBeGreaterThan(-1)
    expect(pixel).toBeGreaterThan(particle)
    // The still backdrop drifts; the moving layer cycles its frames.
    expect(svg).toContain('class="s0"')
    expect(svg).toContain('class="p1 f0"')
  })

  test('one ink can be forced for the whole scene', () => {
    for (const ink of INKS) {
      const svg = renderScene(disc, NOW, ink)
      expect((svg.match(/<g (font-family|transform|fill="none")/g) ?? []).length, ink).toBe(1)
    }
  })

  test('frames are locked to the clock: the same moment draws the same scene', () => {
    expect(renderScene(disc, NOW)).toBe(renderScene(disc, NOW))
    expect(renderScene(disc, NOW)).not.toBe(renderScene(disc, NOW + 1500))
  })

  test('reduced motion shows the first frame, still', () => {
    expect(renderScene(disc, NOW)).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\{animation:none\}\.f0\{opacity:1\}\}/)
  })
})

describe('the Kraken scene', () => {
  for (const state of STATES) {
    test(`${state} fits under the Svg limit, pane, wide pane and band`, () => {
      for (const [name, scene] of [
        ['pane', krakenPaneScene(state, 412, 1442)],
        ['wide pane', krakenPaneScene(state, 760, 1442)],
        ['band', krakenBandScene(state, 1200, 140)],
      ] as const) {
        const svg = renderScene(scene, NOW)
        expect(svg.length, `${state} ${name}: ${svg.length}`).toBeLessThan(SVG_LIMIT)
        expect(svg).not.toContain('NaN')
      }
    })
  }

  test('a pixel Kraken in particle water', () => {
    const svg = renderScene(krakenPaneScene('thinking', 412, 1442), NOW)
    expect(svg).toContain('transform="scale(8 8)" shape-rendering="crispEdges"')
    // A wider slot draws with bigger cells, to stay in budget.
    const wide = /transform="scale\((\d+) /.exec(renderScene(krakenPaneScene('thinking', 760, 1442), NOW))
    expect(Number(wide?.[1])).toBeGreaterThan(8)
    expect(svg).toContain('fill="none" stroke-linecap="round"')
  })

  test('error turns its glow red', () => {
    expect(renderScene(krakenPaneScene('error', 412, 1442), NOW)).toContain('#ff5a4a')
    expect(renderScene(krakenPaneScene('thinking', 412, 1442), NOW)).not.toContain('#ff5a4a')
  })
})

describe('the Kraken Engram', () => {
  const SCROLL = { offset: 0, bodyRows: 40 }
  const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Kraken', isShown: false, isFocused: false, isPlaced: false }]
  const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

  test('fills the pane and the band with its scene, no text', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    const woke = await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    expect(woke.text).toContain('Kraken is awake')

    const pane = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'Pane',
      requestId: 'eidola',
      props: { title: 'Kraken', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
    })
    // On desktop: still water drawn once, the Kraken drawn live over it.
    const water = await pane.find({ type: 'Svg' })
    expect(water?.props?.width).toBe(252)
    // A row taller than its 39 rows, clipped to them, so it meets the HUD's bottom brackets.
    expect(water?.props?.height).toBe(760)
    expect((await pane.findAll({ type: 'Box' })).some(box => box.props?.overflow === 'hidden' && box.props?.height === 39)).toBe(true)
    const live = await pane.find({ type: 'Client' })
    expect(String(live?.props?.module)).toMatch(/kraken-live.tsx$/)
    expect((live?.props?.props as { mood?: string; ink?: number } | undefined)?.mood).toBe('idle')
    expect((live?.props?.props as { ink?: number } | undefined)?.ink).toBe(0)
    await pane.unmount()

    // Something going wrong, or /eidola ink, reaches the running Kraken as a rising count.
    expect((await $.command.run({ command: 'eidola', args: 'ink', ...TYPED })).text).toBe('The Kraken inks.')
    const inked = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'Pane',
      requestId: 'eidola',
      props: { title: 'Kraken', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
    })
    expect(((await inked.find({ type: 'Client' }))?.props?.props as { ink?: number } | undefined)?.ink).toBe(1)
    await inked.unmount()

    const band = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 11 }, view: {} },
    })
    // The band too: still water, and the same live Kraken framed for a strip.
    const strip = await band.find({ type: 'Svg' })
    expect(strip?.props?.width).toBe(636)
    expect(strip?.props?.height).toBe(131)
    const bandLive = await band.find({ type: 'Client' })
    expect((bandLive?.props?.props as { view?: string } | undefined)?.view).toBe('band')
    expect(await band.find({ type: 'Text' })).toBeUndefined()
    await band.unmount()
  })
})
