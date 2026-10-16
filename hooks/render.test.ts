import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'
import type { Mounted } from 'claude-code/testing'

// A mount rejects when the surface refuses the tree (an element it lacks, a
// prop it does not take), so each mount here is the check the desktop pane
// failed: Text weight/size drew nothing there.
const SURFACES = ['terminal', 'desktop'] as const
const SCROLL = { offset: 0, bodyRows: 40 }

const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: false, isFocused: false, isPlaced: false }]

/** The Vessel as drawn: its face on a terminal, its Svg elsewhere. Nothing else is in the pane or band. */
function findVessel(ui: Pick<Mounted, 'find'>, surface: (typeof SURFACES)[number]) {
  return surface === 'terminal' ? ui.find({ type: 'Text', text: /^\( / }) : ui.find({ type: 'Svg' })
}

const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: SCROLL, view: {} },
} as const

describe('pane', () => {
  for (const surface of SURFACES) {
    test(`draws the awake Engram on ${surface}`, async $ => {
      const ui = await $.ui.mount({
        plugin: 'eidola',
        surface,
        component: 'Pane',
        requestId: 'eidola',
        props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
      })
      expect(await findVessel(ui, surface)).toBeDefined()
      // No name, state line or buttons: the title and status line carry those.
      expect(await ui.find({ type: 'Button' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'Wisp' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('baked Vessels', () => {
  const BAKED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 60"><rect width="30" height="60"/></svg>'

  test('the pane draws the Engram\'s own SVG for the state, fitted by its viewBox', async ($, on) => {
    const asked: string[] = []
    on('fs.read', ($2, e) => {
      asked.push(e.path)
      return { value: BAKED }
    })
    const ui = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'Pane',
      requestId: 'eidola',
      props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
    })
    const svg = await ui.find({ type: 'Svg' })
    // Set on a stage the size of the body: 31 columns × 8px, 39 rows × 19px.
    expect(svg?.props?.width).toBe(248)
    expect(svg?.props?.height).toBe(741)
    const source = String(svg?.props?.source)
    expect(source).toContain('viewBox="0 0 248 741"')
    expect(source).toContain('viewBox="0 0 30 60"><rect width="30" height="60"/></svg>')
    expect(asked.some(path => path.replace(/\\/g, '/').endsWith('vessels/wisp/idle.svg'))).toBe(true)
    await ui.unmount()
  })

  test('a Vessel with no viewBox is drawn alone, without a stage', async ($, on) => {
    const BARE = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40"/></svg>'
    on('fs.read', () => ({ value: BARE }))
    const ui = await $.ui.mount({
      plugin: 'eidola',
      surface: 'desktop',
      component: 'Pane',
      requestId: 'eidola',
      props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
    })
    expect((await ui.find({ type: 'Svg' }))?.props?.source).toBe(BARE)
    await ui.unmount()
  })

  test('a Vessel file that can\'t be read falls back to the built-in sprite', async ($, on) => {
    on('fs.read', () => {
      throw new Error('missing')
    })
    on('ui.panes', () => ({ value: UNPLACED }))
    const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props?.source)).toContain('shape-rendering="crispEdges"')
    await ui.unmount()
  })
})

describe('band', () => {
  for (const surface of SURFACES) {
    test(`under both, draws on ${surface} beside a placed pane`, { options: { placement: 'both' } }, async ($, on) => {
      on('ui.panes', () => ({ value: PLACED }))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeDefined()
      await ui.unmount()
    })

    test(`under the default placement, steps aside on ${surface} while the pane is placed`, async ($, on) => {
      on('ui.panes', () => ({ value: PLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })

    test(`under auto, draws on ${surface} when no pane is placed`, { options: { placement: 'auto' } }, async ($, on) => {
      on('ui.panes', () => ({ value: UNPLACED }))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeDefined()
      await ui.unmount()
    })

    test(`under auto, steps aside on ${surface} while the pane is placed`, { options: { placement: 'auto' } }, async ($, on) => {
      on('ui.panes', () => ({ value: PLACED }))
      // Beneath the plugin, the engine's own band: empty here.
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })

    if (surface === 'desktop') {
      test('on desktop the band is a status strip: the Vessel, then name and state', async ($, on) => {
        on('ui.panes', () => ({ value: UNPLACED }))
        const ui = await $.ui.mount({ ...BAND, surface })
        const svg = await ui.find({ type: 'Svg' })
        // A square stage that fills the band's height.
        expect(svg?.props?.width).toBe(140)
        expect(svg?.props?.height).toBe(140)
        expect(await ui.find({ type: 'Text', text: /^Wisp · / })).toBeDefined()
        await ui.unmount()
      })
    }

    test(`a survey draws under the Vessel on ${surface}, not instead of it`, async ($, on) => {
      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => {
        const { Text } = $2.ui.resolve(e)
        return Text({ children: 'How is Claude doing?' })
      })
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
      expect(await findVessel(ui, surface)).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'How is Claude doing?' })).toBeDefined()
      await ui.unmount()
    })

    test(`under pane, never draws on ${surface}`, { options: { placement: 'pane' } }, async ($, on) => {
      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })
  }
})
