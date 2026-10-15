import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

// A mount rejects when the surface refuses the tree (an element it lacks, a
// prop it does not take), so each mount here is the check the desktop pane
// failed: Text weight/size drew nothing there.
const SURFACES = ['terminal', 'desktop'] as const
const SCROLL = { offset: 0, bodyRows: 40 }

const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const UNPLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: false, isFocused: false, isPlaced: false }]

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
      expect(await ui.find({ type: 'Text', text: 'Wisp' })).toBeDefined()
      expect(await ui.find({ key: 'sleep' })).toBeDefined()
      await ui.unmount()
    })
  }
})

describe('band', () => {
  for (const surface of SURFACES) {
    test(`draws the Vessel line on ${surface} when no pane is placed`, async ($, on) => {
      on('ui.panes', () => ({ value: UNPLACED }))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /^Wisp · / })).toBeDefined()
      await ui.unmount()
    })

    test(`steps aside on ${surface} while the pane is placed`, async ($, on) => {
      on('ui.panes', () => ({ value: PLACED }))
      // Beneath the plugin, the engine's own band: empty here.
      on('ui.render', { component: 'AbovePrompt' }, ($2, e) => $2.ui.resolve(e).Box({}))
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: /^Wisp · / })).toBeUndefined()
      await ui.unmount()
    })
  }
})
