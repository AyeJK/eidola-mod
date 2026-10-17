// /eidola new, remix <id>, edit <id> and publish <id> start the Eidola skill
// (skills/eidola-engram/SKILL.md) on that task: its slash command, run with
// $.command.run and the task as its arguments. An id is checked first: remix
// takes any Engram, edit and publish only an Engram plugin's (one of the
// person's), and an unknown id starts nothing. The person's starter Engram
// plugin stands in for "yours" here. Fix also takes an Engram plugin whose
// engram.json didn't load, by name or folder, and passes its folder as the
// picker's Fix with Claude does.

import { describe, expect, mock, test } from 'claude-code/testing'
import type { CommandInfo, On, UiPane } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'

import { register as starter } from '../skills/eidola-engram/starter/hooks/register'
import { servePackages } from './packages.data'

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const UNPLACED: UiPane[] = []
const SKILL: CommandInfo = { name: 'eidola:eidola-engram', description: 'Make, remix, change, fix, check and publish Engrams', source: 'plugin', plugin: 'eidola' }

/** The starter's engram.json, as one of the person's Engrams. */
const MINE = {
  spec: 2,
  id: 'starter',
  name: 'Starter',
  version: '0.1.0',
  author: 'you',
  description: 'A small mote of light.',
  rights: 'original',
  vessel: { scene: 'self', shows: ['pane', 'band'] },
}

/** Where the Engram plugin that doesn't load sits: a folder with a space in it. */
const BROKEN_ROOT = '/plugins/My Engrams/broken one'

function file(path: string): string {
  const at = path.replace(/\\/g, '/')
  if (at.includes(`${BROKEN_ROOT}/`)) {
    if (at.endsWith('/.claude-plugin/plugin.json')) {
      return JSON.stringify({ name: 'broken-one', dependencies: ['eidola'] })
    }
    if (at.endsWith('/engram.json')) {
      return JSON.stringify({ ...MINE, id: 'Not An Id' })
    }
  }
  if (at.endsWith('/hooks/hooks.json')) {
    return '{ "modules": ["./register.tsx"] }'
  }
  if (at.endsWith('/.claude-plugin/plugin.json')) {
    return JSON.stringify({ name: 'starter', dependencies: ['eidola'] })
  }
  if (at.endsWith('/engram.json')) {
    return JSON.stringify(MINE)
  }
  throw new Error(`ENOENT: ${path}`)
}

type Seen = { settle: () => Promise<void>; runs: { command: string; args: string }[]; fills: string[] }

/** The engine around the mod: the clock in memory, the skill's command listed (or `commands`), each run of it and each prompt-box fill recorded. */
function engine(on: On, { commands = [SKILL], refuses = false }: { commands?: CommandInfo[]; refuses?: boolean } = {}): Seen {
  const clock = mock.clock(on, { now: NOW })
  const seen: Seen = { settle: clock.settle, runs: [], fills: [] }
  servePackages(on, file)
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.panes', () => ({ value: UNPLACED }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.list', () => ({ value: commands }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: ['desktop' as const] }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
  on('prompt.fill', ($, e) => {
    seen.fills.push(e.text)
    return { isFilled: true }
  })
  for (const one of commands) {
    on('command.run', { command: one.name }, ($, e) => {
      if (refuses) {
        throw new Error('not now')
      }
      seen.runs.push({ command: e.command, args: e.args })
      return { text: '' }
    })
  }
  return seen
}

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

/** /eidola <args>: its answer, once the skill's run, started after it answers, has gone through. */
async function eidola($: Engine, seen: Seen, args: string): Promise<string> {
  const text = (await $.command.run({ command: 'eidola', args, ...TYPED })).text ?? ''
  await seen.settle()
  return text
}

const MINE_PLUGIN: Plugin = { name: 'starter', tier: 'append', register: starter }

/** An Engram plugin whose engram.json is refused (its id is no slug): it has no id, only its name and folder. */
const BROKEN_PLUGIN: Plugin = {
  name: 'broken-one',
  tier: 'append',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.eidola.announce({ root: '/plugins/My Engrams/broken one' })
      return next(e)
    })
  },
}

