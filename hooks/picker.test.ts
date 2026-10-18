import { describe, expect, mock, test } from 'claude-code/testing'
import type { CommandInfo, On, UiPane } from 'claude-code'
import type { ElementQuery, Engine, FoundElement, Plugin } from 'claude-code/testing'

import { register as fixture } from '../test/fixtures/engram-plugin/hooks/register'
import { servePackages } from './packages.data'
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
const BAND = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

/** The first Text that shows exactly `text`: a Text carries no key to find it by. */
async function exact(ui: { findAll: (query: ElementQuery) => Promise<FoundElement[]> }, text: string): Promise<FoundElement | undefined> {
  return (await ui.findAll({ type: 'Text', text })).find(one => one.text === text)
}

describe('the picker', () => {
  // Some 2 s alone; given room for a full run, where every test file runs at once.
  test('the corner triangle opens the picker; a card awakens its Engram and closes it', { timeoutMs: 15_000 }, async ($, on) => {
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

    // A click on it: every bundled Engram as a card; the awake one has no button, the strip above puts it to sleep.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Client', key: 'kraken-live' })).toBeUndefined()
    for (const id of ['wisp', 'lich']) {
      expect(await pane.find({ type: 'Button', key: `awaken:${id}` })).toMatchObject({ props: { label: 'Awaken', variant: 'secondary' } })
    }
    expect(await pane.find({ type: 'Button', key: 'awaken:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'sleep:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'strip-sleep' })).toMatchObject({ props: { label: 'Sleep', variant: 'secondary' } })
    expect((await pane.findAll({ type: 'Svg' })).length).toBeGreaterThanOrEqual(3)
    // A card shows the view its Engram draws in: the Wisp's the band, the rest their pane.
    expect(await pane.find({ type: 'Text', text: 'pane + band' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'band only' })).toBeDefined()
    const alts = (await pane.findAll({ type: 'Svg' })).map(svg => String(svg.props?.alt))
    expect(alts.filter(alt => alt.endsWith(', band view'))).toEqual(['Wisp, band view'])
    expect(alts.filter(alt => alt.endsWith(', pane view')).length).toBe(2)

    // The filter chips, with counts: an Engram that draws in both is listed under Pane and under Band.
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    expect((await pane.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('filter:')).map(b => b.props.label)).toEqual(['ALL 3', 'PANE 2', 'BAND 3', 'YOURS 0'])
    await pane.press({ key: 'filter:band' })
    expect(await pane.find({ type: 'Box', key: 'chip-filter:band' })).toMatchObject({ props: { borderColor: THEME.amberLine, backgroundColor: THEME.amberFill } })
    expect(await pane.find({ type: 'Box', key: 'chip-filter:all' })).toMatchObject({ props: { borderColor: THEME.line } })
    expect(await pane.find({ type: 'Button', key: 'awaken:wisp' })).toBeDefined()
    await pane.press({ key: 'filter:pane' })
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'awaken:wisp' })).toBeUndefined()
    await pane.press({ key: 'filter:all' })
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    // No corner on the picker: back is the header's button alone.
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeUndefined()

    // Awakening the Lich from its card: the picker closes on the Lich.
    await pane.press({ key: 'awaken:lich' })
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-sigil' })).toBeDefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('lich (awake)')

    // Open again; the back button leads back.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toMatchObject({ props: { label: '‹' } })
    await pane.press({ key: 'picker-back' })
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-sigil' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toMatchObject({ props: { props: { isOpen: false } } })
    await pane.unmount()
  })

  test('Sleep on the awake strip puts it to sleep and keeps the picker open', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })

    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await pane.press({ key: 'strip-sleep' })
    expect(await pane.find({ type: 'Button', key: 'awaken:wisp' })).toBeDefined()
    expect(await pane.find({ type: 'Box', key: 'strip' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    await pane.unmount()
  })

  test('the header: back and the wordmark alone; no Surfaces button, title or count', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })

    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toMatchObject({ props: { label: '‹', variant: 'secondary' } })
    const wordmark = (await pane.findAll({ type: 'Svg' })).find(svg => svg.props?.alt === 'Eidola')
    expect(String(wordmark?.props?.source)).toContain(`fill="${THEME.gold}"`)
    expect(String(wordmark?.props?.source)).not.toMatch(/<text|font-family/)
    expect(await pane.find({ type: 'Box', key: 'head-surfaces' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'surfaces' })).toBeUndefined()
    expect(await exact(pane, 'Engrams')).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'rule' })).toBeUndefined()
    expect((await pane.findAll({ type: 'Text' })).filter(text => /BUNDLED/.test(String(text.text)))).toEqual([])
    await pane.unmount()
  })

  test('the awake strip: AWAKE, the name, its mood and where it draws, Details and Sleep; no card repeats it', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })

    const strip = await pane.find({ type: 'Box', key: 'strip' })
    expect(strip?.props).toMatchObject({ borderColor: THEME.line, backgroundColor: THEME.panel })
    expect(await exact(pane, 'IDLE')).toBeUndefined()
    expect(await exact(pane, 'AWAKE')).toMatchObject({ props: { color: THEME.gold } })
    expect((await pane.findAll({ type: 'Text' })).filter(text => text.text === 'AWAKE').length).toBe(1)
    expect(await exact(pane, 'Lich')).toMatchObject({ props: { bold: true, color: THEME.white } })
    expect(await exact(pane, 'Idle · drawing in Pane and Band')).toMatchObject({ props: { color: THEME.muted } })
    // The awake card: the amber border, no badge and no button.
    expect(await pane.find({ type: 'Box', key: 'card:lich' })).toMatchObject({ props: { borderColor: THEME.amberLine } })
    expect(await pane.find({ type: 'Box', key: 'card:kraken' })).toMatchObject({ props: { borderColor: THEME.line, backgroundColor: THEME.card } })
    expect(await pane.find({ type: 'Box', key: 'awake-badge' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'sleep:lich' })).toBeUndefined()

    // Details opens the awake Engram's page; Sleep puts it to sleep, and the strip goes.
    await pane.press({ key: 'strip-details' })
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
    await pane.press({ key: 'page-back' })
    await pane.press({ key: 'strip-sleep' })
    expect(await pane.find({ type: 'Box', key: 'strip' })).toBeUndefined()
    expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeDefined()
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
    // Filling the card's width at 16:9 in whole rows, cropped as a cover image.
    expect(kraken?.props?.source).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 722" width="176" height="95" preserveAspectRatio="xMidYMid slice"><rect width="960" height="722"/></svg>',
    )
    expect(kraken?.props?.width).toBe(176)
    expect(kraken?.props?.height).toBe(95)
    // The Lich's still could not be read: it falls back to its scene.
    const lich = svgs.find(svg => String(svg.props?.alt).startsWith('Lich'))
    expect(String(lich?.props?.source)).not.toBe(STILL)
    await pane.unmount()
  })

  test("a card's description is never clipped: it wraps in full, and its click area covers it", async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    const abouts = await pane.findAll({ type: 'Box', key: 'about' })
    expect(abouts.length).toBe(3)
    for (const about of abouts) {
      expect(about.props?.height).toBeUndefined()
      expect(about.props?.overflow).toBeUndefined()
      expect(about.props?.flexGrow).toBe(1)
    }
    // Two cards a row at 52 columns: 24 cells each, 22 inside, 20 for the words, so each description runs past two rows.
    for (const id of ['wisp', 'kraken', 'lich']) {
      const hit = await pane.find({ type: 'Client', key: `open:${id}` })
      expect(Number(hit?.props?.height), id).toBeGreaterThanOrEqual(5 + 1 + 4)
    }
    // A row of cards stretches to its tallest.
    expect(await pane.find({ type: 'Box', key: 'row:0' })).toMatchObject({ props: { alignItems: 'stretch' } })
    await pane.unmount()
  })

  test('every colour the picker draws is a theme colour', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
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
    expect([...used].filter(colour => !allowed.has(colour))).toEqual([])
    await pane.unmount()
  })
})

