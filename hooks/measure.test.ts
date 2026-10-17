import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'

import { REFERENCE_PX, referenceSvg } from './measure'

const SCROLL = { offset: 0, bodyRows: 60 }
const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: SCROLL, view: {} },
} as const
const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

function desktopWithPane(on: On): void {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: PLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_760_000_000_000 }))
}

describe('measure', () => {
  test('the reference square is drawn at its stated size', () => {
    expect(referenceSvg()).toContain(`viewBox="0 0 ${REFERENCE_PX} ${REFERENCE_PX}"`)
  })

  test('/eidola measure swaps pane and band to their reports, and back', async ($, on) => {
    desktopWithPane(on)
    const turnedOn = await $.command.run({ command: 'eidola', args: 'measure', ...TYPED })
    expect(turnedOn.text).toContain('Measure on')

    for (const surface of ['desktop', 'terminal'] as const) {
      const pane = await $.ui.mount({ ...PANE, surface })
      expect(await pane.find({ type: 'Text', text: 'bodyColumns 32 · bodyRows 60' }), surface).toBeDefined()
      await pane.unmount()
      const band = await $.ui.mount({ ...BAND, surface })
      expect(await band.find({ type: 'Text', text: 'bodyColumns 80 · maxRows 12 · bodyRows 11' }), surface).toBeDefined()
      await band.unmount()
    }
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const ref = await pane.find({ type: 'Svg' })
    expect(ref?.props?.width).toBe(REFERENCE_PX)
    await pane.unmount()

    const turnedOff = await $.command.run({ command: 'eidola', args: 'measure', ...TYPED })
    expect(turnedOff.text).toBe('Measure off.')
    const back = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await back.find({ type: 'Text', text: /^Measure/ })).toBeUndefined()
    await back.unmount()
  })
})
