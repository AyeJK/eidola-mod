import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import { servePackages } from './packages.data'

const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  surface: 'desktop',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

describe('live test', () => {
  test('each run hands the same Client the next mood', async ($, on) => {
    servePackages(on)
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    for (const mood of ['idle', 'working', 'attention']) {
      const out = await $.command.run({ command: 'eidola', args: 'live', ...TYPED })
      expect(out.text).toContain(`Live test: ${mood}`)
      const ui = await $.ui.mount(PANE)
      const client = await ui.find({ type: 'Client' })
      expect(client?.props?.key ?? client?.key).toBe('live')
      expect((client?.props?.props as { mood?: string } | undefined)?.mood).toBe(mood)
      await ui.unmount()
    }
    expect((await $.command.run({ command: 'eidola', args: 'live off', ...TYPED })).text).toBe('Live test off.')
  })
})
