import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { renderScene } from './field'
import { servePackages } from './packages.data'
import { SCENES } from './scenes'
import { BAND_STAGE_PX, stageSize } from './stage'

// Sprint 1.3 removed the five frames Engrams (Spirit, Skull, Moon, Sigil,
// Starfield) and the frames path: the bundle is the Kraken, the Lich and the
// Wisp, a stored awake id for a removed one wakes nothing and says so once,
// and nothing awake draws the resting Wisp's scene, dimmed.

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: false, isFocused: false, isPlaced: false }]
const PANE_PROPS = { title: 'Eidola', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} } as const
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } as const

const KEPT = ['kraken', 'lich', 'wisp']
const REMOVED = { spirit: 'Spirit', skull: 'Skull', moon: 'Moon', sigil: 'Sigil', starfield: 'Starfield' } as const
const STATES = ['idle', 'thinking', 'working', 'attention', 'success', 'responding', 'error', 'waiting', 'sleeping']
/** The veil the resting scene is dimmed under. */
const VEIL = '<rect width="100%" height="100%" fill="#000" opacity="0.55"/></svg>'

/**
 * The engine around the mod: a store holding `stored` as the awake Engram's
 * id, kept as the mod writes it; panes that open placed; the clock fixed; the
 * bundled packages' manifests served; and every other file read recorded and
 * refused.
 */
function engine(on: On, stored: string | null | undefined) {
  const store = new Map<string, unknown>(stored === undefined ? [] : [['engram', stored]])
  const reads: string[] = []
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  servePackages(on, path => {
    reads.push(path.replace(/\\/g, '/'))
    throw new Error('no such file')
  })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // A terminal session, so /engrams prints its list: on the desktop it opens a screen in the pane instead.
  on('session.surfaces', () => ({ value: ['terminal' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
  return { store, reads }
}

async function startSession($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

describe('removal: the bundle', () => {
  test('the picker, /awaken and /engrams know only the Kraken, the Lich and the Wisp', async ($, on) => {
    engine(on, null)
    await startSession($)
    const pane = await $.ui.mount({ plugin: 'eidola', surface: 'desktop', component: 'Pane', requestId: 'eidola', props: PANE_PROPS })
    await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
    const cards = (await pane.findAll({ type: 'Box' }))
      .map(box => /^card:(.+)$/.exec(String(box.key))?.[1])
      .filter((id): id is string => id !== undefined)
    expect([...cards].sort()).toEqual(KEPT)
    expect(await pane.find({ type: 'Button', key: 'picker-back' })).toBeDefined()
    await pane.unmount()

    const listed = (await $.command.run({ command: 'engrams', args: '', ...TYPED })).text ?? ''
    expect(listed.split('\n').map(line => line.split(':')[0]).sort()).toEqual(KEPT)

    for (const [id, name] of Object.entries(REMOVED)) {
      const out = (await $.command.run({ command: 'awaken', args: id, ...TYPED })).text ?? ''
      expect(out).toContain(`No Engram called "${id}"`)
      expect(out).not.toContain(name)
    }
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).not.toContain('(awake)')
  })
})

describe('removal: a removed Engram stored as awake', () => {
  for (const [id, name] of Object.entries(REMOVED)) {
    test(`${name} stored as awake: the session starts with nothing awake, and /eidola says so once`, async ($, on) => {
      const { store } = engine(on, id)
      await startSession($)
      // Cleared, not left to wake the default Wisp next session.
      expect(store.get('engram')).toBeNull()
      expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).not.toContain('(awake)')

      const first = (await $.command.run({ command: 'eidola', args: '', ...TYPED })).text ?? ''
      expect(first.split('\n')[0]).toBe(`${name} was removed in 0.7.0. Pick another with /awaken.`)
      const second = (await $.command.run({ command: 'eidola', args: '', ...TYPED })).text ?? ''
      expect(second).not.toContain('was removed')

      // The next session starts quietly too: still nothing awake, no notice.
      await startSession($)
      expect(store.get('engram')).toBeNull()
      expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).not.toContain('was removed')
    })
  }

  test('a kept Engram stored as awake wakes as before, with no notice', async ($, on) => {
    const { store } = engine(on, 'lich')
    await startSession($)
    expect(store.get('engram')).toBe('lich')
    expect((await $.command.run({ command: 'engrams', args: '', ...TYPED })).text).toContain('lich (awake)')
    expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).not.toContain('was removed')
  })
})

describe('removal: nothing awake', () => {
  test("the desktop pane draws the resting Wisp's scene, dimmed, where its sleeping frame drew", async ($, on) => {
    const { reads } = engine(on, null)
    await startSession($)
    const pane = await $.ui.mount({ plugin: 'eidola', surface: 'desktop', component: 'Pane', requestId: 'eidola', props: PANE_PROPS })
    const { width, height } = stageSize(PANE_PROPS.bodyColumns, PANE_PROPS.scroll.bodyRows, PANE_PROPS.placement)
    // An Svg is a leaf with no address: the pane's one Svg is the scene.
    const svgs = await pane.findAll({ type: 'Svg' })
    expect(svgs.length).toBe(1)
    const svg = svgs[0]
    expect(svg?.props).toMatchObject({ alt: 'Wisp: Asleep', width, height, isInteractive: true })
    expect(svg?.props?.source).toBe(renderScene(SCENES.wisp.pane('sleeping', width, height), NOW).replace(/<\/svg>$/, VEIL))
    // No frame, no picker: the scene and the corner that opens the picker.
    expect(await pane.find({ type: 'Button' })).toBeUndefined()
    expect(await pane.find({ type: 'Client', key: 'frame-corner' })).toBeDefined()
    await pane.unmount()
    expect(reads.filter(path => STATES.some(state => path.endsWith(`/${state}.svg`)))).toEqual([])
  })

  test("the desktop band draws the resting Wisp's scene, dimmed, beside its name and state", async ($, on) => {
    const { reads } = engine(on, null)
    await startSession($)
    const band = await $.ui.mount({ plugin: 'eidola', surface: 'desktop', component: 'AbovePrompt', props: BAND_PROPS })
    const svgs = await band.findAll({ type: 'Svg' })
    expect(svgs.length).toBe(1)
    const svg = svgs[0]
    expect(svg?.props).toMatchObject({ alt: 'Wisp · Asleep · No Engram awake', width: BAND_STAGE_PX, height: BAND_STAGE_PX })
    expect(svg?.props?.source).toBe(renderScene(SCENES.wisp.band('sleeping', BAND_STAGE_PX, BAND_STAGE_PX), NOW).replace(/<\/svg>$/, VEIL))
    expect(await band.find({ type: 'Text', text: 'No Engram awake' })).toBeDefined()
    await band.unmount()
    expect(reads.filter(path => STATES.some(state => path.endsWith(`/${state}.svg`)))).toEqual([])
  })

  test('the terminal still draws the sleeping face', async ($, on) => {
    engine(on, null)
    await startSession($)
    for (const component of ['Pane', 'AbovePrompt'] as const) {
      const ui =
        component === 'Pane'
          ? await $.ui.mount({ plugin: 'eidola', surface: 'terminal', component, requestId: 'eidola', props: PANE_PROPS })
          : await $.ui.mount({ plugin: 'eidola', surface: 'terminal', component, props: BAND_PROPS })
      expect(await ui.find({ type: 'Text', text: '( -_- ) z' })).toBeDefined()
      await ui.unmount()
    }
  })
})
