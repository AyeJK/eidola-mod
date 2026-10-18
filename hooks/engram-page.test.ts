import { describe, expect, mock, test } from 'claude-code/testing'
import type { CommandInfo, On, UiPane } from 'claude-code'
import type { ElementQuery, Engine, FoundElement, Mounted, Plugin } from 'claude-code/testing'

import { register as fixture } from '../test/fixtures/engram-plugin/hooks/register'
import { servePackages } from './packages.data'
import { THEME } from './theme'

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

/** Clicks a Client by key, as the pointer going down on it: a desktop button's label, a card's body. */
async function click(ui: Pick<Mounted<'desktop', 'Pane'>, 'pointer'>, key: string): Promise<void> {
  await ui.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: key })
}

/** What a desktop button's label (`pill.tsx`) is handed. */
async function handed(ui: Pick<Mounted, 'find'>, key: string): Promise<Record<string, unknown> | undefined> {
  return (await ui.find({ type: 'Client', key }))?.props?.props as Record<string, unknown> | undefined
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
  await click(pane, 'open:lich')
  return pane
}

/** A chip on (raised, its label bold white) or off (the panel, its label muted). */
async function chipIs(ui: Pick<Mounted, 'find'>, key: string, isOn: boolean): Promise<void> {
  expect(await ui.find({ type: 'Box', key: `pill-${key}` }), key).toMatchObject({
    props: isOn ? { borderColor: THEME.lineHover, backgroundColor: THEME.raised } : { borderColor: THEME.line, backgroundColor: THEME.panel },
  })
  expect(await handed(ui, key), key).toMatchObject(isOn ? { fg: THEME.white, bold: true } : { fg: THEME.muted, bold: false })
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
    await click(pane, 'open:lich')
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
    expect(await pane.find({ type: 'Box', key: 'card:wisp' })).toBeUndefined()
    // The live scene in its preview; no corner: back is the header's button.
    expect(await pane.find({ type: 'Client', key: 'preview-lich' })).toBeDefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeUndefined()

    await click(pane, 'page-back')
    expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'card:lich' })).toBeDefined()

    // The card's button awakens without opening the page.
    await click(pane, 'awaken:wisp')
    expect(await pane.find({ type: 'Box', key: 'page:wisp' })).toBeUndefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('wisp (awake)')
    await pane.unmount()
  })

  test('the page: Back and Awaken in the header, the preview, its chips and Error, the name, Remix, and three facts', async ($, on) => {
    const { toasts } = engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await openLichPage($)

    expect(await handed(pane, 'page-back')).toMatchObject({ label: '← Back' })
    // Awaken, the gold primary, at the header's right.
    expect(await handed(pane, 'page-awaken')).toMatchObject({ label: 'Awaken', fg: THEME.ink, bold: true })
    expect(await pane.find({ type: 'Box', key: 'pill-page-awaken' })).toMatchObject({ props: { backgroundColor: THEME.goldFill, borderColor: THEME.goldFill } })
    const head = await pane.find({ type: 'Box', key: 'head' })
    expect(JSON.stringify(head)).toContain('"page-awaken"')

    // The preview: the live scene alone, edge to edge, about half the pane tall; nothing written over it.
    expect(await pane.find({ type: 'Box', key: 'preview' })).toMatchObject({ props: { backgroundColor: THEME.preview, width: 48, height: 28 } })
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      expect(await pane.find({ type: 'Box', key: `preview-${corner}` })).toBeUndefined()
    }
    expect(await pane.find({ type: 'Text', text: 'EIDOLA · LICH' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: 'PREVIEW · NOT AWAKE' })).toBeUndefined()
    // The chips under it say which mood it shows; Error is a chip among them.
    expect((await pane.findAll({ type: 'Client' })).filter(c => /^preview-(mood:|error)/.test(String(c.key))).map(c => (c.props?.props as { label: string }).label)).toEqual([
      'Idle',
      'Working',
      'Attention',
      'Error',
    ])
    await chipIs(pane, 'preview-mood:idle', true)
    await chipIs(pane, 'preview-mood:working', false)
    await chipIs(pane, 'preview-error', false)

    // The name, bold white, with Remix with Claude at its right; no kind label and no rule; the description.
    expect(await exact(pane, 'Lich')).toMatchObject({ props: { bold: true, color: THEME.white } })
    expect(await exact(pane, 'BUNDLED ENGRAM')).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'about-rule' })).toBeUndefined()
    expect(await handed(pane, 'page-remix')).toMatchObject({ label: 'Remix with Claude', fg: THEME.frost })
    expect(await pane.find({ type: 'Text', text: 'A crowned skull' })).toMatchObject({ props: { color: THEME.body } })

    // No Where it draws: the Draws fact says it. No Surfaces link.
    expect(await pane.find({ type: 'Box', key: 'where' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: 'WHERE IT DRAWS' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'page-surfaces' })).toBeUndefined()

    // Three facts, two a row in a docked pane; no On error.
    for (const [title, text] of [
      ['DRAWS', 'lich scene · pane only'],
      ['SOURCE', 'Bundled with Eidola · v'],
      ['RIGHTS', 'Original: made by its author.'],
    ] as const) {
      expect(await exact(pane, title)).toMatchObject({ props: { color: THEME.gold } })
      expect(await pane.find({ type: 'Text', text })).toMatchObject({ props: { color: THEME.frost } })
    }
    expect(await exact(pane, 'ON ERROR')).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: 'It is scorched' })).toBeUndefined()
    expect((await pane.findAll({ type: 'Box' })).filter(box => String(box.key).startsWith('facts:')).map(box => box.key)).toEqual(['facts:0', 'facts:2'])

    // Awaken from the page: it acts at once, and the page stays, now with Sleep in deep red.
    await click(pane, 'page-awaken')
    expect(await handed(pane, 'page-sleep')).toMatchObject({ label: 'Sleep', fg: THEME.white, bold: true })
    expect(await pane.find({ type: 'Box', key: 'pill-page-sleep' })).toMatchObject({ props: { backgroundColor: THEME.dangerFill } })
    expect(await pane.find({ type: 'Client', key: 'page-awaken' })).toBeUndefined()
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('lich (awake)')
    await click(pane, 'page-sleep')
    expect(await pane.find({ type: 'Client', key: 'page-awaken' })).toBeDefined()
    expect(toasts).toEqual([])
    await pane.unmount()
  })

  test('the preview in each mood, and with the error', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await openLichPage($)
    const live = async () => (await pane.find({ type: 'Client', key: 'preview-lich' }))?.props?.props as LiveProps | undefined

    expect(await live()).toMatchObject({ mood: 'idle', ink: 0, cols: 48, rows: 28 })
    for (const mood of ['working', 'attention', 'idle'] as const) {
      await click(pane, `preview-mood:${mood}`)
      expect((await live())?.mood).toBe(mood)
      await chipIs(pane, `preview-mood:${mood}`, true)
      await chipIs(pane, 'preview-error', false)
    }

    // The error: the preview's own ink rises, and the Error chip is the one on.
    await click(pane, 'preview-error')
    expect((await live())?.ink).toBe(1)
    await chipIs(pane, 'preview-error', true)
    // No mood chip is on while the error shows; a chip clears it.
    for (const mood of ['idle', 'working', 'attention']) {
      await chipIs(pane, `preview-mood:${mood}`, false)
    }
    await click(pane, 'preview-mood:working')
    await chipIs(pane, 'preview-mood:working', true)
    await chipIs(pane, 'preview-error', false)
    await pane.unmount()
  })

  test("the preview's chips and Error leave the session's mood and ink alone", async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'lich', ...TYPED })
    const pane = await openLichPage($)
    await click(pane, 'preview-mood:attention')
    await click(pane, 'preview-error')
    await click(pane, 'preview-error')
    await click(pane, 'preview-mood:working')

    // Back to the picker, then to the Lich in the pane: idle and unscorched.
    await click(pane, 'page-back')
    expect(await pane.find({ type: 'Box', key: 'strip' })).toBeDefined()
    await click(pane, 'picker-back')
    const slice = (await pane.find({ type: 'Client', key: 'lich-0' }))?.props?.props as LiveProps | undefined
    expect(slice).toMatchObject({ mood: 'idle', ink: 0 })

    // A page opened afresh, from the awake strip, starts its preview idle.
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await click(pane, 'open:strip')
    expect((await pane.find({ type: 'Client', key: 'preview-lich' }))?.props?.props).toMatchObject({ mood: 'idle', ink: 0 })
    await chipIs(pane, 'preview-mood:idle', true)
    await pane.unmount()
  })

  test('the Wisp, band only: its preview is its band strip, and its Draws fact says so', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    const pane = await $.ui.mount(PANE)
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    await click(pane, 'open:wisp')
    // About a third of the pane tall, shorter than a pane view's.
    expect(await pane.find({ type: 'Box', key: 'preview' })).toMatchObject({ props: { width: 48, height: 18 } })
    expect((await pane.find({ type: 'Client', key: 'preview-wisp' }))?.props?.props).toMatchObject({ mood: 'idle', cols: 48, rows: 18 })
    expect(await exact(pane, 'wisp scene · band only')).toMatchObject({ props: { color: THEME.frost } })
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
    await click(pane, 'page-back')
    expect(await pane.find({ type: 'Box', key: 'page:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Box', key: 'card:kraken' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'lich-0' })).toBeDefined()
    await pane.unmount()
  })
})