describe('the picker in the terminal', () => {
  test('the same screen in plain text: header, awake strip, chips and cards, no Svg and no Client', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    // Opened on the desktop; the picker is the session's, so the terminal's pane shows it too.
    const desk = await $.ui.mount(PANE)
    await desk.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await desk.unmount()

    const term = await $.ui.mount(TERMINAL)
    expect(await term.findAll({ type: 'Svg' })).toEqual([])
    expect(await term.findAll({ type: 'Client' })).toEqual([])
    expect(await term.find({ type: 'Text', text: 'EIDOLA' })).toMatchObject({ props: { bold: true, color: THEME.gold } })
    expect(await term.find({ type: 'Button', key: 'surfaces' })).toBeUndefined()
    expect(await exact(term, 'Engrams')).toBeUndefined()
    expect(await term.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    expect(await exact(term, 'AWAKE')).toMatchObject({ props: { color: THEME.gold } })
    expect(await exact(term, 'IDLE')).toBeUndefined()
    expect(await exact(term, 'Idle · drawing in Pane and Band')).toBeDefined()
    expect((await term.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('filter:')).map(b => b.props.label)).toEqual(['ALL 3', 'PANE 2', 'BAND 3', 'YOURS 0'])
    for (const id of ['wisp', 'lich']) {
      expect(await term.find({ type: 'Button', key: `awaken:${id}` })).toBeDefined()
    }
    expect(await term.find({ type: 'Button', key: 'sleep:kraken' })).toBeUndefined()
    expect(await term.find({ type: 'Button', key: 'strip-sleep' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'band only' })).toBeDefined()

    // A card's name opens its page, in text too.
    await term.press({ key: 'open:wisp' })
    expect(await term.find({ type: 'Box', key: 'page:wisp' })).toBeDefined()
    expect(await term.findAll({ type: 'Svg' })).toEqual([])
    await term.press({ key: 'page-back' })
    expect(await term.find({ type: 'Button', key: 'awaken:wisp' })).toBeDefined()

    // Back from the picker: the face again.
    await term.press({ key: 'picker-back' })
    expect(await term.find({ type: 'Button', key: 'awaken:wisp' })).toBeUndefined()
    await term.unmount()
  })
})

