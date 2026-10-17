import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import { renderScene } from './field'
import { capturePixels } from './live-pixels'
import type { Colour } from './live-pixels'
import { fenLayout, fenScene } from './wisp'
import WispLive from './wisp-live'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Wisp', isShown: false, isFocused: false, isPlaced: false }]
const BAND = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Wisp', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const

type Live = { x: number; y: number; work: number; heed: number; ash: number; gutter: number; cheer: number; motes: unknown[] }

/**
 * The Wisp's drawing run on a stand-in surface: `ticks` of each mood in
 * turn (and the ink count by then). Its last frame's colour at every pixel,
 * its state then, and how far it went: its least and greatest x and y.
 */
function run(cols: number, rows: number, moods: Array<[mood: 'idle' | 'working' | 'attention', ticks: number, ink?: number]>) {
  let state: unknown
  const timers: Array<() => void> = []
  const surface = {
    elements: { Box: 'Box', Text: 'Text' },
    get state() {
      return state
    },
    setState: (next: unknown) => {
      state = next
    },
    columns: cols,
    rows,
    every: (_ms: number, fn: () => void) => {
      timers.push(fn)
      return () => undefined
    },
    onPointer: () => () => undefined,
    onKey: () => () => undefined,
    post: () => undefined,
  }
  const live = () => (state as { live: Live }).live
  const went = { minX: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const [mood, ticks, ink = 0] of moods) {
    WispLive({ mood, cols, rows, ink }, surface as never)
    for (let i = 0; i < ticks; i += 1) {
      timers.forEach(fn => fn())
      went.minX = Math.min(went.minX, live().x)
      went.maxX = Math.max(went.maxX, live().x)
      went.maxY = Math.max(went.maxY, live().y)
    }
  }
  let colour: Colour = () => ''
  capturePixels.to = (_c, _r, c) => {
    colour = c
  }
  const [last, , ink = 0] = moods[moods.length - 1]!
  WispLive({ mood: last, cols, rows, ink }, surface as never)
  capturePixels.to = undefined
  return { colour, live: live(), went }
}