describe('the Engram page in the terminal', () => {
  test('the same page in plain text: the preview in words, its chips and Error, the name, the facts', async ($, on) => {
    engine(on)
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'engrams', args: 'lich', ...TYPED })
    const term = await $.ui.mount(TERMINAL)
    expect(await term.findAll({ type: 'Svg' })).toEqual([])
    expect(await term.findAll({ type: 'Client' })).toEqual([])
    expect(await term.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'EIDOLA' })).toBeDefined()
    expect(await term.find({ type: 'Button', key: 'page-back' })).toMatchObject({ props: { label: '← Back' } })
    expect(await term.find({ type: 'Button', key: 'page-awaken' })).toMatchObject({ props: { label: 'Awaken' } })
    expect(await term.find({ type: 'Box', key: 'pill-page-awaken' })).toMatchObject({ props: { borderColor: THEME.gold } })
    // The preview in words: its mood, in amber, and the face.
    expect(await term.find({ type: 'Box', key: 'preview' })).toMatchObject({ props: { borderColor: THEME.line } })
    expect(await exact(term, 'IDLE')).toMatchObject({ props: { bold: true, color: THEME.amber } })
    expect(await exact(term, 'Lich')).toMatchObject({ props: { bold: true } })
    expect(await term.find({ type: 'Button', key: 'page-remix' })).toBeDefined()
    expect(await term.find({ type: 'Text', text: 'WHERE IT DRAWS' })).toBeUndefined()
    expect(await exact(term, 'DRAWS')).toBeDefined()

    for (const [mood, name] of [
      ['idle', 'IDLE'],
      ['working', 'WORKING'],
      ['attention', 'ATTENTION'],
    ] as const) {
      await term.press({ key: `preview-mood:${mood}` })
      expect(await exact(term, name)).toMatchObject({ props: { color: THEME.amber } })
      expect(await term.find({ type: 'Box', key: `pill-preview-mood:${mood}` })).toMatchObject({ props: { borderColor: THEME.gold } })
    }
    await term.press({ key: 'preview-error' })
    expect(await exact(term, 'ERROR')).toMatchObject({ props: { color: THEME.errorText } })
    expect(await term.find({ type: 'Box', key: 'pill-preview-error' })).toMatchObject({ props: { borderColor: THEME.gold } })

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
      if (surface === 'desktop') {
        const pane = await $.ui.mount(PANE)
        expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
        expect(await handed(pane, 'page-remix')).toMatchObject({ label: 'Remix with Claude' })
        expect(await pane.find({ type: 'Box', key: 'pill-page-remix' })).toMatchObject({ props: { borderColor: THEME.line, backgroundColor: THEME.panel } })
        expect(await pane.find({ type: 'Client', key: 'page-publish' })).toBeUndefined()
        expect(await pane.find({ type: 'Client', key: 'page-awaken' })).toBeDefined()
        await click(pane, 'page-remix')
        await skill.settle()
        expect(skill.runs).toEqual(['remix lich'])
        // The page stays, so the Engram shows while Claude works.
        expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
        await pane.unmount()
      } else {
        const pane = await $.ui.mount(TERMINAL)
        expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
        expect(await pane.find({ type: 'Button', key: 'page-remix' })).toMatchObject({ props: { label: 'Remix with Claude' } })
        expect(await pane.find({ type: 'Button', key: 'page-publish' })).toBeUndefined()
        expect(await pane.find({ type: 'Button', key: 'page-awaken' })).toBeDefined()
        await pane.press({ key: 'page-remix' })
        await skill.settle()
        expect(skill.runs).toEqual(['remix lich'])
        expect(await pane.find({ type: 'Box', key: 'page:lich' })).toBeDefined()
        await pane.unmount()
      }
    })
  }

  test("your Engram's page offers Remix and Publish, each to the skill", { plugins: [FIXTURE] }, async ($, on) => {
    const skill = skillEngine(on)
    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
    await $.command.run({ command: 'engrams', args: 'fixture', ...TYPED })
    const pane = await $.ui.mount(PANE)
    expect(await pane.find({ type: 'Box', key: 'page:fixture' })).toBeDefined()
    // Its Source fact says it is yours: an Engram plugin.
    expect(await pane.find({ type: 'Text', text: 'Engram plugin eidola-engram-fixture · v0.1.0' })).toMatchObject({ props: { color: THEME.frost } })
    expect(await handed(pane, 'page-publish')).toMatchObject({ label: 'Publish' })
    await click(pane, 'page-remix')
    await click(pane, 'page-publish')
    await skill.settle()
    expect(skill.runs).toEqual(['remix fixture', 'publish fixture'])
    await pane.unmount()
  })
})
