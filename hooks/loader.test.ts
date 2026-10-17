import { describe, expect, test } from 'claude-code/testing'
import type { FsEntry, UiPane } from 'claude-code'

import { withDefaults } from './engram-types'
import { isIgnored, loadEngrams } from './loader'
import type { Disk } from './loader'
import { PACKAGES, dirEntry, fileEntry, packageFile, packageList } from './packages.data'
import { validate } from './validate'

// Sprint 1.4: the bundled Engrams are packages, engrams/<id>/, which the
// loader lists and reads at session start. A package that fails validation is
// skipped with the validator's reason, and the rest load; nothing throws.

const DIR = '/mod/engrams'
const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PLACED: UiPane[] = [{ id: 'eidola', title: 'Eidola', isShown: true, isFocused: false, isPlaced: true }]

/** A package missing every field but its spec and id. */
const BROKEN = '{ "spec": 2, "id": "broken" }'

/**
 * A disk holding the three bundled packages under DIR, plus `extra` folders
 * (by name, their engram.json's text, or an Error its read rejects with) and
 * `files` beside them. Every read is recorded.
 */
function disk(extra: Record<string, string | Error> = {}, files: string[] = []) {
  const reads: string[] = []
  const it: Disk = {
    async list(path) {
      if (path !== DIR) {
        throw new Error(`ENOENT: ${path}`)
      }
      return [...(packageList(path) ?? []), ...Object.keys(extra).map(dirEntry), ...files.map(name => fileEntry(name))]
    },
    async read(path) {
      reads.push(path)
      const folder = /\/engrams\/([^/]+)\/engram\.json$/.exec(path)?.[1] ?? ''
      const own = extra[folder]
      if (own instanceof Error) {
        throw own
      }
      const text = own ?? packageFile(path)
      if (text === undefined) {
        throw new Error(`ENOENT: ${path}`)
      }
      return text
    },
  }
  return { disk: it, reads }
}

describe('the loader', () => {
  test('all three bundled packages load, with their defaults filled in', async () => {
    const { disk: d, reads } = disk()
    const { registry, skipped } = await loadEngrams(d, DIR)
    expect(skipped).toEqual([])
    expect([...registry.keys()]).toEqual(['kraken', 'lich', 'wisp'])
    for (const [id, json] of Object.entries(PACKAGES)) {
      expect(registry.get(id), id).toEqual(withDefaults(json))
    }
    // Manifests only: no thumbnail is read at start.
    expect(reads).toEqual(['kraken', 'lich', 'wisp'].map(id => `${DIR}/${id}/engram.json`))
  })

  test("a broken package is skipped with the validator's reason, and the rest load", async () => {
    const { disk: d } = disk({ broken: BROKEN })
    const { registry, skipped } = await loadEngrams(d, DIR)
    expect([...registry.keys()]).toEqual(['kraken', 'lich', 'wisp'])
    expect(skipped.length).toBe(1)
    expect(skipped[0]?.folder).toBe('broken')
    expect(skipped[0]?.issues).toEqual(validate({ folder: 'broken', files: { 'engram.json': BROKEN } }, { thumbnails: false }).errors)
    expect(skipped[0]?.issues.length).toBeGreaterThan(0)
    for (const issue of skipped[0]?.issues ?? []) {
      expect(issue.file).toBe('engram.json')
      expect(issue.problem.length).toBeGreaterThan(0)
      expect(issue.fix.length).toBeGreaterThan(0)
    }
  })

  test('a package whose engram.json does not parse, names another id, or cannot be read is skipped too', async () => {
    const renamed = JSON.stringify({ ...PACKAGES.lich, id: 'lich-2' })
    const { disk: d } = disk({ garbled: '{ "spec": 2,', moved: renamed, gone: new Error('EACCES: permission denied') })
    const { registry, skipped } = await loadEngrams(d, DIR)
    expect([...registry.keys()]).toEqual(['kraken', 'lich', 'wisp'])
    const why = Object.fromEntries(skipped.map(one => [one.folder, one.issues]))
    expect(Object.keys(why).sort()).toEqual(['garbled', 'gone', 'moved'])
    expect(why['garbled']?.[0]?.problem).toContain("doesn't parse as JSON")
    expect(why['moved']?.map(issue => issue.rule)).toContain('id')
    expect(why['gone']?.[0]?.problem).toContain('EACCES: permission denied')
  })

  test('an empty folder gives an empty registry, and nothing skipped', async () => {
    const empty: Disk = { list: async () => [], read: async () => { throw new Error('nothing to read') } }
    expect(await loadEngrams(empty, DIR)).toEqual({ registry: new Map(), skipped: [] })
  })

  test('folders starting with _ (and hidden ones) and loose files are passed over', async () => {
    const { disk: d, reads } = disk({ _template: BROKEN, '.cache': BROKEN }, ['README.md', 'engram.json'])
    const { registry, skipped } = await loadEngrams(d, DIR)
    expect([...registry.keys()]).toEqual(['kraken', 'lich', 'wisp'])
    expect(skipped).toEqual([])
    expect(reads.some(path => path.includes('_template') || path.includes('.cache'))).toBe(false)
    expect(isIgnored('_template')).toBe(true)
    expect(isIgnored('wisp')).toBe(false)
  })

  test('never throws: a folder that cannot be listed, or a disk that misbehaves, gives what it can', async () => {
    const unlisted = await loadEngrams({ list: async () => { throw new Error('ENOENT') }, read: async () => '' }, DIR)
    expect(unlisted.registry.size).toBe(0)
    expect(unlisted.skipped.length).toBe(1)
    expect(unlisted.skipped[0]?.issues[0]?.problem).toContain('ENOENT')

    const odd: Disk = {
      list: async () => [dirEntry('kraken'), { name: 'weird' } as FsEntry, dirEntry('wisp')],
      read: async path => {
        if (path.includes('wisp')) {
          throw 'not an Error'
        }
        return packageFile(path) ?? 'null'
      },
    }
    const out = await loadEngrams(odd, DIR)
    expect([...out.registry.keys()]).toEqual(['kraken'])
    expect(out.skipped.map(one => one.folder)).toEqual(['wisp'])
    expect(out.skipped[0]?.issues[0]?.problem).toContain('not an Error')
  })
})

