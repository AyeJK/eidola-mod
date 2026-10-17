// What the hooks beneath Eidola draw in the band goes with its strip. A
// plugin beneath (here a stand-in for a background-jobs mod, drawing its
// progress bar while it has a job) draws above the strip; with nothing
// beneath, the strip draws alone, as it always has; a survey still draws
// under it. An Engram plugin's band keeps the same order: the job bar above
// Eidola's frame, the creature inside it, from either seat.

import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'

import { register as fixture } from '../test/fixtures/engram-plugin/hooks/register'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const SURFACES = ['terminal', 'desktop'] as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const UNPLACED: UiPane[] = []
const BAND = {
  plugin: 'eidola',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 11 }, view: {} },
} as const

const JOB = 'JOB ████░░ 60%'
const SURVEY = 'SURVEY: which one?'

/**
 * Stands in for the jobs mod beneath Eidola: while a turn runs (`isWorking`,
 * standing in for "a job is running") it draws its bar above what is
 * beneath it; otherwise, and under a survey, it passes the band on untouched.
 */
const JOBS: Plugin = {
  name: 'jobs',
  tier: 'append',
  register(on) {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const below = await next(e)
      if (e.props.hasSurvey || !e.props.isWorking) {
        return below
      }
      const { Box, Text } = $.ui.resolve(e)
      return Box({ flexDirection: 'column', children: [Text({ children: ['JOB ████░░ 60%'] }), below] })
    })
  },
}

const FIXTURE_ENGRAM = {
  spec: 2,
  id: 'fixture',
  name: 'Fixture',
  version: '0.1.0',
  author: 'eidola',
  description: "A small test creature, drawn by its own plugin inside Eidola's pane and band.",
  rights: 'original',
  remixOf: 'kraken',
  vessel: { scene: 'self', shows: ['pane', 'band'], thumbnails: { pane: 'thumb-pane.svg' }, hud: { show: true, meter: 'none', tag: 'name', bracket: '#4ad6c8' } },
}

function file(path: string): string {
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

/** The engine beneath: the packages, the fixture's files, `awake` stored, and the band's own answer: empty, or the survey while one holds it. */
function engine(on: On, awake: string | null): void {
  servePackages(on, file)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (e.props as { hasSurvey?: boolean }).hasSurvey ? Text({ children: [SURVEY] }) : Box({})
  })
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? awake : undefined }))
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

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown }

/** A drawing as plain data: the engine's own `client` mark left out. */
function plain(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(plain)
  }
  if (node && typeof node === 'object') {
    const { client: _client, children, ...rest } = node as Node & { client?: unknown }
    return JSON.parse(JSON.stringify({ ...rest, ...(children === undefined ? {} : { children: plain(children) }) }))
  }
  return node
}

/** Every string a tree shows. */
function texts(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node]
  }
  if (Array.isArray(node)) {
    return node.flatMap(texts)
  }
  return node && typeof node === 'object' ? texts((node as Node).children ?? []) : []
}

/** Whether a tree holds a Box keyed `key`. */
function holds(node: unknown, key: string): boolean {
  if (Array.isArray(node)) {
    return node.some(child => holds(child, key))
  }
  return Boolean(node && typeof node === 'object' && ((node as Node).props?.['key'] === key || holds((node as Node).children ?? [], key)))
}

/** The band drawn, a job running or not, or under a survey. */
async function band($: Engine, surface: (typeof SURFACES)[number], props: { isWorking?: boolean; hasSurvey?: boolean } = {}): Promise<Node> {
  const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, ...props } })
  const drawn = (await ui.drawn()) as Node
  await ui.unmount()
  return drawn
}

describe('the band, with a plugin beneath', () => {
  for (const surface of SURFACES) {
    for (const awake of ['kraken', 'wisp', null] as const) {
      test(`on ${surface}, ${awake ?? 'nothing'} awake: a job's bar above the strip; with none, the strip alone, unmoved`, { plugins: [JOBS] }, async ($, on) => {
        engine(on, awake)
        await start($)
        const alone = await band($, surface)
        const withJob = await band($, surface, { isWorking: true })
        // No job: nothing beneath to draw, so the strip is the whole band, no column around it.
        expect(texts(alone)).not.toContain(JOB)
        // A job: one column, the bar first, then the very strip drawn without it.
        expect(withJob).toMatchObject({ type: 'Box', props: { flexDirection: 'column', gap: 1 } })
        const [above, strip] = withJob.children as Node[]
        expect(texts(above)).toContain(JOB)
        expect(plain(strip)).toEqual(plain(alone))
        expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).toContain('drew beneath+strip.')
      })
    }

    test(`on ${surface}: under a survey, the strip and then the survey, as before`, { plugins: [JOBS] }, async ($, on) => {
      engine(on, 'kraken')
      await start($)
      const alone = await band($, surface)
      const asked = await band($, surface, { hasSurvey: true, isWorking: true })
      const [strip, survey] = asked.children as Node[]
      expect(texts(survey)).toEqual([SURVEY])
      expect(texts(asked)).not.toContain(JOB)
      // The Kraken's band is shorter under a survey on the desktop: the same strip on the terminal.
      if (surface === 'terminal') {
        expect(plain(strip)).toEqual(plain(alone))
      }
    })

    const FIXTURE = { name: 'eidola-engram-fixture', register: fixture }
    // Above Eidola; beneath it, over the jobs mod (it answers without passing on); beneath it, under the jobs mod (which wraps its drawing).
    for (const [seat, plugins] of [
      ['above Eidola', [{ ...FIXTURE, tier: 'prepend' }, JOBS]],
      ['beneath Eidola, over the jobs mod', [{ ...FIXTURE, tier: 'append' }, JOBS]],
      ['beneath Eidola, under the jobs mod', [JOBS, { ...FIXTURE, tier: 'append' }]],
    ] as const) {
      test(`on ${surface}, an Engram plugin ${seat}: the job's bar above the frame, the creature inside it, nothing marked not loading`, { plugins: [...plugins] as Plugin[] }, async ($, on) => {
        engine(on, 'fixture')
        await start($)
        const alone = await band($, surface)
        expect(holds(alone, 'eidola:fixture')).toBe(true)
        expect(texts(alone)).not.toContain(JOB)
        const withJob = await band($, surface, { isWorking: true })
        expect(withJob).toMatchObject({ type: 'Box', props: { flexDirection: 'column', gap: 1 } })
        const [above, strip] = withJob.children as Node[]
        expect(texts(above)).toContain(JOB)
        expect(holds(above, 'eidola:fixture')).toBe(false)
        expect(holds(strip, 'eidola:fixture')).toBe(true)
        expect(texts(strip)).not.toContain(JOB)
        expect((await $.command.run({ command: 'eidola', args: '', ...TYPED })).text).not.toContain('Not loading')
      })
    }
  }
})