describe('/eidola starts the Eidola skill', () => {
  test('new: the skill, with the description as typed', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    expect(await eidola($, seen, 'new A glowing Jellyfish that pulses')).toContain('Starting the Eidola skill (/eidola:eidola-engram) to make a new Engram')
    expect(seen.runs).toEqual([{ command: 'eidola:eidola-engram', args: 'new A glowing Jellyfish that pulses' }])
    expect(await eidola($, seen, 'new')).toContain('Starting the Eidola skill')
    expect(seen.runs[1]).toEqual({ command: 'eidola:eidola-engram', args: 'new' })
  })

  test('remix: any Engram, bundled or yours, with what to change', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    expect(await eidola($, seen, 'remix lich in green, slower')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to remix Lich.')
    expect(await eidola($, seen, 'remix Starter')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to remix Starter.')
    expect(seen.runs).toEqual([
      { command: 'eidola:eidola-engram', args: 'remix lich in green, slower' },
      { command: 'eidola:eidola-engram', args: 'remix starter' },
    ])
  })

  test('edit, fix and publish: one of yours', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    expect(await eidola($, seen, 'edit starter make it purple')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to change Starter.')
    expect(await eidola($, seen, 'fix starter')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to fix Starter.')
    expect(await eidola($, seen, 'publish starter')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to publish Starter.')
    expect(seen.runs).toEqual([
      { command: 'eidola:eidola-engram', args: 'edit starter make it purple' },
      { command: 'eidola:eidola-engram', args: 'fix starter' },
      { command: 'eidola:eidola-engram', args: 'publish starter' },
    ])
  })

  test("fix: an Engram plugin that didn't load, by its name or folder, quoted or not: its folder, as the picker's Fix passes it", { plugins: [MINE_PLUGIN, BROKEN_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    const started = `Starting the Eidola skill (/eidola:eidola-engram) to fix the Engram plugin at ${BROKEN_ROOT}.`
    const named = ['broken-one', 'Broken-One it will not load', `"${BROKEN_ROOT}"`, `'${BROKEN_ROOT}'`, `${BROKEN_ROOT}/`, 'broken one', '"broken one"']
    for (const one of named) {
      expect(await eidola($, seen, `fix ${one}`), one).toBe(started)
    }
    expect(seen.runs.map(run => run.args)).toEqual(named.map(() => `fix "${BROKEN_ROOT}"`))
    // An Engram's id still comes first.
    expect(await eidola($, seen, 'fix starter')).toBe('Starting the Eidola skill (/eidola:eidola-engram) to fix Starter.')
    expect(seen.runs.at(-1)?.args).toBe('fix starter')
  })

  test("fix lists the Engram plugins that didn't load; edit and publish don't take them", { plugins: [MINE_PLUGIN, BROKEN_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    const refused = await eidola($, seen, 'fix nobody')
    expect(refused).toContain('No Engram called "nobody"')
    expect(refused).toContain(`Engram plugins that didn't load (/eidola fix <name or folder>):\nbroken-one: didn't load, at ${BROKEN_ROOT}`)
    for (const task of ['edit', 'publish']) {
      const answer = await eidola($, seen, `${task} broken-one`)
      expect(answer).toContain('No Engram called "broken-one"')
      expect(answer).not.toContain("didn't load")
    }
    expect(seen.runs).toEqual([])
  })

  test('an unknown id, or none, starts nothing and lists the Engrams', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    for (const task of ['remix', 'edit', 'fix', 'publish']) {
      const refused = await eidola($, seen, `${task} nobody`)
      expect(refused).toContain('No Engram called "nobody"')
      expect(refused).toContain('kraken: ')
      expect(await eidola($, seen, task)).toContain(`Say which Engram: /eidola ${task} <engram>.`)
    }
    expect(seen.runs).toEqual([])
    expect(seen.fills).toEqual([])
  })

  test('edit and publish refuse a bundled Engram, and point to remix', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    expect(await eidola($, seen, 'edit kraken')).toBe("Kraken is bundled with Eidola: it can't be changed in place. /eidola remix kraken makes one of your own from it.")
    expect(await eidola($, seen, 'fix lich')).toBe("Lich is bundled with Eidola: it can't be fixed in place. /eidola remix lich makes one of your own from it.")
    expect(await eidola($, seen, 'publish wisp')).toBe("Wisp is bundled with Eidola: it can't be published in place. /eidola remix wisp makes one of your own from it.")
    expect(seen.runs).toEqual([])
  })

  test('the skill under the name the session lists it by', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on, { commands: [{ ...SKILL, name: 'eidola-engram' }] })
    await start($)
    expect(await eidola($, seen, 'remix kraken')).toBe('Starting the Eidola skill (/eidola-engram) to remix Kraken.')
    expect(seen.runs).toEqual([{ command: 'eidola-engram', args: 'remix kraken' }])
  })

  test('where the command will not run, it lands in the prompt box instead', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on, { refuses: true })
    await start($)
    expect(await eidola($, seen, 'remix kraken')).toContain('Starting the Eidola skill')
    expect(seen.fills).toEqual(['/eidola:eidola-engram remix kraken'])
  })

  test('the old subcommands still answer as before', { plugins: [MINE_PLUGIN] }, async ($, on) => {
    const seen = engine(on)
    await start($)
    expect(await eidola($, seen, 'mood working')).toBe('Mood: working. It holds until your next prompt.')
    expect(seen.runs).toEqual([])
  })
})