describe('the Wisp', () => {
  test('its fen lays the water and the boardwalk on the grid, and fits the Svg bound', () => {
    const { water, deck, height } = fenLayout(100, 9)
    expect(height).toBe(18)
    expect(water).toBe(14)
    expect(deck).toBe(water - 1)
    const svg = renderScene(fenScene(800, 190, 100, 9), NOW)
    expect(svg.length).toBeLessThan(131_072)
    expect(svg).toContain('url(#sky)')
  })

  test('it flies free: off the band and back, and down under the water', () => {
    const cols = 100
    const rows = 9
    const { water } = fenLayout(cols, rows)
    const { went } = run(cols, rows, [['idle', 1500]])
    expect(went.minX < 0 || went.maxX > cols).toBe(true)
    expect(went.maxY).toBeGreaterThan(water + 1)
  })

  test("its colour is its mood: teal at work, green needing you, red when something fails", () => {
    const cols = 100
    const rows = 9
    expect(run(cols, rows, [['idle', 40]]).live.work).toBeLessThan(0.05)
    expect(run(cols, rows, [['working', 40]]).live.work).toBeGreaterThan(0.9)
    expect(run(cols, rows, [['attention', 40]]).live.heed).toBeGreaterThan(0.9)
    // Something fails: it gutters for seconds, its glow red, and sinks under.
    const failed = run(cols, rows, [['working', 30], ['working', 20, 1]])
    expect(failed.live.gutter).toBeGreaterThan(30)
    expect(failed.live.ash).toBeGreaterThan(0.7)
    expect(failed.live.y).toBeGreaterThan(fenLayout(cols, rows).water)
  })

  test('now and then a star falls, and rings spread on the water by themselves', () => {
    let state: unknown
    const timers: Array<() => void> = []
    const surface = {
      elements: { Box: 'Box', Text: 'Text' },
      get state() {
        return state
      },
      setState: (next: unknown) => {
        state = next
      },
      columns: 100,
      rows: 9,
      every: (_ms: number, fn: () => void) => {
        timers.push(fn)
        return () => undefined
      },
      onPointer: () => () => undefined,
      onKey: () => () => undefined,
      post: () => undefined,
    }
    WispLive({ mood: 'idle', cols: 100, rows: 9, ink: 0 }, surface as never)
    const live = () => (state as { live: { meteor: { y: number } | null; ripples: Array<{ max: number }> } }).live
    let stars = 0
    let drops = 0
    let wasFalling = false
    for (let i = 0; i < 3000; i += 1) {
      timers.forEach(fn => fn())
      const falling = live().meteor !== null
      if (falling && !wasFalling) {
        stars += 1
        // High in the sky, never down among the trees.
        expect(live().meteor!.y).toBeLessThan(fenLayout(100, 9).water - 5)
      }
      wasFalling = falling
      drops = Math.max(drops, live().ripples.filter(r => r.max < 8).length)
    }
    // Rare: a few in five minutes, not a shower.
    expect(stars).toBeGreaterThan(0)
    expect(stars).toBeLessThan(25)
    expect(drops).toBeGreaterThan(0)
  })

  test('work finished: it circles up bright and fireflies rise', () => {
    const done = run(100, 9, [['working', 30], ['idle', 1]])
    expect(done.live.cheer).toBeGreaterThan(40)
    expect(done.live.motes.length).toBeGreaterThan(20)
  })

  test('the whole spirit takes its mood: its body as well as its glow', () => {
    const body = (mood: 'idle' | 'working' | 'attention') => {
      const shot = run(100, 9, [[mood, 60]])
      const x = Math.round(shot.live.x)
      const y = Math.round(shot.live.y)
      // Its body's middle, drawn plain while it is above the water.
      return y < fenLayout(100, 9).water - 4 ? shot.colour(x, y, 8) : undefined
    }
    const seen = (['idle', 'working', 'attention'] as const).map(body).filter(Boolean)
    expect(new Set(seen).size).toBe(seen.length)
  })

  test('awake, it draws only in the band: its fen, itself live, its HUD and the corner', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    const woke = await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    expect(woke.text).toContain('Wisp is awake')

    const band = await $.ui.mount(BAND)
    expect(await band.find({ type: 'Client', key: 'wisp-band' })).toBeDefined()
    expect(await band.find({ type: 'Client', key: 'band-corner' })).toBeDefined()
    expect(await band.find({ type: 'Box', key: 'frame-tl' })).toBeDefined()
    const svgs = (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props?.source))
    // Its state in the bitmap face: square dots, no text.
    expect(svgs.some(source => source.includes('shape-rendering="crispEdges" d="M'))).toBe(true)
    await band.advance(500)
    expect((await band.findAll({ type: 'Box', in: 'wisp-band' })).filter(box => box.props?.backgroundColor).length).toBeGreaterThan(20)
    await band.unmount()
  })

  test("the band's corner opens the pane on the picker; its breadcrumb goes back to the band", async ($, on) => {
    servePackages(on)
    const opened: string[] = []
    const closed: string[] = []
    on('ui.open', ($2, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true as const } }
    })
    on('ui.close', ($2, e) => {
      closed.push(e.id)
      return { value: undefined }
    })
    // No pane yet: awakening a band-only Engram would close one.
    on('ui.panes', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    // Band only: awakening it leaves the pane closed.
    expect(opened).toEqual([])

    const band = await $.ui.mount(BAND)
    await band.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'band-corner' })
    expect(opened).toEqual(['eidola'])
    await band.unmount()

    // The pane, over a band-only Engram, is the picker; its breadcrumb closes it.
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Button', key: 'awaken:kraken' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toMatchObject({ props: { label: '‹' } })
    await pane.press({ key: 'picker-back' })
    expect(closed).toEqual(['eidola'])
    await pane.unmount()
  })

  test('/eidola mood sets the mood by hand, and the band draws it', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    expect((await $.command.run({ command: 'eidola', args: 'mood sleepy', ...TYPED })).text).toContain('Usage')
    expect((await $.command.run({ command: 'eidola', args: 'mood working', ...TYPED })).text).toBe('Mood: working. It holds until your next prompt.')
    const band = await $.ui.mount(BAND)
    const live = await band.find({ type: 'Client', key: 'wisp-band' })
    expect((live?.props?.props as { mood?: string } | undefined)?.mood).toBe('working')
    // Its HUD names the state the mood stands for.
    const svgs = (await band.findAll({ type: 'Svg' })).map(svg => String(svg.props?.alt))
    expect(svgs).toContain('WORKING')
    expect((await $.command.run({ command: 'eidola', args: 'ink', ...TYPED })).text).toBe('The Wisp gutters, and a lantern goes out.')
    await band.unmount()
  })
})
