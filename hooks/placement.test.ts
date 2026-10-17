import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'

import { DEFAULT_SURFACES, readStatusLine, readSurfaces, showsLabel, whereItDraws } from './placement'
import type { Surfaces } from './placement'
import type { ShowPlace } from './engram-types'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Wisp', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const
const BAND = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

/** Every value `shows` can take: each non-empty list of pane, band and shrine. */
const SHOWS: ShowPlace[][] = [['pane'], ['band'], ['shrine'], ['pane', 'band'], ['pane', 'shrine'], ['band', 'shrine'], ['pane', 'band', 'shrine']]

/** Every combination of the switches. */
const COMBINATIONS: Surfaces[] = [true, false].flatMap(pane =>
  [true, false].flatMap(band => [true, false].map(hideBand => ({ pane, band, hideBand }))),
)

const engramShowing = (shows: ShowPlace[]) => ({ vessel: { shows } })

describe('whereItDraws', () => {
  test('every switch combination against every shows value, the pane open and not', () => {
    for (const surfaces of COMBINATIONS) {
      for (const shows of SHOWS) {
        for (const isPaneOpen of [false, true]) {
          const drawn = whereItDraws(surfaces, engramShowing(shows), isPaneOpen)
          const at = JSON.stringify({ surfaces, shows, isPaneOpen })
          // The pane opens by itself only with its switch on, for one that shows there.
          expect(drawn.opensPane, at).toBe(surfaces.pane && shows.includes('pane'))
          // Opened, the pane draws the pane view where it shows there, else the band view.
          expect(drawn.paneView, at).toBe(shows.includes('pane') ? 'pane' : 'band')
          // The band: its switch on, shown there, and not stepping aside for an open
          // pane, which only one that shows in the pane does.
          expect(drawn.band, at).toBe(surfaces.band && shows.includes('band') && !(surfaces.hideBand && isPaneOpen && shows.includes('pane')))
        }
      }
    }
  })

  test('a band-only Engram never opens the pane by itself, whatever the switches', () => {
    for (const surfaces of COMBINATIONS) {
      expect(whereItDraws(surfaces, engramShowing(['band']), false).opensPane).toBe(false)
    }
  })

  test('the Shrine alone draws on neither the pane nor the band yet', () => {
    const drawn = whereItDraws({ pane: true, band: true, hideBand: false }, engramShowing(['shrine']), false)
    expect(drawn.opensPane).toBe(false)
    expect(drawn.band).toBe(false)
  })

  test('defaults: Pane on, Band on, the band hidden while the pane is open; a missing or odd value reads as its default', () => {
    expect(DEFAULT_SURFACES).toEqual({ pane: true, band: true, hideBand: true })
    expect(readSurfaces({})).toEqual(DEFAULT_SURFACES)
    expect(readSurfaces({ pane: 'sideways', band: 1 })).toEqual(DEFAULT_SURFACES)
    expect(readSurfaces({ pane: false, band: false, hideBandWhilePaneOpen: false })).toEqual({ pane: false, band: false, hideBand: false })
    // 0.6.0's option is gone: it counts for nothing.
    expect(readSurfaces({ placement: 'band' })).toEqual(DEFAULT_SURFACES)
    expect(readStatusLine({})).toBe(true)
    expect(readStatusLine({ statusLine: false })).toBe(false)
  })

  test("the picker's labels for the list form of shows", () => {
    expect(showsLabel(engramShowing(['pane', 'band', 'shrine']))).toBe('pane + band')
    expect(showsLabel(engramShowing(['pane', 'band']))).toBe('pane + band')
    expect(showsLabel(engramShowing(['band']))).toBe('band only')
    expect(showsLabel(engramShowing(['band', 'shrine']))).toBe('band only')
    expect(showsLabel(engramShowing(['pane', 'shrine']))).toBe('pane only')
    expect(showsLabel(engramShowing(['shrine']))).toBe('shrine only')
  })
})

