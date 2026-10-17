// The Engram loader (Plan decision 7): lists the mod's engrams/ folder, reads
// each package's engram.json and nothing else, checks it with the one
// validator, and fills its defaults. A package that fails goes on the skipped
// list with the validator's file, problem and fix; the rest are the registry.
// Thumbnails are read later, on first use. It never throws.

import type { FsEntry } from 'claude-code'

import { withDefaults } from './engram-types'
import type { Engram, EngramJson } from './engram-types'
import { MANIFEST, validate } from './validate'
import type { Issue, ValidateOptions } from './validate'

/** The folder under the mod's root that holds the bundled packages. */
export const ENGRAMS_DIR = 'engrams'

/** What the loader reads through: `$.fs` in the mod, a stand-in in tests. */
export type Disk = {
  list: (path: string) => Promise<readonly FsEntry[]>
  read: (path: string) => Promise<string>
}

/** A package that didn't load: its folder's name, and why. */
export type Skipped = { folder: string; issues: Issue[] }

/** The registry, by id, in the folders' order (by name), and what was skipped. */
export type Loaded = { registry: Map<string, Engram>; skipped: Skipped[] }

/** A folder the loader passes over: `_template` and the like, and hidden ones. */
export function isIgnored(name: string): boolean {
  return name.startsWith('_') || name.startsWith('.')
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Loads every package under `dir`. Never throws: a folder that can't be
 * listed gives an empty registry and one skipped entry; a package that can't
 * be read or fails validation is skipped with its issues.
 */
export async function loadEngrams(disk: Disk, dir: string, options: ValidateOptions = {}): Promise<Loaded> {
  const registry = new Map<string, Engram>()
  const skipped: Skipped[] = []
  let entries: readonly FsEntry[]
  try {
    entries = await disk.list(dir)
  } catch (error) {
    skipped.push({
      folder: ENGRAMS_DIR,
      issues: [{ rule: 'manifest', file: `${ENGRAMS_DIR}/`, problem: `The Engrams folder couldn't be listed (${message(error)}).`, fix: 'Reinstall the mod: its engrams/ folder is missing or unreadable.' }],
    })
    return { registry, skipped }
  }
  try {
    const folders = entries
      .filter(entry => entry.kind === 'dir' && !isIgnored(entry.name))
      .map(entry => entry.name)
      .sort()
    for (const folder of folders) {
      const one = await loadOne(disk, `${dir}/${folder}`, folder, options)
      if ('issues' in one) {
        skipped.push(one)
      } else if (registry.has(one.id)) {
        // Folders differ only in case on a case-blind disk: the first stands.
        skipped.push({ folder, issues: [{ rule: 'id', file: MANIFEST, problem: `Another package already has the id ${one.id}.`, fix: 'Give this one its own id, and rename its folder to match.' }] })
      } else {
        registry.set(one.id, one)
      }
    }
  } catch (error) {
    // Nothing above should throw; if it does, keep what loaded.
    skipped.push({ folder: ENGRAMS_DIR, issues: [{ rule: 'manifest', file: `${ENGRAMS_DIR}/`, problem: `Loading stopped early (${message(error)}).`, fix: 'Run /engrams to load again.' }] })
  }
  return { registry, skipped }
}

/** One package: its Engram, or why it was skipped. */
async function loadOne(disk: Disk, path: string, folder: string, options: ValidateOptions): Promise<Engram | Skipped> {
  let text: string
  try {
    text = await disk.read(`${path}/${MANIFEST}`)
  } catch (error) {
    return {
      folder,
      issues: [{ rule: 'manifest', file: MANIFEST, problem: `engram.json couldn't be read (${message(error)}).`, fix: 'Add an engram.json at the top of the package folder, readable by Claude Code (docs/spec/engram-format.md).' }],
    }
  }
  const report = validate({ folder, files: { [MANIFEST]: text } }, { ...options, thumbnails: false })
  if (report.errors.length) {
    return { folder, issues: report.errors }
  }
  try {
    return withDefaults(JSON.parse(text.replace(/^﻿/, '')) as EngramJson)
  } catch (error) {
    return { folder, issues: [{ rule: 'manifest', file: MANIFEST, problem: `engram.json couldn't be loaded (${message(error)}).`, fix: 'Check it against docs/spec/engram-format.md.' }] }
  }
}
