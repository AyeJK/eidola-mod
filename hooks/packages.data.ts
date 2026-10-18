// The bundled packages as the tests' engine serves them. The test kit reads
// no disk, so a test that starts a session (or awakens, or draws) answers the
// loader's `fs.list` of engrams/ and its `fs.read` of each engram.json from
// here. Each manifest is engrams/<id>/engram.json exactly:
// `node scripts/bake-thumbs.mjs --check` fails when they differ.

import type { FsEntry, On } from 'claude-code'

import type { EngramJson } from './engram-types'

export const PACKAGES: Record<'kraken' | 'lich' | 'wisp', EngramJson> = {
  kraken: {
    spec: 2,
    id: 'kraken',
    name: 'Kraken',
    version: '1.0.0',
    author: 'eidola',
    description: 'Something vast in the deep water beside your work. It surfaces when there is work to do.',
    rights: 'original',
    vessel: {
      scene: 'kraken',
      shows: ['pane', 'shrine'],
      thumbnails: { pane: 'thumb-pane.svg' },
      hud: {
        show: true,
        meter: 'none',
        tag: 'livecam',
        camera: 'DEEPCAM 02',
        bracket: '#3c9aa6',
        colours: {
          idle: { label: '#5ff6ff', detail: '#3c9aa6' },
          waiting: { label: '#4fd8e8', detail: '#3a8e98' },
          success: { label: '#8ff0f6', detail: '#4fa8b0' },
          sleeping: { label: '#2f7f8a', detail: '#255f68' },
          thinking: { label: '#ff7466', detail: '#b8453c' },
          working: { label: '#ff3a40', detail: '#b8282c' },
          responding: { label: '#ff9a80', detail: '#c0604c' },
          error: { label: '#ff1f2e', detail: '#a8141e' },
          attention: { label: '#ffcf3a', detail: '#c49a2a' },
        },
      },
    },
    extensions: {},
  },
  lich: {
    spec: 2,
    id: 'lich',
    name: 'Lich',
    version: '1.0.0',
    author: 'eidola',
    description: 'A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.',
    rights: 'original',
    vessel: {
      scene: 'lich',
      shows: ['pane', 'shrine'],
      thumbnails: { pane: 'thumb-pane.svg' },
      hud: {
        show: true,
        meter: 'sparks',
        tag: 'sigil',
        label: 'serif',
        bracket: '#9a3c28',
        colours: {
          idle: { label: '#e0603e', detail: '#9a3c28' },
          waiting: { label: '#d0583a', detail: '#8a3424' },
          success: { label: '#f08a5a', detail: '#a85a38' },
          sleeping: { label: '#8a3424', detail: '#5e2418' },
          thinking: { label: '#c08aff', detail: '#7a4ab8' },
          working: { label: '#a860f0', detail: '#6c34a8' },
          responding: { label: '#d4a8ff', detail: '#8a5cc0' },
          error: { label: '#e0603e', detail: '#9a3c28' },
          attention: { label: '#3ccf8a', detail: '#22905e' },
        },
      },
    },
    extensions: {},
  },
  wisp: {
    spec: 2,
    id: 'wisp',
    name: 'Wisp',
    version: '1.0.0',
    author: 'eidola',
    description: "A will-o'-the-wisp in a night fen. It flies where it likes, its ghost fire burning the colour of your work, and speaks in flickers.",
    rights: 'original',
    vessel: {
      scene: 'wisp',
      shows: ['band'],
      thumbnails: { band: 'thumb-band.svg' },
      hud: {
        show: true,
        meter: 'none',
        tag: 'none',
        layout: 'bottom',
        label: 'pixel',
        bracket: '#6f62d8',
        colours: {
          idle: { label: '#eeeefa', detail: '#a0a0b8' },
          waiting: { label: '#d4d4e6', detail: '#8a8aa2' },
          sleeping: { label: '#7a7a94', detail: '#56566e' },
          thinking: { label: '#5fe8c0', detail: '#3aa688' },
          working: { label: '#6af0c8', detail: '#3fae8c' },
          responding: { label: '#5fe8c0', detail: '#3aa688' },
          success: { label: '#eeeefa', detail: '#a0a0b8' },
          error: { label: '#ff5a6e', detail: '#c0465a' },
          attention: { label: '#ffe066', detail: '#c8a83a' },
        },
      },
    },
    extensions: {},
  },
}

/** A folder as `$.fs.list` gives it. */
export function dirEntry(name: string): FsEntry {
  return { name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false }
}

/** A file as `$.fs.list` gives it. */
export function fileEntry(name: string, size = 0): FsEntry {
  return { name, kind: 'file', size, mtimeMs: 0, isLink: false }
}

/** The mod's engrams/ folder listed, for any path that ends in it; else undefined. */
export function packageList(path: string): FsEntry[] | undefined {
  return /(^|[\\/])engrams[\\/]*$/.test(path) ? Object.keys(PACKAGES).map(dirEntry) : undefined
}

/** A bundled package's engram.json text, for any path that ends in engrams/<id>/engram.json; else undefined. */
export function packageFile(path: string): string | undefined {
  const id = /(?:^|[\\/])engrams[\\/]+([^\\/]+)[\\/]+engram\.json$/.exec(path)?.[1]
  const json = id !== undefined && Object.hasOwn(PACKAGES, id) ? PACKAGES[id as keyof typeof PACKAGES] : undefined
  return json ? `${JSON.stringify(json, null, 2)}\n` : undefined
}

/**
 * Serves the bundled packages to the loader: the engrams/ listing and each
 * engram.json. A test hooks each event once, so any other file it reads is
 * answered by `otherRead` (which throws to refuse one); without it, every
 * other list or read passes on to the kit, which refuses it.
 */
export function servePackages(on: On, otherRead?: (path: string) => string): void {
  on('fs.list', ($, e, next) => {
    const entries = packageList(String(e.path))
    return entries ? { value: entries } : next(e)
  })
  on('fs.read', ($, e, next) => {
    const path = String(e.path)
    const text = packageFile(path)
    if (text !== undefined) {
      return { value: text }
    }
    return otherRead ? { value: otherRead(path) } : next(e)
  })
}
