import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine, Mounted } from 'claude-code/testing'

import { servePackages } from './packages.data'

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

const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

/**
 * The Kraken awake: an Engram that shows in the pane and the band. The default
 * Wisp shows only in the band, so these tests of where the Engram draws use
 * the Kraken.
 */
async function kraken($: Engine, on: On): Promise<void> {
  servePackages(on)
  on('store.set', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
  await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })
}

const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 80, scroll: SCROLL, view: {} },
} as const

describe('pane', () => {
  for (const surface of SURFACES) {
    test(`draws the awake Engram on ${surface}`, async ($, on) => {
      await kraken($, on)
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
      expect(await ui.find({ type: 'Text', text: 'Kraken' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('band', () => {
  for (const surface of SURFACES) {
    test(`with hide off, draws on ${surface} beside a placed pane`, { options: { hideBandWhilePaneOpen: false } }, async ($, on) => {
      on('ui.panes', () => ({ value: PLACED }))
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeDefined()
      await ui.unmount()
    })

    test(`by default, steps aside on ${surface} while the pane is placed`, async ($, on) => {

      on('ui.panes', () => ({ value: PLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })

    test(`by default, draws on ${surface} when no pane is placed`, async ($, on) => {

      on('ui.panes', () => ({ value: UNPLACED }))
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeDefined()
      await ui.unmount()
    })

    test(`with Pane off, still steps aside on ${surface} for a pane opened by hand`, { options: { pane: false } }, async ($, on) => {

      on('ui.panes', () => ({ value: PLACED }))
      // Beneath the plugin, the engine's own band: empty here.
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })

    test(`a survey draws under the Vessel on ${surface}, not instead of it`, async ($, on) => {

      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => {
        const { Text } = $2.ui.resolve(e)
        return Text({ children: 'How is Claude doing?' })
      })
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
      expect(await findVessel(ui, surface)).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'How is Claude doing?' })).toBeDefined()
      await ui.unmount()
    })

    test(`with Band off, never draws on ${surface}`, { options: { band: false } }, async ($, on) => {

      on('ui.panes', () => ({ value: UNPLACED }))
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      await kraken($, on)
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await findVessel(ui, surface)).toBeUndefined()
      await ui.unmount()
    })
  }
})
