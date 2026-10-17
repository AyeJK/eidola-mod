// The Eidola skill's starter Engram plugin (skills/eidola-engram/starter/),
// what "create from nothing" copies: it announces and joins the registry,
// and draws inside Eidola's pane and band in each of the three moods, with
// its error effect after the ink rises, on terminal and desktop, loaded
// before Eidola (its hooks above Eidola's, `prepend`) and after (`append`).
// The starter's own folder holds no test: `claude plugin test` would run it
// as part of the mod, and the skill copies the folder whole.

import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine, Mounted, Plugin } from 'claude-code/testing'

import { register as starter } from '../skills/eidola-engram/starter/hooks/register'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const SURFACES = ['terminal', 'desktop'] as const
const ORDERS = ['prepend', 'append'] as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const SCROLL = { offset: 0, bodyRows: 40 }
const PANE = {
  plugin: 'eidola',
  component: 'Pane',
  requestId: 'eidola',
  props: { title: 'Eidola', isFocused: false, bodyColumns: 48, placement: 'dock', scroll: SCROLL, view: {} },
} as const
const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: SCROLL, view: {} },
} as const
const UNPLACED: UiPane[] = []

/** skills/eidola-engram/starter/engram.json, as the tests' engine serves it (the kit reads no disk). */
const STARTER_ENGRAM = {
  spec: 2,
  id: 'starter',
  name: 'Starter',
  version: '0.1.0',
  author: 'eidola',
  description: 'A small mote of light that drifts at rest, works in amber and calls in yellow.',
  rights: 'original',
  vessel: { scene: 'self', shows: ['pane', 'band'], thumbnails: { pane: 'thumb-pane.svg' }, hud: { show: true, meter: 'none', tag: 'name', bracket: '#7fd4ff' } },
}

function file(path: string): string {
  const at = path.replace(/\\/g, '/')
  if (at.endsWith('/hooks/hooks.json')) {
    return '{ "modules": ["./register.tsx"] }'
  }
  if (at.endsWith('/.claude-plugin/plugin.json')) {
    return JSON.stringify({ name: 'starter', dependencies: ['eidola'] })
  }
  if (at.endsWith('/engram.json')) {
    return JSON.stringify(STARTER_ENGRAM)
  }
  throw new Error(`ENOENT: ${path}`)
}

/** The engine beneath the plugins: the bundled packages, the starter's files, the starter awake when the session ended. */
function engine(on: On): void {
  servePackages(on, file)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? 'starter' : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

/** The middle line of the starter's body in each look: its eyes. */
const EYES = { idle: '( -.- )', working: '( >.< )', attention: '( O.O )', error: '( x.x )' } as const

/** True when the drawing shows a Text holding `text`. */
async function shows(ui: Pick<Mounted, 'findAll'>, text: string): Promise<boolean> {
  return (await ui.findAll({ type: 'Text' })).some(one => String(one.text).includes(text))
}

const STARTER: Omit<Plugin, 'tier'> = { name: 'starter', register: starter }

describe('the starter Engram plugin', () => {
  for (const tier of ORDERS) {
    const seat = tier === 'prepend' ? 'above' : 'beneath'

    test(`${seat} Eidola, it announces and can be awoken`, { plugins: [{ ...STARTER, tier }] }, async ($, on) => {
      engine(on)
      await start($)
      expect((await $.command.run({ command: 'awaken', args: 'starter', ...TYPED })).text).toBe('Starter is awake.')
    })

    for (const surface of SURFACES) {
      for (const [where, mount] of [['pane', PANE], ['band', BAND]] as const) {
        test(`${seat} Eidola, it draws each mood in the ${where} on ${surface}`, { plugins: [{ ...STARTER, tier }] }, async ($, on) => {
          engine(on)
          await start($)
          for (const mood of ['working', 'attention', 'idle'] as const) {
            await $.command.run({ command: 'eidola', args: `mood ${mood}`, ...TYPED })
            const ui = await $.ui.mount({ ...mount, surface })
            expect(await ui.find({ type: 'Box', key: 'eidola:starter' }), `${mood}: its Box`).toBeDefined()
            expect(await shows(ui, EYES[mood]), `${mood}: its face`).toBe(true)
            // Eidola's fallback stays out of the way.
            expect(await ui.find({ type: 'Box', key: 'eidola-fallback:starter' })).toBeUndefined()
            await ui.unmount()
          }
        })
      }
    }

    test(`${seat} Eidola, the error effect plays over the mood when the ink rises`, { plugins: [{ ...STARTER, tier }] }, async ($, on) => {
      engine(on)
      await start($)
      await $.command.run({ command: 'eidola', args: 'mood working', ...TYPED })
      await $.command.run({ command: 'eidola', args: 'ink', ...TYPED })
      const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
      expect(await shows(ui, EYES.error)).toBe(true)
      expect(await shows(ui, EYES.working)).toBe(false)
      await ui.unmount()
    })
  }

  test('beneath Eidola, it fills the room it is handed', { plugins: [{ ...STARTER, tier: 'append' }] }, async ($, on) => {
    engine(on)
    await start($)
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const box = await ui.find({ type: 'Box', key: 'eidola:starter' })
    expect(box?.props['width']).toBe(48)
    expect(box?.props['height']).toBe(39)
    await ui.unmount()
  })
})