describe('ways in', () => {
  test('/engrams opens the picker in the pane on the desktop', async ($, on) => {
    servePackages(on)
    const opened: string[] = []
    on('session.surfaces', () => ({ value: ['desktop' as const] }))
    on('ui.open', ($2, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true as const } }
    })
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toBe('The Engram picker is open in the pane.')
    expect(opened).toContain('eidola')
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'strip-sleep' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeUndefined()
    await pane.unmount()
  })

  test('/engrams still prints the list where no desktop draws', async ($, on) => {
    servePackages(on)
    on('session.surfaces', () => ({ value: ['terminal' as const] }))
    on('ui.open', () => {
      throw new Error('should not open the pane')
    })
    on('ui.panes', () => ({ value: UNPLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    const listed = (await $.command.run({ command: 'engrams', args: '', ...TYPED })).text ?? ''
    expect(listed.split('\n').map(line => line.split(':')[0])).toEqual(['wisp (awake)', 'kraken', 'lich'])
  })

  for (const [id, name, live] of [
    ['kraken', 'Kraken', 'preview-kraken'],
    ['lich', 'Lich', 'preview-lich'],
  ] as const) {
    test(`/engrams ${id} opens the ${name}'s page`, async ($, on) => {
      servePackages(on)
      on('session.surfaces', () => ({ value: ['desktop' as const] }))
      on('ui.open', () => ({ value: { isPlaced: true as const } }))
      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.invalidate', () => ({ value: undefined }))
      on('store.set', () => ({ value: undefined }))
      on('clock.now', () => ({ value: NOW }))
      await $.command.run({ command: 'awaken', args: 'wisp', ...TYPED })
      expect((await $.command.run({ command: 'engrams', args: id, ...TYPED })).text).toBe(`${name}'s page is open in the pane.`)
      const pane = await $.ui.mount(PANE)
      expect(await pane.find({ type: 'Box', key: `page:${id}` })).toBeDefined()
      expect(await pane.find({ type: 'Client', key: live })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: `EIDOLA · ${name.toUpperCase()}` })).toBeDefined()
      await pane.unmount()
    })
  }

  for (const id of ['kraken', 'lich', 'wisp'] as const) {
    test(`the ${id}'s band has the corner triangle, and it opens the pane on the picker`, async ($, on) => {
      servePackages(on)
      const opened: string[] = []
      on('ui.open', ($2, e) => {
        opened.push(e.id)
        return { value: { isPlaced: true as const } }
      })
      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.invalidate', () => ({ value: undefined }))
      on('store.set', () => ({ value: undefined }))
      on('clock.now', () => ({ value: NOW }))
      await $.command.run({ command: 'awaken', args: id, ...TYPED })
      opened.length = 0
      const band = await $.ui.mount(BAND)
      const corner = await band.find({ type: 'Client', key: 'band-corner' })
      expect(corner).toMatchObject({ props: { width: 3, height: 2, props: { isOpen: false } } })
      expect(String(corner?.props?.module)).toMatch(/frame-corner\.tsx$/)
      expect(await band.find({ type: 'Box', key: 'corner' })).toMatchObject({ props: { position: 'absolute' } })

      await band.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'band-corner' })
      expect(opened).toEqual(['eidola'])
      expect((await band.find({ type: 'Client', key: 'band-corner' }))?.props?.props).toMatchObject({ isOpen: true })
      const pane = await $.ui.mount(PANE)
      expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
      await pane.unmount()
      await band.unmount()
    })
  }
})

