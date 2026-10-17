import { describe, expect, test } from 'claude-code/testing'
import type { On, RenderSurface, UiPane } from 'claude-code'
import type { ElementQuery, FoundElement } from 'claude-code/testing'

import { servePackages } from './packages.data'
import { ALL_OFF_TEXT, ALL_OFF_TITLE, HIDE_LABEL } from './surfaces-page'
import { RULE, THEME } from './theme'

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
const TERMINAL = { ...PANE, surface: 'terminal' } as const

/** The first Text that shows exactly `text`: a Text carries no key to find it by. */
async function exact(ui: { findAll: (query: ElementQuery) => Promise<FoundElement[]> }, text: string): Promise<FoundElement | undefined> {
  return (await ui.findAll({ type: 'Text', text })).find(one => one.text === text)
}

/**
 * The engine around the mod: the session drawing where `where` says, panes
 * that open placed, every config write recorded and taken (or refused with
 * `deny`), and toasts kept.
 */
function engine(on: On, deny?: string) {
  const session = { where: ['desktop'] as RenderSurface[], writes: [] as Array<{ key: string; value: unknown }>, toasts: [] as string[], opened: [] as string[], closed: [] as string[] }
  servePackages(on)
  on('session.surfaces', () => ({ value: session.where }))
  on('ui.open', ($, e) => {
    session.opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', ($, e) => {
    session.closed.push(e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    session.toasts.push(e.text)
    return { value: undefined }
  })
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('config.set', ($, e) => {
    if (deny !== undefined) {
      return { deny }
    }
    session.writes.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  return session
}

type Ui = { find: (query: ElementQuery) => Promise<FoundElement | undefined>; findAll: (query: ElementQuery) => Promise<FoundElement[]> }

/** A switch's look: its track's border and fill, its knob's colour and side, its press, and the row's border. */
async function switchLook(ui: Ui, id: string) {
  const box = await ui.find({ type: 'Box', key: `switch-box:${id}` })
  const row = await ui.find({ type: 'Box', key: `surface-row:${id}` })
  // The knob: the track's one coloured child (the press beside it takes no colour).
  const knob = ((box?.children ?? []) as Array<{ props?: { color?: string } }>).find(child => typeof child.props?.color === 'string')
  const press = await ui.find({ type: 'Button', key: `switch:${id}` })
  return {
    border: box?.props?.borderColor,
    fill: box?.props?.backgroundColor,
    justify: box?.props?.justifyContent,
    knob: knob?.props?.color,
    label: press?.props?.label,
    row: row?.props?.borderColor,
  }
}

const ON = { border: THEME.amberLine, fill: THEME.amberFill, justify: 'flex-end', knob: THEME.amber, label: 'On', row: THEME.amberLine }
const OFF = { border: THEME.line, fill: undefined, justify: 'flex-start', knob: THEME.faint, label: 'Off', row: THEME.line }

describe('the Surfaces screen', () => {
  test('/eidola place with no arguments opens it on the desktop: Pane, Band with its check, and the Status line', async ($, on) => {
    const session = engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    expect((await $.command.run({ command: 'eidola', args: 'place', ...TYPED })).text).toBe('The Surfaces screen is open in the pane.')
    expect(session.opened).toContain('eidola')
    const pane = await $.ui.mount(PANE)

    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'surfaces-back' })).toMatchObject({ props: { label: '‹' } })
    expect(await pane.find({ type: 'Text', text: 'Surfaces' })).toMatchObject({ props: { bold: true, color: THEME.white } })
    expect(await pane.find({ type: 'Text', text: '2 OF 2 ON' })).toMatchObject({ props: { color: THEME.gold } })
    for (const [id, name] of [
      ['pane', 'Pane'],
      ['band', 'Band'],
      ['status', 'Status line'],
    ] as const) {
      expect(await pane.find({ type: 'Box', key: `surface-row:${id}` })).toMatchObject({ props: { backgroundColor: THEME.panel } })
      expect(await exact(pane, name)).toMatchObject({ props: { bold: true, color: THEME.white } })
      expect(await switchLook(pane, id)).toEqual(ON)
    }
    // The check under the Band: on by default, its tick amber, its label beside it the press.
    expect(await pane.find({ type: 'Box', key: 'check-box:hide' })).toMatchObject({ props: { borderColor: THEME.amberLine, backgroundColor: THEME.amberFill } })
    expect(await pane.find({ type: 'Text', text: '✓' })).toMatchObject({ props: { color: THEME.amber } })
    expect(await pane.find({ type: 'Button', key: 'check:hide' })).toMatchObject({ props: { label: HIDE_LABEL } })
    expect(await pane.find({ type: 'Box', key: 'surfaces-warning' })).toBeUndefined()
    // The icons beside each row, and in the header, amber while on.
    const svgs = await pane.findAll({ type: 'Svg' })
    for (const alt of ['Pane', 'Band', 'Status line']) {
      expect(svgs.some(svg => svg.props?.alt === alt && String(svg.props?.source).includes(`color="${THEME.amber}"`))).toBe(true)
    }
    await pane.unmount()
  })

  test('each switch and the check write the setting /eidola place writes, and the screen redraws', async ($, on) => {
    const session = engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const pane = await $.ui.mount(PANE)

    await pane.press({ key: 'switch:band' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.band', value: false })
    expect(await switchLook(pane, 'band')).toEqual(OFF)
    expect(await pane.find({ type: 'Text', text: '1 OF 2 ON' })).toBeDefined()
    // The header's Band icon goes faint with it.
    const band = (await pane.findAll({ type: 'Svg' })).filter(svg => svg.props?.alt === 'Band').map(svg => String(svg.props?.source))
    expect(band.every(source => source.includes(`color="${THEME.faint}"`))).toBe(true)

    await pane.press({ key: 'check:hide' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.hideBandWhilePaneOpen', value: false })
    expect(await pane.find({ type: 'Box', key: 'check-box:hide' })).toMatchObject({ props: { borderColor: THEME.line } })
    expect(await pane.find({ type: 'Text', text: '✓' })).toBeUndefined()

    await pane.press({ key: 'switch:pane' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.pane', value: false })
    expect(await switchLook(pane, 'pane')).toEqual(OFF)

    await pane.press({ key: 'switch:status' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.statusLine', value: false })
    expect(await switchLook(pane, 'status')).toEqual(OFF)

    // And back on: each is a toggle.
    await pane.press({ key: 'switch:band' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.band', value: true })
    expect(await switchLook(pane, 'band')).toEqual(ON)
    await pane.press({ key: 'check:hide' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.hideBandWhilePaneOpen', value: true })

    // /eidola place, where it prints, shows the same values the screen does.
    session.where = ['terminal']
    const text = (await $.command.run({ command: 'eidola', args: 'place', ...TYPED })).text ?? ''
    expect(text).toContain('Surfaces: pane off · band on (hidden while the pane is open).')
    expect(text).toContain('  pane off: ')
    expect(text).toContain('  band on: ')
    expect(text).toContain('  hide on: ')
    expect(text).toContain('  status off: ')

    // And a switch set by /eidola place shows on the screen.
    expect((await $.command.run({ command: 'eidola', args: 'place pane on', ...TYPED })).text).toContain('pane on')
    expect((await $.command.run({ command: 'eidola', args: 'place status on', ...TYPED })).text).toBe("status on: the Engram's name and state in the status line.")
    expect(session.writes.slice(-2)).toEqual([
      { key: 'eidola.pane', value: true },
      { key: 'eidola.statusLine', value: true },
    ])
    expect(await switchLook(pane, 'pane')).toEqual(ON)
    expect(await switchLook(pane, 'status')).toEqual(ON)
    await pane.unmount()
  })

  test('a refused write says why and leaves the switch as it was', async ($, on) => {
    const session = engine(on, 'a policy owns it')
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.press({ key: 'switch:band' })
    expect(session.toasts.at(-1)).toBe("Couldn't change the band switch here (a policy owns it). Set it in /config instead.")
    expect(await switchLook(pane, 'band')).toEqual(ON)
    await pane.unmount()
  })

  test('with every surface off, a warning says so; turning one on clears it', { options: { pane: false, band: false } }, async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Box', key: 'surfaces-warning' })).toMatchObject({ props: { borderColor: THEME.ember } })
    expect(await exact(pane, ALL_OFF_TITLE)).toMatchObject({ props: { bold: true, color: THEME.errorText } })
    expect(await exact(pane, ALL_OFF_TEXT)).toMatchObject({ props: { color: THEME.muted } })
    expect(await pane.find({ type: 'Text', text: '0 OF 2 ON' })).toBeDefined()
    expect(await switchLook(pane, 'pane')).toEqual(OFF)
    expect(await switchLook(pane, 'band')).toEqual(OFF)

    await pane.press({ key: 'switch:band' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-warning' })).toBeUndefined()
    // The status line is not a surface: off with both surfaces, the warning still shows.
    await pane.press({ key: 'switch:band' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-warning' })).toBeDefined()
    await pane.unmount()
  })

  test('the Surfaces button and link open it over the picker and a page; back returns to each', async ($, on) => {
    const session = engine(on)
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })

    // From the picker's header.
    await pane.press({ key: 'surfaces' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'awaken:kraken' })).toBeUndefined()
    await pane.press({ key: 'surfaces-back' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'awaken:kraken' })).toBeDefined()

    // From a page's "Where it draws" link: back to the page.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'open:kraken' })
    await pane.press({ key: 'page-surfaces' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeDefined()
    await pane.press({ key: 'surfaces-back' })
    expect(await pane.find({ type: 'Box', key: 'page:kraken' })).toBeDefined()

    // The corner closes every screen at once, back to the Lich.
    await pane.press({ key: 'surfaces' })
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'page:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'lich-0' })).toBeDefined()

    // Opened by /eidola place, back returns to the awake Engram; nothing toasts.
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    await pane.press({ key: 'surfaces-back' })
    expect(await pane.find({ type: 'Client', key: 'lich-0' })).toBeDefined()
    expect(session.toasts).toEqual([])
    await pane.unmount()
  })

  test('opened over the band-only Wisp by /eidola place, back closes the pane again', async ($, on) => {
    const session = engine(on)
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.press({ key: 'surfaces-back' })
    expect(session.closed).toContain('eidola')
    await pane.unmount()
  })

  test('every colour the Surfaces screen draws is a theme colour', { options: { pane: false, band: false } }, async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const pane = await $.ui.mount(PANE)
    const allowed = new Set<string>([...Object.values(THEME), ...RULE])
    const used = new Set<string>()
    const walk = (node: unknown) => {
      if (node && typeof node === 'object') {
        const el = node as { key?: string; props?: Record<string, unknown>; children?: unknown[] }
        // The corner triangle is the HUD's, drawn in the Engram's own brass.
        if (el.key === 'corner') {
          return
        }
        for (const prop of ['color', 'backgroundColor', 'borderColor']) {
          const value = el.props?.[prop]
          if (typeof value === 'string') {
            used.add(value)
          }
        }
        ;(el.children ?? []).forEach(walk)
      }
    }
    walk(await pane.drawn())
    expect(used.size).toBeGreaterThan(4)
    expect([...used].filter(colour => !allowed.has(colour))).toEqual([])
    await pane.unmount()
  })
})

describe('the Surfaces screen in the terminal', () => {
  test('/eidola place prints the switches where no desktop draws', async ($, on) => {
    const session = engine(on)
    session.where = ['terminal']
    const text = (await $.command.run({ command: 'eidola', args: 'place', ...TYPED })).text ?? ''
    expect(text).toContain('Surfaces: pane on · band on (hidden while the pane is open).')
    expect(text).toContain('  status on: ')
    expect(session.opened).toEqual([])
  })

  test('the same screen in plain text: rows, switches and the check, no Svg and no Client', async ($, on) => {
    const session = engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    // Opened on the desktop; the screen is the session's, so the terminal's pane shows it too.
    await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    const term = await $.ui.mount(TERMINAL)
    expect(await term.findAll({ type: 'Svg' })).toEqual([])
    expect(await term.findAll({ type: 'Client' })).toEqual([])
    expect(await term.find({ type: 'Box', key: 'surfaces-page' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'EIDOLA' })).toMatchObject({ props: { bold: true, color: THEME.gold } })
    expect(await term.find({ type: 'Text', text: '2 OF 2 ON' })).toBeDefined()
    for (const id of ['pane', 'band', 'status']) {
      expect(await switchLook(term, id)).toEqual(ON)
    }
    expect(await term.find({ type: 'Button', key: 'check:hide' })).toMatchObject({ props: { label: HIDE_LABEL } })

    await term.press({ key: 'switch:pane' })
    await term.press({ key: 'switch:band' })
    expect(session.writes).toEqual([
      { key: 'eidola.pane', value: false },
      { key: 'eidola.band', value: false },
    ])
    expect(await switchLook(term, 'pane')).toEqual(OFF)
    expect(await term.find({ type: 'Box', key: 'surfaces-warning' })).toBeDefined()
    await term.press({ key: 'check:hide' })
    expect(session.writes.at(-1)).toEqual({ key: 'eidola.hideBandWhilePaneOpen', value: false })

    // Back: the face again.
    await term.press({ key: 'surfaces-back' })
    expect(await term.find({ type: 'Box', key: 'surfaces-page' })).toBeUndefined()
    await term.unmount()
  })
})