describe('/eidola place', () => {
  test('with no switch, shows the switches and how to set one', async ($, on) => {
    servePackages(on)
    const out = await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    expect(out.text).toContain('Surfaces: pane on · band on (hidden while the pane is open).')
    expect(out.text).toContain('  pane on: ')
    expect(out.text).toContain('  band on: the band above the prompt')
    expect(out.text).toContain('  hide on: hide the band while the pane is open')
    expect(out.text).toContain('/eidola place band off')
  })

  test('shows a switch as it is set', { options: { band: false } }, async ($, on) => {
    servePackages(on)
    const out = await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    expect(out.text).toContain('Surfaces: pane on · band off.')
    expect(out.text).toContain('  band off: ')
  })

  test('sets one switch through the config, as its option', async ($, on) => {
    servePackages(on)
    const writes: unknown[] = []
    on('config.set', ($2, e) => {
      writes.push({ key: e.key, value: e.value })
      return { value: e.value }
    })
    expect((await $.command.run({ command: 'eidola', args: 'place band off', ...TYPED })).text).toBe('band off: the band above the prompt.')
    expect((await $.command.run({ command: 'eidola', args: 'place hide off', ...TYPED })).text).toContain('hide off')
    expect((await $.command.run({ command: 'eidola', args: 'place pane on', ...TYPED })).text).toContain('pane on')
    expect(writes).toEqual([
      { key: 'eidola.band', value: false },
      { key: 'eidola.hideBandWhilePaneOpen', value: false },
      { key: 'eidola.pane', value: true },
    ])
  })

  test('refuses a switch that is not one, and a value that is not on or off', async ($, on) => {
    servePackages(on)
    on('config.set', () => {
      throw new Error('should not be called')
    })
    expect((await $.command.run({ command: 'eidola', args: 'place sideways', ...TYPED })).text).toContain(`"sideways" isn't a switch.`)
    expect((await $.command.run({ command: 'eidola', args: 'place both', ...TYPED })).text).toContain(`"both" isn't a switch.`)
    expect((await $.command.run({ command: 'eidola', args: 'place band maybe', ...TYPED })).text).toContain('Say on or off')
    expect((await $.command.run({ command: 'eidola', args: 'place band', ...TYPED })).text).toContain('Say on or off')
  })

  test('/eidola reports the switches in its diagnostics', { options: { hideBandWhilePaneOpen: false } }, async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('session.surfaces', () => ({ value: ['desktop' as const] }))
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
    const out = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(out.text).toContain('Switches: pane on · band on. Band: showing. Status line: on.')
  })
})

/**
 * A session with `stored` awake: the panes it opens and closes, recorded,
 * and placed or not as `pane.isPlaced` says.
 */
function engine(on: On, stored: string | null) {
  const pane = { isPlaced: false, opened: [] as string[], closed: [] as string[] }
  servePackages(on)
  on('ui.open', ($, e) => {
    pane.opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', ($, e) => {
    pane.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', (): { value: UiPane[] } => ({
    value: pane.opened.length ? [{ id: 'eidola', title: 'Eidola', isShown: pane.isPlaced, isFocused: false, isPlaced: pane.isPlaced }] : [],
  }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? stored : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
  return pane
}

describe('the band-only Engram and the pane (the 0.6.0 bug, fixed)', () => {
  test('with Pane and Band on, the Wisp never opens the pane by itself; /eidola opens it on the fen', async ($, on) => {
    const pane = engine(on, 'wisp')
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    expect(pane.opened).toEqual([])
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    expect(pane.opened).toEqual([])

    // Asked for, it opens: on the Wisp's band view, not the picker.
    await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(pane.opened).toEqual(['eidola'])
    const drawn = await $.ui.mount(PANE)
    expect((await drawn.findAll({ type: 'Svg' })).map(svg => svg.props?.alt)).toContain('Wisp in the fen')
    expect(await drawn.find({ type: 'Client', key: 'wisp-band' })).toBeDefined()
    expect(await drawn.find({ type: 'Client', key: 'awaken:kraken' })).toBeUndefined()
    // Its corner still opens the picker over it.
    await drawn.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await drawn.find({ type: 'Client', key: 'awaken:kraken' })).toBeDefined()
    await drawn.unmount()
  })

  test('with the band hidden while the pane is open, the band-only Wisp keeps its band beside the open pane', async ($, on) => {
    const pane = engine(on, 'wisp')
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    const bandDraws = async () => {
      const band = await $.ui.mount(BAND)
      const draws = (await band.find({ type: 'Client', key: 'wisp-band' })) !== undefined
      await band.unmount()
      return draws
    }
    expect(await bandDraws()).toBe(true)
    await $.command.run({ command: 'eidola', args: '', ...TYPED })
    pane.isPlaced = true
    expect(await bandDraws()).toBe(true)
  })

  test('with nothing awake, the resting Wisp keeps its band beside the open pane', async ($, on) => {
    const pane = engine(on, null)
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'eidola', args: '', ...TYPED })
    pane.isPlaced = true
    const band = await $.ui.mount(BAND)
    expect((await band.findAll({ type: 'Svg' })).length).toBeGreaterThan(0)
    await band.unmount()
  })

  test('with hide off (0.6.0 both), the Wisp still never opens the pane by itself, and the band stays', { options: { hideBandWhilePaneOpen: false } }, async ($, on) => {
    const pane = engine(on, 'wisp')
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    expect(pane.opened).toEqual([])
    pane.isPlaced = true
    const band = await $.ui.mount(BAND)
    expect(await band.find({ type: 'Client', key: 'wisp-band' })).toBeDefined()
    await band.unmount()
  })

  test('an Engram that shows in the pane opens it by itself with Pane on', async ($, on) => {
    const pane = engine(on, 'kraken')
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    expect(pane.opened).toEqual(['eidola'])
  })

  test('with Pane off, the Kraken waits to be asked', { options: { pane: false } }, async ($, on) => {
    const pane = engine(on, 'kraken')
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    expect(pane.opened).toEqual([])
    await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(pane.opened).toEqual(['eidola'])
  })
})