describe('the loader in a session', () => {
  test('a package that fails validation is skipped, the session runs normally, and /eidola says why', async ($, on) => {
    const store = new Map<string, unknown>([['engram', 'lich']])
    on('fs.list', ($2, e) => {
      const entries = packageList(String(e.path))
      if (!entries) {
        throw new Error('no such folder')
      }
      return { value: [...entries, dirEntry('broken'), dirEntry('_template')] }
    })
    on('fs.read', ($2, e) => {
      const path = String(e.path).replace(/\\/g, '/')
      const text = path.endsWith('/engrams/broken/engram.json') ? BROKEN : packageFile(path)
      if (text === undefined) {
        throw new Error('no such file')
      }
      return { value: text }
    })
    on('store.get', ($2, e) => ({ value: store.get(e.key) }))
    on('store.set', ($2, e) => {
      store.set(e.key, e.value)
      return { value: undefined }
    })
    on('store.delete', ($2, e) => {
      store.delete(e.key)
      return { value: undefined }
    })
    on('ui.open', () => ({ value: { isPlaced: true as const } }))
    on('ui.close', () => ({ value: undefined }))
    on('ui.panes', () => ({ value: PLACED }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.status', () => ({ value: undefined }))
    on('clock.now', () => ({ value: NOW }))
    on('command.register', ($2, e) => ({ value: { command: e.name } }))
    on('session.start', ($2, e) => ({ cwd: e.cwd }))
    // A terminal session, so /engrams prints its list: on the desktop it opens a screen in the pane instead.
    on('session.surfaces', () => ({ value: ['terminal' as const] }))
    on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))

    await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
    const listed = (await $.command.run({ command: 'engrams', args: '', ...TYPED })).text ?? ''
    expect(listed.split('\n').map(line => line.split(':')[0])).toEqual(['wisp', 'kraken', 'lich (awake)'])
    expect((await $.command.run({ command: 'awaken', args: 'broken', ...TYPED })).text).toContain('No Engram called "broken"')
    expect((await $.command.run({ command: 'awaken', args: 'kraken', ...TYPED })).text).toBe('Kraken is awake.')

    const pane = await $.ui.mount({ plugin: 'eidola', surface: 'desktop', component: 'Pane', requestId: 'eidola', props: { title: 'Kraken', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} } })
    expect(await pane.find({ type: 'Client', key: 'kraken-live' })).toBeDefined()
    await pane.unmount()

    const report = (await $.command.run({ command: 'eidola', args: '', ...TYPED })).text ?? ''
    expect(report).toContain('Skipped Engram broken:')
    expect(report).toContain('engram.json: ')
    expect(report).not.toContain('_template')
  })
})
