import { describe, expect, mock, test } from 'claude-code/testing'
import type { CommandInfo, On, UiPane } from 'claude-code'
import type { ElementQuery, Engine, FoundElement, Plugin } from 'claude-code/testing'

import { register as fixture } from '../test/fixtures/engram-plugin/hooks/register'
import { servePackages } from './packages.data'
import { RULE, THEME } from './theme'

const NOW = 1_760_000_000_000

const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Lich', isShown: false, isFocused: false, isPlaced: false }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  surface: 'desktop',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Lich', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} },
} as const
const TERMINAL = { ...PANE, surface: 'terminal' } as const

/** The first Text that shows exactly `text`: a Text carries no key to find it by. */
async function exact(ui: { findAll: (query: ElementQuery) => Promise<FoundElement[]> }, text: string): Promise<FoundElement | undefined> {
  return (await ui.findAll({ type: 'Text', text })).find(one => one.text === text)
}

type LiveProps = { mood?: string; ink?: number; cols?: number; rows?: number }

/** The engine around the mod: panes that open placed, the clock fixed, the bundled packages served. */
function engine(on: On): { toasts: string[] } {
  const toasts: string[] = []
  servePackages(on)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  return { toasts }
}

/** Opens the picker from the corner, then the Lich's page from its card's body. */
async function openLichPage($: Engine) {
  const pane = await $.ui.mount(PANE)
  await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
  await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'open:lich' })
  return pane
}