// ── Yours ───────────────────────────────────────────────────────────────
//
// The Yours view with the test Engram plugin (test/fixtures/engram-plugin,
// a remix of the Kraken) working and one whose drawing throws and says
// where, and the empty state. Each button starts the Eidola skill with its
// task, or ("or remix one") goes back to the whole picker.

const SKILL: CommandInfo = { name: 'eidola:eidola-engram', description: 'Make, remix, change, fix, check and publish Engrams', source: 'plugin', plugin: 'eidola' }

/** test/fixtures/engram-plugin/engram.json, and the broken one's, as the engine serves them (the kit reads no disk). */
const FIXTURE_ENGRAM = {
  spec: 2,
  id: 'fixture',
  name: 'Fixture',
  version: '0.1.0',
  author: 'eidola',
  description: "A small test creature, drawn by its own plugin inside Eidola's pane and band.",
  rights: 'original',
  remixOf: 'kraken',
  vessel: { scene: 'self', shows: ['pane', 'band'], thumbnails: { pane: 'thumb-pane.svg' }, hud: { show: true, meter: 'none', tag: 'name', bracket: '#4ad6c8' } },
}
const FALLING_ENGRAM = { ...FIXTURE_ENGRAM, id: 'falling', name: 'Falling', remixOf: undefined }

function pluginFile(path: string): string {
  const at = path.replace(/\\/g, '/')
  const owner = /\/plugins\/([^/]+)\//.exec(at)?.[1]
  if (at.endsWith('/hooks/hooks.json')) {
    return '{ "modules": ["./register.tsx"] }'
  }
  // Two whose engram.json is refused, each in a folder with a space: one names its plugin, one has no engram.json or name.
  if (owner === 'refused engram') {
    if (at.endsWith('/.claude-plugin/plugin.json')) {
      return JSON.stringify({ name: 'refused-engram' })
    }
    if (at.endsWith('/engram.json')) {
      return JSON.stringify({ ...FIXTURE_ENGRAM, id: 'Not An Id' })
    }
  }
  if (owner === 'Lost Engram') {
    if (at.endsWith('/.claude-plugin/plugin.json')) {
      return '{}'
    }
    throw new Error(`ENOENT: ${path}`)
  }
  if (at.endsWith('/.claude-plugin/plugin.json')) {
    return JSON.stringify({ name: owner ?? 'eidola-engram-fixture' })
  }
  if (at.endsWith('/engram.json')) {
    return JSON.stringify(owner === 'falling-engram' ? FALLING_ENGRAM : FIXTURE_ENGRAM)
  }
  throw new Error(`ENOENT: ${path}`)
}

const FIXTURE: Plugin = { name: 'eidola-engram-fixture', tier: 'append', register: fixture }

