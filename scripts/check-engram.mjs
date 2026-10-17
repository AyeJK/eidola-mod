// Checks an Engram plugin's folder against contract 1
// (docs/spec/engram-plugin.md) and prints ok, or each problem with its file
// and its fix, then any warnings. engram.json goes through the one validator,
// hooks/validate.ts, by way of hooks/check-plugin.ts (Plan decision 8): the
// checker, the loader and $.eidola.announce read it the same way.
//
//   node scripts/check-engram.mjs <folder> [<folder> ...]
//
// Exits 1 when any folder has an error, 2 when it is used wrongly. Node
// reads the hooks' TypeScript as it is (type stripping, Node 22.18 or later).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'

import { importTs, root } from './ts.mjs'

/** Read as text; any other file is listed with no text. */
const TEXT = /\.(json|tsx?|jsx?|mjs|cjs|svg|md|txt|ya?ml|css|html?)$/i
/** Folders the checker never reads: the engine's types, a package cache, git. */
const SKIP = new Set(['.git', 'node_modules', '.mcpb-cache'])
/** A text file past this is listed with no text: nothing in a plugin is near it. */
const MAX_TEXT = 4 * 1024 * 1024

/** Every file under `dir`, by its path from there (forward slashes), each text file's text. */
export function readPlugin(dir) {
  const files = {}
  const walk = at => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name)
      const rel = relative(dir, path).split(sep).join('/')
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && rel !== '.claude-plugin/types') {
          walk(path)
        }
      } else if (entry.isFile()) {
        files[rel] = TEXT.test(entry.name) && statSync(path).size <= MAX_TEXT ? readFileSync(path, 'utf8') : ''
      }
    }
  }
  walk(dir)
  return files
}

/** The bundled Engrams' ids: an Engram plugin may not take one. */
export function bundledIds() {
  const dir = join(root, 'engrams')
  return readdirSync(dir, { withFileTypes: true })
    .filter(one => one.isDirectory() && !one.name.startsWith('_') && !one.name.startsWith('.') && existsSync(join(dir, one.name, 'engram.json')))
    .map(one => {
      try {
        return JSON.parse(readFileSync(join(dir, one.name, 'engram.json'), 'utf8').replace(/^﻿/, '')).id ?? one.name
      } catch {
        return one.name
      }
    })
    .sort()
}

/** Checks one folder: the report, and the text the checker prints for it. */
export async function checkFolder(folder) {
  const { checkEngramPlugin, formatReport } = await importTs('hooks/check-plugin.ts')
  const dir = resolve(folder)
  const report = checkEngramPlugin({ folder: basename(dir), files: readPlugin(dir) }, { bundled: bundledIds() })
  return { report, text: formatReport(report, report.id ?? basename(dir)) }
}

async function main() {
  const folders = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
  if (folders.length === 0) {
    console.error('usage: node scripts/check-engram.mjs <folder> [<folder> ...]')
    process.exitCode = 2
    return
  }
  let failed = false
  for (const folder of folders) {
    if (!existsSync(folder) || !statSync(folder).isDirectory()) {
      console.error(`${folder}: no such folder. Point the checker at an Engram plugin's folder, the one holding engram.json.`)
      failed = true
      continue
    }
    const { report, text } = await checkFolder(folder)
    console.log(text)
    failed ||= report.errors.length > 0
  }
  process.exitCode = failed ? 1 : 0
}

// Run as a script, not when export-engram.mjs imports it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(join(root, 'scripts', 'check-engram.mjs'))) {
  await main()
}