describe('the Engram page', () => {
  test("clicking a card's body opens its page; its button still acts at once; back returns to the picker", async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })

    // The body of each card is a region to click, laid over its still, name and description.
    for (const id of ['wisp', 'kraken', 'lich']) {
      expect(await pane.find({ type: 'Client', key: `open:${id}` })).toBeDefined()
    }
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'open:lich' })
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
    expect(await pane.find({ type: 'Box', key: 'card:wisp' })).toBeUndefined()
    // The live scene in its preview, and the corner still there to close it all.
    expect(await pane.find({ type: 'Client', key: 'preview-lich' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()

    await pane.press({ key: 'page-back' })
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'card:lich' })).toBeDefined()

    // The card's button awakens without opening the page.
    await pane.press({ key: 'awaken:wisp' })
    expect(await pane.find({ type: 'Box', key: 'page:wisp' })).toBeUndefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('wisp (awake)')
    await pane.unmount()
  })

  test('the page: header, preview, mood chips, Error, name and rule, Awaken, Where it draws and the four cards', async ($, on) => {
    const { toasts } = engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await openLichPage($)

    expect(await pane.find({ type: 'Button', key: 'page-back' })).toMatchObject({ props: { label: '‹' } })
    expect(await pane.find({ type: 'Box', key: 'preview' })).toMatchObject({ props: { backgroundColor: THEME.preview, height: 14 } })
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      expect(await pane.find({ type: 'Box', key: `preview-${corner}` })).toBeDefined()
    }
    expect(await pane.find({ type: 'Text', text: 'EIDOLA · LICH' })).toMatchObject({ props: { color: THEME.gold } })
    expect(await exact(pane, 'IDLE')).toMatchObject({ props: { bold: true, color: THEME.amber } })
    expect(await pane.find({ type: 'Text', text: 'PREVIEW · NOT AWAKE' })).toBeDefined()
    expect((await pane.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('preview-mood:')).map(b => b.props.label)).toEqual(['IDLE', 'WORKING', 'ATTENTION'])
    expect(await pane.find({ type: 'Box', key: 'preview-error-box' })).toMatchObject({ props: { borderColor: THEME.ember } })

    expect(await exact(pane, 'BUNDLED ENGRAM')).toMatchObject({ props: { color: THEME.gold } })
    expect(await exact(pane, 'Lich')).toMatchObject({ props: { bold: true, color: THEME.white } })
    const rule = await pane.find({ type: 'Box', key: 'about-rule' })
    expect((rule?.children as Array<{ props: { backgroundColor: string } }>).map(bar => bar.props.backgroundColor)).toEqual([...RULE])
    expect(await pane.find({ type: 'Text', text: 'A crowned skull' })).toMatchObject({ props: { color: THEME.body } })
    expect(await pane.find({ type: 'Button', key: 'page-awaken' })).toMatchObject({ props: { label: 'AWAKEN', variant: 'primary' } })

    // Where it draws, from the surfaces setting: the defaults put the Lich in the pane and the band.
    expect(await pane.find({ type: 'Box', key: 'where' })).toMatchObject({ props: { borderColor: THEME.line, backgroundColor: THEME.panel } })
    expect(await pane.find({ type: 'Text', text: 'WHERE IT DRAWS' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Draws in the pane, which opens by itself when it wakes.' })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Draws in the band, hidden while the pane is open.' })).toBeDefined()
    // The link opens the Surfaces screen; back returns to the page.
    await pane.press({ key: 'page-surfaces' })
    expect(await pane.find({ type: 'Box', key: 'surfaces-page' })).toBeDefined()
    expect(toasts).toEqual([])
    await pane.press({ key: 'surfaces-back' })
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()

    for (const [title, text] of [
      ['DRAWS', 'lich scene · pane + band'],
      ['SOURCE', 'Bundled with Eidola · v'],
      ['RIGHTS', 'Original: made by its author.'],
      ['ON ERROR', 'It is scorched'],
    ] as const) {
      expect(await exact(pane, title)).toMatchObject({ props: { color: THEME.gold } })
      expect(await pane.find({ type: 'Text', text })).toMatchObject({ props: { color: THEME.frost } })
    }

    // Awaken from the page: it acts at once, and the page stays, now with Sleep.
    await pane.press({ key: 'page-awaken' })
    expect(await pane.find({ type: 'Button', key: 'page-sleep' })).toMatchObject({ props: { label: 'Sleep', variant: 'secondary' } })
    expect(await pane.find({ type: 'Text', text: 'PREVIEW · AWAKE' })).toBeDefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('lich (awake)')
    await pane.press({ key: 'page-sleep' })
    expect(await pane.find({ type: 'Button', key: 'page-awaken' })).toBeDefined()
    await pane.unmount()
  })

  test('the preview in each mood, and with the error', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await openLichPage($)
    const live = async () => (await pane.find({ type: 'Client', key: 'preview-lich' }))?.props?.props as LiveProps | undefined

    expect(await live()).toMatchObject({ mood: 'idle', ink: 0, cols: 50, rows: 14 })
    for (const [mood, name] of [
      ['working', 'WORKING'],
      ['attention', 'ATTENTION'],
      ['idle', 'IDLE'],
    ] as const) {
      await pane.press({ key: `preview-mood:${mood}` })
      expect((await live())?.mood).toBe(mood)
      expect(await exact(pane, name)).toMatchObject({ props: { color: THEME.amber } })
      expect(await pane.find({ type: 'Box', key: `chip-preview-mood:${mood}` })).toMatchObject({ props: { borderColor: THEME.amberLine, backgroundColor: THEME.amberFill } })
    }

    // The error: the preview's own ink rises, and its words turn to the error.
    await pane.press({ key: 'preview-error' })
    expect((await live())?.ink).toBe(1)
    expect(await exact(pane, 'ERROR')).toMatchObject({ props: { color: THEME.errorText } })
    expect(await exact(pane, 'fault')).toMatchObject({ props: { color: THEME.muted } })
    // No mood chip is selected while the error shows; a chip clears it.
    for (const mood of ['idle', 'working', 'attention']) {
      expect(await pane.find({ type: 'Box', key: `chip-preview-mood:${mood}` })).toMatchObject({ props: { borderColor: THEME.line } })
    }
    await pane.press({ key: 'preview-mood:working' })
    expect(await exact(pane, 'WORKING')).toBeDefined()
    expect(await exact(pane, 'ERROR')).toBeUndefined()
    await pane.unmount()
  })

  test("the preview's chips and Error leave the session's mood and ink alone", async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const pane = await openLichPage($)
    await pane.press({ key: 'preview-mood:attention' })
    await pane.press({ key: 'preview-error' })
    await pane.press({ key: 'preview-error' })
    await pane.press({ key: 'preview-mood:working' })

    // The awake strip in the picker still says idle.
    await pane.press({ key: 'page-back' })
    expect(await exact(pane, 'Idle · drawing in Pane and Band')).toBeDefined()
    // And the Lich in the pane is idle and unscorched.
    await pane.press({ key: 'picker-back' })
    const slice = (await pane.find({ type: 'Client', key: 'lich-0' }))?.props?.props as LiveProps | undefined
    expect(slice).toMatchObject({ mood: 'idle', ink: 0 })

    // A page opened afresh starts its preview idle.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await pane.press({ key: 'strip-details' })
    expect((await pane.find({ type: 'Client', key: 'preview-lich' }))?.props?.props).toMatchObject({ mood: 'idle', ink: 0 })
    await pane.unmount()
  })

  test('the Wisp, band only: its preview is its band strip, and Where it draws says so', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'open:wisp' })
    expect(await pane.find({ type: 'Box', key: 'preview' })).toMatchObject({ props: { height: 9 } })
    expect((await pane.find({ type: 'Client', key: 'preview-wisp' }))?.props?.props).toMatchObject({ mood: 'idle', rows: 9 })
    expect(await pane.find({ type: 'Text', text: "Doesn't show in the pane. Opened by hand, the pane draws its band view." })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Draws in the band above the prompt.' })).toBeDefined()
    expect(await exact(pane, 'wisp scene · band only')).toBeDefined()
    await pane.unmount()
  })

  test('/engrams <id> opens the page by itself; back returns to the Engram', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    expect((await $.command.run({ command: 'engrams', args: 'kraken', ...TYPED })).text).toBe("Kraken's page is open in the pane.")
    expect((await $.command.run({ command: 'engrams', args: 'nobody', ...TYPED })).text).toContain('No Engram called "nobody"')
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Box', key: 'page:kraken' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'preview-kraken' })).toBeDefined()
    await pane.press({ key: 'page-back' })
    expect(await pane.find({ type: 'Box', key: 'page:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'card:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'lich-0' })).toBeDefined()
    await pane.unmount()
  })
})