/** An Engram plugin whose drawing throws and says where: marked not loading at hooks/creature.tsx:12. */
const FALLING: Plugin = {
  name: 'falling-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/falling-engram' })
      return next(e)
    })
    on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => {
      await $.eidola.fault({ engram: 'falling', message: 'the creature fell apart.', file: 'hooks/creature.tsx', line: 12 })
      return next(e)
    })
  },
}

/** An Engram plugin whose engram.json is refused: its id is no slug. Its folder holds a space. */
const REFUSED: Plugin = {
  name: 'refused-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/refused engram' })
      return next(e)
    })
  },
}

/** An Engram plugin with no engram.json and no name in its plugin.json: known by its folder's name alone. */
const LOST: Plugin = {
  name: 'lost-engram',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/Lost Engram/' })
      return next(e)
    })
  },
}

type Skill = { settle: () => Promise<void>; runs: string[] }

/** The engine around the mod and its Engram plugins: the clock in memory, the skill listed, each run of it recorded by its arguments. */
function yoursEngine(on: On): Skill {
  const clock = mock.clock(on, { now: NOW })
  const skill: Skill = { settle: clock.settle, runs: [] }
  servePackages(on, pluginFile)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.list', () => ({ value: [SKILL] }))
  on('command.run', { command: SKILL.name }, ($, e) => {
    skill.runs.push(e.args)
    return { text: '' }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
  return skill
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

const SURFACES = ['desktop', 'terminal'] as const

describe('the Yours view', () => {
  for (const surface of SURFACES) {
    test(`on ${surface}: the New Engram tile, a working Engram of yours and a broken one, each button to the skill`, { plugins: [FIXTURE, FALLING], timeoutMs: 15_000 }, async ($, on) => {
      const skill = yoursEngine(on)
      await start($)
      // The broken one, awake, draws once and is marked not loading; then the Kraken wakes.
      await $.command.run({ command: 'awaken', args: 'falling', ...TYPED })
      const once = await $.ui.mount(PANE)
      await once.unmount()
      await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })

      // /eidola's Engrams line: bundled, yours, and the broken one's file and line.
      expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).toContain('Engrams: 3 bundled, 2 yours, 1 not loading: Falling at hooks/creature.tsx:12.')

      // The picker, opened on the desktop; the terminal's pane shows the same.
      const desk = await $.ui.mount(PANE)
      await desk.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
      if (surface === 'terminal') {
        await desk.unmount()
      }
      const pane = surface === 'desktop' ? desk : await $.ui.mount(TERMINAL)
      expect(await pane.find({ type: 'Button', key: 'filter:yours' })).toMatchObject({ props: { label: 'YOURS 2' } })
      expect((await pane.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('filter:')).map(b => b.props.label)).toEqual(['ALL 5', 'PANE 4', 'BAND 5', 'YOURS 2'])
      await pane.press({ key: 'filter:yours' })
      expect(await pane.find({ type: 'Box', key: 'chip-filter:yours' })).toMatchObject({ props: { borderColor: THEME.amberLine, backgroundColor: THEME.amberFill } })
      expect(await pane.find({ type: 'Box', key: 'card:kraken' })).toBeUndefined()

      // The New Engram tile, first.
      expect(await pane.find({ type: 'Box', key: 'new-engram' })).toMatchObject({ props: { borderStyle: 'dashed', borderColor: THEME.line } })
      expect(await exact(pane, 'New Engram')).toMatchObject({ props: { bold: true, color: THEME.white } })
      expect(await pane.find({ type: 'Button', key: 'new-engram-create' })).toMatchObject({ props: { label: 'Create with Claude', variant: 'secondary' } })
      expect(await pane.find({ type: 'Button', key: 'new-engram-remix' })).toMatchObject({ props: { label: 'or remix one' } })

      // Yours, working: YOURS, Remix of the Kraken, Edit with Claude and Awaken.
      expect(await pane.find({ type: 'Box', key: 'card:fixture' })).toBeDefined()
      expect(await exact(pane, 'YOURS')).toMatchObject({ props: { color: THEME.gold } })
      expect(await exact(pane, 'Remix of Kraken')).toMatchObject({ props: { color: THEME.faint } })
      expect(await pane.find({ type: 'Button', key: 'edit:fixture' })).toMatchObject({ props: { label: '✎', variant: 'secondary' } })
      expect(await pane.find({ type: 'Button', key: 'awaken:fixture' })).toMatchObject({ props: { label: 'Awaken' } })

      // Yours, broken: an ember outline, NOT LOADING, its file and line, and Fix with Claude alone.
      expect(await pane.find({ type: 'Box', key: 'card:falling' })).toMatchObject({ props: { borderColor: THEME.ember } })
      expect(await exact(pane, 'NOT LOADING')).toMatchObject({ props: { color: THEME.errorText } })
      expect(await exact(pane, 'hooks/creature.tsx:12: the creature fell apart.')).toMatchObject({ props: { color: THEME.muted } })
      expect(await pane.find({ type: 'Button', key: 'fix:falling' })).toMatchObject({ props: { label: 'Fix with Claude', variant: 'secondary' } })
      expect(await pane.find({ type: 'Button', key: 'awaken:falling' })).toBeUndefined()
      if (surface === 'desktop') {
        expect((await pane.findAll({ type: 'Svg' })).map(svg => String(svg.props?.alt))).toContain('Falling, not loading')
      } else {
        expect(await pane.findAll({ type: 'Svg' })).toEqual([])
        expect(await pane.findAll({ type: 'Client' })).toEqual([])
      }

      // Every button reaches the skill with its task.
      for (const [key, args] of [
        ['new-engram-create', 'new'],
        ['edit:fixture', 'edit fixture'],
        ['fix:falling', 'fix falling'],
      ] as const) {
        await pane.press({ key })
        await skill.settle()
        expect(skill.runs.at(-1)).toBe(args)
      }
      expect(skill.runs).toEqual(['new', 'edit fixture', 'fix falling'])

      // "or remix one": back to the whole picker.
      await pane.press({ key: 'new-engram-remix' })
      expect(await pane.find({ type: 'Box', key: 'chip-filter:all' })).toMatchObject({ props: { borderColor: THEME.amberLine } })
      expect(await pane.find({ type: 'Box', key: 'new-engram' })).toBeUndefined()
      expect(await pane.find({ type: 'Box', key: 'card:kraken' })).toBeDefined()
      expect(skill.runs.length).toBe(3)
      await pane.unmount()
    })

    test(`on ${surface}: an Engram plugin whose engram.json was refused, as a not-loading card whose Fix passes its folder`, { plugins: [REFUSED, LOST], timeoutMs: 15_000 }, async ($, on) => {
      const skill = yoursEngine(on)
      await start($)
      await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })

      // /eidola: each counted as yours and not loading, by its plugin's name (or its folder's), at engram.json; and why.
      const report = (await $.command.run({ command: 'eidola', args: '', ...TYPED })).text ?? ''
      expect(report).toContain('Engrams: 3 bundled, 2 yours, 2 not loading: refused-engram at engram.json; Lost Engram at engram.json.')
      expect(report).toContain(`Engram plugin at /plugins/refused engram didn't load:\n  engram.json: id is "Not An Id", not a slug.`)
      expect(report).toContain("Engram plugin at /plugins/Lost Engram didn't load:\n  engram.json: engram.json couldn't be read")

      const desk = await $.ui.mount(PANE)
      await desk.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
      if (surface === 'terminal') {
        await desk.unmount()
      }
      const pane = surface === 'desktop' ? desk : await $.ui.mount(TERMINAL)
      // Counted under Yours alone: neither draws anywhere.
      expect(await pane.find({ type: 'Button', key: 'filter:yours' })).toMatchObject({ props: { label: 'YOURS 2' } })
      expect((await pane.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('filter:')).map(b => b.props.label)).toEqual(['ALL 3', 'PANE 2', 'BAND 3', 'YOURS 2'])
      expect(await pane.find({ type: 'Box', key: 'card:plugin:refused-engram' })).toBeUndefined()
      await pane.press({ key: 'filter:yours' })

      // Each a not-loading card keyed plugin:<name>: an ember outline, NOT LOADING, the first problem, and Fix with Claude alone.
      for (const [name, where] of [
        ['refused-engram', 'engram.json: id is "Not An Id", not a slug.'],
        ['Lost Engram', "engram.json: engram.json couldn't be read"],
      ] as const) {
        expect(await pane.find({ type: 'Box', key: `card:plugin:${name}` }), name).toMatchObject({ props: { borderColor: THEME.ember } })
        const about = (await pane.findAll({ type: 'Text' })).find(one => String(one.text).startsWith(where))
        expect(about, name).toMatchObject({ props: { color: THEME.muted } })
        expect(await pane.find({ type: 'Button', key: `fix:plugin:${name}` })).toMatchObject({ props: { label: 'Fix with Claude', variant: 'secondary' } })
        // No Engram was read, so no page to open and nothing to awaken.
        expect(await pane.find({ type: 'Button', key: `open:plugin:${name}` })).toBeUndefined()
        expect(await pane.find({ type: 'Client', key: `open:plugin:${name}` })).toBeUndefined()
        expect(await exact(pane, name), name).toMatchObject({ props: { bold: true } })
      }
      expect((await pane.findAll({ type: 'Text', text: 'NOT LOADING' })).filter(one => one.text === 'NOT LOADING').length).toBe(2)
      expect((await pane.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('awaken:'))).toEqual([])
      if (surface === 'desktop') {
        const alts = (await pane.findAll({ type: 'Svg' })).map(svg => String(svg.props?.alt))
        expect(alts).toContain('refused-engram, not loading')
        expect(alts).toContain('Lost Engram, not loading')
      }

      // Fix passes the folder, quoted for its space, as one argument to the skill.
      await pane.press({ key: 'fix:plugin:refused-engram' })
      await skill.settle()
      await pane.press({ key: 'fix:plugin:Lost Engram' })
      await skill.settle()
      expect(skill.runs).toEqual(['fix "/plugins/refused engram"', 'fix "/plugins/Lost Engram"'])
      await pane.unmount()
    })

    test(`on ${surface}: with none of yours, the empty state; Create with Claude and "or remix one"`, { timeoutMs: 15_000 }, async ($, on) => {
      const skill = yoursEngine(on)
      await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
      const desk = await $.ui.mount(PANE)
      await desk.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
      if (surface === 'terminal') {
        await desk.unmount()
      }
      const pane = surface === 'desktop' ? desk : await $.ui.mount(TERMINAL)
      expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
      await pane.press({ key: 'filter:yours' })
      expect(await pane.find({ type: 'Box', key: 'yours-empty' })).toMatchObject({ props: { borderStyle: 'dashed', borderColor: THEME.line } })
      expect(await exact(pane, 'Make your own Engram')).toMatchObject({ props: { bold: true, color: THEME.white } })
      expect(await exact(pane, '+')).toMatchObject({ props: { color: THEME.amber } })
      expect(await pane.find({ type: 'Box', key: 'new-engram' })).toBeUndefined()
      expect((await pane.findAll({ type: 'Box' })).filter(box => String(box.key).startsWith('card:'))).toEqual([])

      await pane.press({ key: 'yours-empty-create' })
      await skill.settle()
      expect(skill.runs).toEqual(['new'])
      await pane.press({ key: 'yours-empty-remix' })
      expect(await pane.find({ type: 'Box', key: 'yours-empty' })).toBeUndefined()
      expect(await pane.find({ type: 'Button', key: 'awaken:lich' })).toBeDefined()
      expect(skill.runs).toEqual(['new'])
      await pane.unmount()
    })
  }

  test('every colour the Yours view draws is a theme colour', { plugins: [FIXTURE, FALLING] }, async ($, on) => {
    yoursEngine(on)
    await start($)
    await $.command.run({ command: 'awaken', args: 'falling', ...TYPED })
    const once = await $.ui.mount(PANE)
    await once.unmount()
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await pane.press({ key: 'filter:yours' })
    const allowed = new Set<string>([...Object.values(THEME), ...RULE])
    const used = new Set<string>()
    const walk = (node: unknown) => {
      if (node && typeof node === 'object') {
        const el = node as { key?: string; props?: Record<string, unknown>; children?: unknown[] }
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
    expect([...used].filter(colour => !allowed.has(colour))).toEqual([])
    await pane.unmount()
  })
})
