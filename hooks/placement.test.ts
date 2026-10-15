import { describe, expect, test } from 'claude-code/testing'
import type { UiPane } from 'claude-code'

import { bandShows, effectivePlacement, opensPane, readPlacement, readStatusLine } from './placement'

const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

describe('placement rules', () => {
  test('the person wins; default defers to the Engram, then to both', () => {
    expect(effectivePlacement('pane', 'band')).toBe('pane')
    expect(effectivePlacement('default', 'band')).toBe('band')
    expect(effectivePlacement('default', undefined)).toBe('both')
  })

  test('the band follows the placement', () => {
    expect(bandShows('both', true)).toBe(true)
    expect(bandShows('band', true)).toBe(true)
    expect(bandShows('pane', false)).toBe(false)
    expect(bandShows('auto', true)).toBe(false)
    expect(bandShows('auto', false)).toBe(true)
  })

  test('only band keeps the pane from opening by itself', () => {
    expect(opensPane('band')).toBe(false)
    for (const one of ['both', 'pane', 'auto'] as const) {
      expect(opensPane(one)).toBe(true)
    }
  })

  test('a missing or unknown option reads as default; the status line is on unless turned off', () => {
    expect(readPlacement({})).toBe('default')
    expect(readPlacement({ placement: 'sideways' })).toBe('default')
    expect(readPlacement({ placement: 'auto' })).toBe('auto')
    expect(readStatusLine({})).toBe(true)
    expect(readStatusLine({ statusLine: false })).toBe(false)
  })
})

describe('/eidola place', () => {
  test('with no setting, says where the Vessel is and what the choices are', async $ => {
    const out = await $.command.run({ command: 'eidola', args: 'place', ...TYPED })
    expect(out.text).toContain('Placement: both (setting: default)')
    expect(out.text).toContain('auto: band only while no pane is placed')
  })

  test('writes the choice to the eidola.placement option', async ($, on) => {
    const writes: unknown[] = []
    on('config.set', ($2, e) => {
      writes.push({ key: e.key, value: e.value })
      return { value: e.value }
    })
    const out = await $.command.run({ command: 'eidola', args: 'place band', ...TYPED })
    expect(writes).toEqual([{ key: 'eidola.placement', value: 'band' }])
    expect(out.text).toContain('Placement set to band')
  })

  test('refuses a setting that is not one', async ($, on) => {
    on('config.set', () => {
      throw new Error('should not be called')
    })
    const out = await $.command.run({ command: 'eidola', args: 'place sideways', ...TYPED })
    expect(out.text).toContain(`"sideways" isn't a placement.`)
  })

  test('/eidola reports the placement in its diagnostics', { options: { placement: 'auto' } }, async ($, on) => {
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('session.surfaces', () => ({ value: ['desktop' as const] }))
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
    const out = await $.command.run({ command: 'eidola', args: '', ...TYPED })
    expect(out.text).toContain('Placement: auto (setting: auto). Band: hidden. Status line: on.')
  })
})