describe('the Engram page in the terminal', () => {
  test('the same page in plain text: the preview in words, its chips and Error, where it draws, the cards', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'engrams', args: 'lich', ...TYPED })
    const term = await $.ui.mount(TERMINAL)
    expect(await term.findAll({ type: 'Svg' })).toEqual([])
    expect(await term.findAll({ type: 'Client' })).toEqual([])
    expect(await term.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'EIDOLA' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'EIDOLA · LICH' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'PREVIEW · NOT AWAKE' })).toBeDefined()
    expect(await exact(term, 'Lich')).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'WHERE IT DRAWS' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'It is scorched' })).toBeDefined()

    for (const [mood, name] of [
      ['idle', 'IDLE'],
      ['working', 'WORKING'],
      ['attention', 'ATTENTION'],
    ] as const) {
      await term.press({ key: `preview-mood:${mood}` })
      expect(await exact(term, name)).toMatchObject({ props: { color: THEME.amber } })
    }
    await term.press({ key: 'preview-error' })
    expect(await exact(term, 'ERROR')).toMatchObject({ props: { color: THEME.errorText } })

    // The session is untouched: back to the Kraken, idle.
    await term.press({ key: 'page-back' })
    expect(await term.find({ type: 'Box', key: 'page:lich' })).toBeUndefined()
    await term.unmount()
    const desk = await $.ui.mount(PANE)
    expect((await desk.find({ type: 'Client', key: 'kraken-live' }))?.props?.props).toMatchObject({ mood: 'idle', ink: 0 })
    await desk.unmount()
  })
})

