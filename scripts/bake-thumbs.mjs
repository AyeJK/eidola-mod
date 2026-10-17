// Bakes the live Engrams' thumbnails: runs scripts/thumbs.bake.tsx in the
// engine's test runner (where the live drawings run as they do in a session),
// reads the stills it prints, and writes them under vessels/.
//
//   node scripts/bake-thumbs.mjs          bake them
//   node scripts/bake-thumbs.mjs --check  only check every Engram's thumbnails
//                                         exist and fit a desktop Svg's bound

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SVG_LIMIT = 131_072

/** Every thumbnail an Engram in hooks/engrams.ts names: vessels/<pack>/<file>. */
function named() {
  const source = readFileSync(join(root, 'hooks', 'engrams.ts'), 'utf8')
  const out = []
  // Each Engram's text runs from its pack to the next pack named.
  const packs = [...source.matchAll(/pack: '([^']+)'/g)]
  packs.forEach((m, i) => {
    const own = source.slice(m.index, packs[i + 1]?.index ?? source.length)
    const named = /thumbnails: \{([^}]*)\}/.exec(own)
    for (const t of named ? named[1].matchAll(/(pane|band): '([^']+)'/g) : []) {
      out.push(join('vessels', m[1], t[2]))
    }
  })
  return out
}

function check() {
  const files = named()
  let failed = false
  for (const file of files) {
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
    console.error('no thumbnails named in hooks/engrams.ts')
    failed = true
  }
  process.exit(failed ? 1 : 0)
}

function bake() {
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
    const { file, i, n, part } = JSON.parse(line.slice(at + 6))
    const got = parts.get(file) ?? { n, parts: [] }
    got.parts[i] = part
    parts.set(file, got)
  }
  if (!parts.size) {
    console.error('the bake printed no thumbnails:\n' + output)
    process.exit(1)
  }
  for (const [file, { n, parts: got }] of parts) {
    if (got.filter(p => p !== undefined).length !== n) {
      console.error(`incomplete: ${file}`)
      process.exit(1)
    }
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), got.join(''))
    const tick = /THUMB-TICK (\S+) (\d+)/g
    const at = [...output.matchAll(tick)].find(m => m[1] === file)?.[2]
    console.log(`wrote ${file} (${got.join('').length} chars, frame at tick ${at ?? '?'})`)
  }
}

if (process.argv.includes('--check')) {
  check()
} else {
  bake()
}
