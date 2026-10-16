import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  surface: 'desktop',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 32, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

describe('blend test', () => {
  test('each run shortens the drawing a pixel more and keeps its source', async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    const sources: string[] = []
    const heights: number[] = []
    for (const word of ['idle', 'working', 'attention']) {
      const out = await $.command.run({ command: 'eidola', args: 'blend', ...TYPED })
      expect(out.text).toContain(`Blend test: ${word}`)
      const ui = await $.ui.mount(PANE)
      const svg = await ui.find({ type: 'Svg' })
      sources.push(String(svg?.props?.source))
      heights.push(Number(svg?.props?.height))
      await ui.unmount()
    }
    expect(new Set(sources).size).toBe(1)
    expect(heights).toEqual([758, 757, 756])
    expect((await $.command.run({ command: 'eidola', args: 'blend off', ...TYPED })).text).toBe('Blend test off.')
  })
})