// ── Remix and Publish with Claude ─────────────────────────────────────
//
// Every Engram's page offers Remix with Claude; the pages of your own
// Engrams offer Publish too. Each starts the Eidola skill with its task.

const SKILL: CommandInfo = { name: 'eidola:eidola-engram', description: 'Make, remix, change, fix, check and publish Engrams', source: 'plugin', plugin: 'eidola' }

/** test/fixtures/engram-plugin/engram.json, as the engine serves it (the kit reads no disk). */
const FIXTURE_ENGRAM = {
  spec: 2,
  id: 'fixture',
  name: 'Fixture',
  version: '0.1.0',
  author: 'eidola',
  description: "A small test creature, drawn by its own plugin inside Eidola's pane and band.",
  rights: 'original',
  remixOf: 'kraken',
  vessel: { scene: 'self', shows: ['pane', 'band'], hud: { show: true, meter: 'none', tag: 'name', bracket: '#4ad6c8' } },
}

function pluginFile(path: string): string {
  const at = path.replace(/\\/g, '/')
  if (at.endsWith('/hooks/hooks.json')) {
    return '{ "modules": ["./register.tsx"] }'
  }
  if (at.endsWith('/.claude-plugin/plugin.json')) {
    return JSON.stringify({ name: 'eidola-engram-fixture' })
  }
  if (at.endsWith('/engram.json')) {
    return JSON.stringify(FIXTURE_ENGRAM)
  }
  throw new Error(`ENOENT: ${path}`)
}

const FIXTURE: Plugin = { name: 'eidola-engram-fixture', tier: 'append', register: fixture }

type Skill = { settle: () => Promise<void>; runs: string[] }

/** The engine around the mod: the clock in memory, the skill listed, each run of it recorded by its arguments. */
function skillEngine(on: On): Skill {
  const clock = mock.clock(on, { now: NOW })
  const skill: Skill = { settle: clock.settle, runs: [] }
  servePackages(on, pluginFile)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: UNPLACED }))
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
  return skill
}

describe('Remix and Publish with Claude', () => {
  for (const surface of ['desktop', 'terminal'] as const) {
    test(`on ${surface}: a bundled page offers Remix with Claude, not Publish; Remix starts the skill`, async ($, on) => {
      const skill = skillEngine(on)
      await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
      await $.command.run({ command: 'engrams', args: 'lich', ...TYPED })
      const pane = await $.ui.mount(surface === 'desktop' ? PANE : TERMINAL)
      expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
      expect(await pane.find({ type: 'Button', key: 'page-remix' })).toMatchObject({ props: { label: 'Remix with Claude', variant: 'secondary' } })
      expect(await pane.find({ type: 'Button', key: 'page-publish' })).toBeUndefined()
      expect(await pane.find({ type: 'Button', key: 'page-awaken' })).toBeDefined()
      await pane.press({ key: 'page-remix' })
      await skill.settle()
      expect(skill.runs).toEqual(['remix lich'])
      // The page stays, so the Engram shows while Claude works.
      expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
      await pane.unmount()
    })
  }

  test("your Engram's page offers Remix and Publish, each to the skill", { plugins: [FIXTURE] }, async ($, on) => {
    const skill = skillEngine(on)
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'engrams', args: 'fixture', ...TYPED })
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Box', key: 'page:fixture' })).toBeDefined()
    expect(await exact(pane, 'YOUR ENGRAM')).toMatchObject({ props: { color: THEME.gold } })
    expect(await pane.find({ type: 'Button', key: 'page-publish' })).toMatchObject({ props: { label: 'Publish', variant: 'secondary' } })
    await pane.press({ key: 'page-remix' })
    await pane.press({ key: 'page-publish' })
    await skill.settle()
    expect(skill.runs).toEqual(['remix fixture', 'publish fixture'])
    await pane.unmount()
  })
})
