// Bakes the live Engrams' thumbnails: runs scripts/thumbs.bake.tsx in the
// engine's test runner (where the live drawings run as they do in a session),
// reads the stills it prints, one per `<engram id>/<view>`, and writes each to
// the file that Engram's engram.json names for that view, in
// engrams/<id>/vessel/.
//
//   node scripts/bake-thumbs.mjs          bake them
//   node scripts/bake-thumbs.mjs --check  only check every thumbnail an
//                                         engram.json names exists and fits a
//                                         desktop Svg's bound, that no
//                                         per-state frame is left, and that
//                                         the tests' copy of each manifest
//                                         (hooks/packages.data.ts) matches it

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

// Node warns that the .ts file's module type is unset; it is ESM, and says so by its syntax.
process.removeAllListeners('warning')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENGRAMS = 'engrams'
const SVG_LIMIT = 131_072
/** The resolver's states: a file named for one in a package's vessel/ is a v1 frame, gone in v2. */
const STATES = ['idle', 'thinking', 'working', 'attention', 'success', 'responding', 'error', 'waiting', 'sleeping']

/** Every bundled package, as the loader finds them: engrams/<id>/, but `_` and `.` folders. */
function packages() {
  const dir = join(root, ENGRAMS)
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter(one => one.isDirectory() && !one.name.startsWith('_') && !one.name.startsWith('.'))
    .map(one => one.name)
    .sort()
    .map(folder => {
      const path = join(ENGRAMS, folder, 'engram.json')
      let json
      try {
        json = JSON.parse(readFileSync(join(root, path), 'utf8').replace(/^﻿/, ''))
      } catch (error) {
        return { folder, path, error: error instanceof Error ? error.message : String(error) }
      }
      return { folder, path, json }
    })
}

/** Every thumbnail an engram.json names: `<id>/<view>` and its file, engrams/<id>/vessel/<file>. */
function named(found = packages()) {
  const out = []
  for (const { folder, json } of found) {
    const thumbnails = json?.vessel?.thumbnails ?? {}
    for (const [view, file] of Object.entries(thumbnails)) {
      out.push({ shot: `${folder}/${view}`, file: join(ENGRAMS, folder, 'vessel', String(file)) })
    }
  }
  return out
}

/** Every per-state frame left in a package's vessel/. */
function frames() {
  return packages().flatMap(({ folder }) => {
    const dir = join(root, ENGRAMS, folder, 'vessel')
    if (!existsSync(dir)) {
      return []
    }
    return readdirSync(dir)
      .filter(file => /\.svg$/i.test(file) && STATES.includes(file.replace(/\.svg$/i, '').toLowerCase()))
      .map(file => join(ENGRAMS, folder, 'vessel', file))
  })
}

/** The tests serve hooks/packages.data.ts in place of the disk: it must be the packages exactly. */
async function fixtureDrift(found) {
  const { PACKAGES } = await import(pathToFileURL(join(root, 'hooks', 'packages.data.ts')).href)
  const problems = []
  const onDisk = found.filter(one => one.json).map(one => one.folder)
  for (const id of new Set([...onDisk, ...Object.keys(PACKAGES)])) {
    const disk = found.find(one => one.folder === id)?.json
    if (!disk) {
      problems.push(`hooks/packages.data.ts has ${id}, which isn't a package in ${ENGRAMS}/`)
    } else if (!PACKAGES[id]) {
      problems.push(`hooks/packages.data.ts is missing ${id}`)
    } else if (!isDeepStrictEqual(disk, PACKAGES[id])) {
      problems.push(`hooks/packages.data.ts's ${id} differs from ${ENGRAMS}/${id}/engram.json`)
    }
  }
  return problems
}

async function check() {
  const found = packages()
  const files = named(found)
  let failed = false
  for (const { path, error } of found) {
    if (error) {
      console.error(`unreadable: ${path} (${error})`)
      failed = true
    }
  }
  for (const { file } of files) {
    const path = join(root, file)
    if (!existsSync(path)) {
      console.error(`missing: ${file}`)
      failed = true
    } else if (statSync(path).size >= SVG_LIMIT) {
      console.error(`too large: ${file} (${statSync(path).size} of ${SVG_LIMIT})`)
      failed = true
    } else {
      console.log(`ok: ${file} (${statSync(path).size})`)
    }
  }
  if (!files.length) {
    console.error(`no thumbnails named in ${ENGRAMS}/*/engram.json`)
    failed = true
  }
  for (const file of frames()) {
    console.error(`a frame, gone in v2: ${file}`)
    failed = true
  }
  for (const problem of await fixtureDrift(found)) {
    console.error(problem)
    failed = true
  }
  // exitCode, not exit(): exiting at once after the import above trips a libuv assertion on Windows.
  process.exitCode = failed ? 1 : 0
}

function bake() {
  const files = new Map(named().map(one => [one.shot, one.file]))
  // The runner runs a plugin folder's tests, so the bake joins the mod's own
  // for one run, its imports rewritten for hooks/, and leaves again.
  const run = join(root, 'hooks', 'zz-bake-thumbs.test.tsx')
  writeFileSync(run, readFileSync(join(root, 'scripts', 'thumbs.bake.tsx'), 'utf8').replaceAll("'../../hooks/", "'./"))
  // A test's console lines reach stderr, its results stdout: read both.
  let result
  try {
    result = spawnSync('claude', ['plugin', 'test', '.'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' })
  } finally {
    rmSync(run, { force: true })
  }
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  if (result.status !== 0) {
    console.error(output.split(/\r?\n/).filter(line => !line.includes('THUMB ')).join('\n'))
    process.exit(1)
  }
  const parts = new Map()
  for (const line of output.split(/\r?\n/)) {
    const at = line.indexOf('THUMB ')
    if (at < 0) {
      continue
    }
    const { shot, i, n, part } = JSON.parse(line.slice(at + 6))
    const got = parts.get(shot) ?? { n, parts: [] }
    got.parts[i] = part
    parts.set(shot, got)
  }
  if (!parts.size) {
    console.error('the bake printed no thumbnails:\n' + output)
    process.exit(1)
  }
  for (const [shot, { n, parts: got }] of parts) {
    if (got.filter(p => p !== undefined).length !== n) {
      console.error(`incomplete: ${shot}`)
      process.exit(1)
    }
    const [id, view] = shot.split('/')
    const file = files.get(shot)
    if (!file) {
      console.error(`skipped ${shot}: ${ENGRAMS}/${id}/engram.json names no ${view} thumbnail`)
      process.exitCode = 1
      continue
    }
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), got.join(''))
    const tick = /THUMB-TICK (\S+) (\d+)/g
    const at = [...output.matchAll(tick)].find(m => m[1] === shot)?.[2]
    console.log(`wrote ${file} (${got.join('').length} chars, frame at tick ${at ?? '?'})`)
  }
}

if (process.argv.includes('--check')) {
  await check()
} else {
  bake()
}
