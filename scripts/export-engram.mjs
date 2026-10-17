// Turns a bundled Engram into a standalone Engram plugin of its own
// (docs/spec/engram-plugin.md), under a new id: its plugin.json, its
// engram.json (vessel.scene "self", remixOf the bundled id), hooks that
// announce it and hand each drawing Eidola asks for to its drawing module
// (engrams/<id>/hooks/draw.tsx), that module and every file it draws with,
// copied beside it, and its thumbnails. Nothing in it reaches back into
// Eidola's folder: each copied file is the bundled one, its import paths and
// surface-module paths pointed at the copies, so the export draws exactly as
// the bundled Engram does. The checker (hooks/check-plugin.ts) runs over
// what it writes.
//
//   node scripts/export-engram.mjs <id> <folder> [--id <new-id>] [--name <name>] [--author <author>] [--force] [--fixture]
//       <id>      a bundled Engram: kraken, lich or wisp
//       <folder>  where the plugin goes; its name is the new id unless --id
//                 says otherwise (or it is no slug, or a bundled id: then
//                 <id>-remix)
//       --force   write into a folder that already holds files
//       --fixture write under the mod's own test/ (a committed fixture, such
//                 as test/fixtures/exported-lich); any other folder inside
//                 the mod is refused, and so is test/ without it
//   node scripts/export-engram.mjs --data   write hooks/exports.data.ts, the
//                 exported three and the 2.3 fixture as hooks/check.test.ts
//                 reads them (the test kit reads no disk)
//   node scripts/export-engram.mjs --check  check hooks/exports.data.ts and
//                 test/fixtures/exported-<id>/ (each bundled Engram) against
//                 a fresh export

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, posix, resolve } from 'node:path'

import { bundledIds, checkFolder, readPlugin } from './check-engram.mjs'
import { importTs, root } from './ts.mjs'

const SLUG = /^[a-z0-9-]{2,32}$/
/** A static import or re-export, on the line naming the file. */
const IMPORT = /^(\s*(?:(?:import|export)\b[^'"\n]*?\bfrom|\}\s*from|import)\s*)(['"])([^'"\n]+)\2/gm
/** A surface module a Client names. */
const CLIENT_MODULE = /(\bmodule\s*[=:]\s*\{?\s*)(['"])(\.{1,2}\/[^'"\n]+)\2/g
/** The files a drawing module's import may name, tried in order. */
const EXTENSIONS = ['', '.ts', '.tsx', '.d.ts', '/index.ts', '/index.d.ts']
/** Eidola's contract: copied, its public types alone, as hooks/eidola-types.ts. */
const CONTRACT = 'types/index.d.ts'
const CONTRACT_COPY = 'hooks/eidola-types.ts'
/** What the exported hooks import beside the drawing module: the faces drawn where no Client can run. */
const EXTRA_ROOTS = ['hooks/sprite.ts']
/** The committed exports hooks/export.test.ts loads: one of each bundled Engram. */
const FIXTURE_EXPORTS = ['kraken', 'lich', 'wisp'].map(id => ({ id, folder: `test/fixtures/exported-${id}` }))
const DATA = 'hooks/exports.data.ts'
const FIXTURE = 'test/fixtures/engram-plugin'

const lf = text => text.replace(/\r\n/g, '\n')

function fail(message) {
  console.error(message)
  process.exit(1)
}

/** "my-lich" as "My Lich". */
function titled(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 32)
}

/** The file `spec` names from `from` (both from the mod's folder), as the bundler finds it. */
function resolveSpec(from, spec) {
  const base = posix.normalize(posix.join(posix.dirname(from), spec))
  return EXTENSIONS.map(ext => base + ext).find(path => existsSync(join(root, path)) && statSync(join(root, path)).isFile())
}

/**
 * Every file a bundled Engram's drawing module draws with, from the mod's
 * folder: its imports, and the surface modules its Clients name, all the way
 * down. Each must be in hooks/ or the Engram's own hooks/.
 */
function closure(id) {
  const own = `engrams/${id}/hooks/`
  const start = [`${own}draw.tsx`, ...EXTRA_ROOTS]
  const seen = new Set()
  const queue = [...start]
  while (queue.length) {
    const file = queue.shift()
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    if (file === CONTRACT) {
      continue
    }
    if (!file.startsWith('hooks/') && !file.startsWith(own)) {
      fail(`${file} is outside hooks/ and ${own}: an Engram plugin can't take it with it.`)
    }
    const text = readFileSync(join(root, file), 'utf8')
    for (const [, , , spec] of text.matchAll(IMPORT)) {
      if (!spec.startsWith('.')) {
        continue
      }
      const found = resolveSpec(file, spec)
      if (!found) {
        fail(`${file} imports ${spec}, which isn't there.`)
      }
      queue.push(found)
    }
    for (const [, , , spec] of text.matchAll(CLIENT_MODULE)) {
      const found = posix.normalize(posix.join(posix.dirname(file), spec))
      if (!existsSync(join(root, found))) {
        fail(`${file} names the surface module ${spec}, which isn't there.`)
      }
      queue.push(found)
    }
  }
  return [...seen].sort()
}

/** Where a file of the mod lands in the plugin: everything beside the hooks, in hooks/. */
function landing(file) {
  return file === CONTRACT ? CONTRACT_COPY : `hooks/${posix.basename(file)}`
}

/** A file's text with each import and surface-module path pointed at the copy beside it. */
function repointed(file, text) {
  const to = (spec, keepExt) => {
    const found = keepExt ? posix.normalize(posix.join(posix.dirname(file), spec)) : resolveSpec(file, spec)
    const at = landing(found)
    const name = posix.basename(at)
    return `./${keepExt ? name : name.replace(/(\.d)?\.tsx?$/, '')}`
  }
  return text
    .replace(IMPORT, (match, lead, q, spec) => (spec.startsWith('.') ? `${lead}${q}${to(spec, false)}${q}` : match))
    .replace(CLIENT_MODULE, (match, lead, q, spec) => `${lead}${q}${to(spec, true)}${q}`)
}

/** Eidola's public types, as a module of the plugin's own: the contract's types, without what it declares on the engine. */
function contractCopy() {
  const text = lf(readFileSync(join(root, CONTRACT), 'utf8'))
  const body = text.slice(0, text.indexOf("\ndeclare module 'claude-code'")).replace(/^(\/\/.*\n)+\n*/, '')
  return `// Eidola's public types (contract 1), copied from the Eidola mod's
// types/index.d.ts by scripts/export-engram.mjs: what the drawing reads off
// the hand-off and Eidola's state. Types alone; $.eidola and Eidola's state
// are typed by the contract the engine lays into .claude-plugin/types/eidola/
// once this plugin loads beside Eidola.

${body.trimEnd()}
`
}

/** The plugin's hooks module: it announces the Engram, and hands each drawing Eidola asks for to draw.tsx. */
function registerSource({ id, name, base }) {
  return `// ${name}: an Engram plugin for Eidola, made from the bundled ${base.name} by
// Eidola's scripts/export-engram.mjs (contract 1, docs/spec/engram-plugin.md
// in the Eidola mod). This module announces the Engram, and hands each
// drawing Eidola asks for to hooks/draw.tsx, the ${base.name}'s own drawing
// module, copied here with everything it draws with: change the creature
// there and in the files beside it. Run Eidola's checker on the folder
// (node scripts/check-engram.mjs <folder>) before you share it.
//
// It writes none of Eidola's state and adds nothing to any prompt.

import type { Elements, EngineInterface, Register, RenderElement, RenderSurface } from 'claude-code'

import { draw } from './draw'
import type { DrawEls, DrawKit } from './drawing'
import type { EidolaHandoff, EidolaWhere, Mood } from './eidola-types'
import { FACES } from './sprite'

/** This Engram's id: engram.json's. */
const ID = '${id}'
/** Its name, for the drawing's alt text: engram.json's. */
const NAME = ${JSON.stringify(name)}
/** The Box its drawing comes back in, and the slot Eidola leaves for it. */
const SCENE = \`eidola:\${ID}\`
const SLOT = \`eidola-slot:\${ID}\`
/** Where a failure is reported from. */
const FILE = 'hooks/register.tsx'
/** How long the face shows the error effect after the ink rises, where no Client can run: in ms. */
const ERROR_MS = 2000

type Els = DrawEls & Pick<Elements['desktop'], 'Text'>

// The backdrop last built for the pane and for the band. Its loops are
// locked to the clock when it is built, so it is built again only when its
// size changes: a redraw for anything else keeps the running drawing.
const built = new Map<EidolaWhere, { key: string; svg: string }>()

function memoFor(where: EidolaWhere): DrawKit['memo'] {
  return (key, build) => {
    const last = built.get(where)
    if (last?.key === key) {
      return last.svg
    }
    const svg = build()
    built.set(where, { key, svg })
    return svg
  }
}

/** The creature, in one Box keyed eidola:<id>: live where a Client can run (the desktop), its face elsewhere (its error face while the ink is fresh). */
function creature(els: Els, surface: RenderSurface, handoff: EidolaHandoff, now: number): RenderElement {
  if (surface === 'desktop') {
    const tree = draw(els, handoff, { name: NAME, now, memo: memoFor(handoff.where) })
    return { ...(tree as object), props: { ...(tree as { props?: object }).props, key: SCENE } } as RenderElement
  }
  const { Box, Text } = els
  return (
    <Box key={SCENE} width={handoff.columns} height={handoff.rows}>
      <Text>{FACES[handoff.ink > 0 && now - handoff.inkAt < ERROR_MS ? 'error' : handoff.mood]}</Text>
    </Box>
  )
}

/** Eidola's tree with this Engram's slot, wherever it is, filled; anything else as it came. */
function fill(node: unknown, make: (columns: number, rows: number) => RenderElement): unknown {
  if (node === null || typeof node !== 'object') {
    return node
  }
  const element = node as { props?: { key?: unknown; width?: unknown; height?: unknown }; children?: unknown }
  if (element.props?.key === SLOT) {
    return make(Number(element.props.width) || 20, Number(element.props.height) || 5)
  }
  if (Array.isArray(element.children)) {
    return { ...element, children: element.children.map(child => fill(child, make)) }
  }
  return node
}

/** True when the tree holds this Engram's slot. */
function hasSlot(node: unknown): boolean {
  if (node === null || typeof node !== 'object') {
    return false
  }
  const element = node as { props?: { key?: unknown }; children?: unknown }
  return element.props?.key === SLOT || (Array.isArray(element.children) && element.children.some(hasSlot))
}

/** Tells Eidola the drawing failed, with the file and the stack's line: it draws the fallback and marks the Engram not loading. */
async function fault($: EngineInterface, error: unknown): Promise<void> {
  try {
    await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
  } catch {
    // Eidola isn't there to tell.
  }
}

/**
 * One drawing, the pane's or the band's. Beneath Eidola (this plugin loaded
 * after it), Eidola asks with the hand-off on e.props.eidola. Above it (this
 * plugin loaded first), Eidola's tree comes back from next with a slot to
 * fill, and the state is read from Eidola's.
 */
async function answer($: EngineInterface, where: EidolaWhere, surface: RenderSurface, els: Els, props: unknown, below: () => Promise<RenderElement>): Promise<RenderElement> {
  const handoff = (props as { eidola?: EidolaHandoff }).eidola
  if (handoff) {
    if (handoff.engram !== ID) {
      return below()
    }
    try {
      return creature(els, surface, handoff, await $.clock.now())
    } catch (error) {
      await fault($, error)
      return below()
    }
  }
  const tree = await below()
  if (!hasSlot(tree)) {
    return tree
  }
  const { value: mood = 'idle' as Mood } = await $.state.get({ plugin: 'eidola', key: 'mood' })
  const { value: moodBefore = 'idle' as Mood } = await $.state.get({ plugin: 'eidola', key: 'moodBefore' })
  const { value: moodAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'moodAt' })
  const { value: ink = 0 } = await $.state.get({ plugin: 'eidola', key: 'ink' })
  const { value: inkAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'inkAt' })
  const { value: epoch = 0 } = await $.state.get({ plugin: 'eidola', key: 'epoch' })
  const now = await $.clock.now()
  try {
    return fill(tree, (columns, rows) => creature(els, surface, { contract: 1, engram: ID, where, columns, rows, mood, moodBefore, moodAt, ink, inkAt, epoch }, now)) as RenderElement
  } catch (error) {
    await fault($, error)
    return tree
  }
}

export const register: Register = on => {
  // Announce: Eidola reads engram.json from this folder. Without Eidola there
  // is nobody to announce to, and nothing else changes.
  on('session.start', async ($, e, next) => {
    try {
      await $.eidola.announce({ root: $.plugin.root })
    } catch {
      // Eidola isn't installed: this plugin draws nothing.
    }
    return next(e)
  })

  // The pane and the band, one hook each, the same way.
  on('ui.render', { component: 'Pane', requestId: 'eidola' }, ($, e, next) => answer($, 'pane', e.surface, $.ui.resolve(e) as unknown as Els, e.props, () => next(e)))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => answer($, 'band', e.surface, $.ui.resolve(e) as unknown as Els, e.props, () => next(e)))
}
`
}

function readme({ id, name, base }) {
  return `# ${name}

An Engram for [Eidola](https://github.com/AyeJK/eidola-mod), made from the bundled ${base.name}: an Engram plugin (contract 1). Eidola keeps the frame, the HUD, the corner and the picker; this plugin draws the creature.

- \`engram.json\`: the Engram (\`id\` ${id}, \`vessel.scene\` "self", \`remixOf\` "${base.id}": while the drawing can't draw, Eidola draws the ${base.name} in its place).
- \`hooks/register.tsx\`: announces the Engram to Eidola and hands each drawing Eidola asks for to \`hooks/draw.tsx\`.
- \`hooks/draw.tsx\` and the files beside it: the ${base.name}'s drawing, copied whole. Change the creature here.
- \`vessel/\`: the picker's stills.

Before you share it, from the Eidola mod's folder:

\`\`\`
node scripts/check-engram.mjs <this folder>
claude plugin validate <this folder>
\`\`\`

To try it by hand, add the folder holding this one as a local marketplace, install it beside Eidola, and \`/awaken ${id}\`.
`
}

/** The plugin's files for bundled `baseId` under `id`, by path. */
function exportFiles(baseId, { id, name, author }) {
  const dir = join(root, 'engrams', baseId)
  const base = JSON.parse(readFileSync(join(dir, 'engram.json'), 'utf8').replace(/^﻿/, ''))
  const files = {}
  for (const file of closure(baseId)) {
    files[landing(file)] = file === CONTRACT ? contractCopy() : repointed(file, lf(readFileSync(join(root, file), 'utf8')))
  }
  if (files['hooks/register.tsx'] !== undefined) {
    fail(`engrams/${baseId}/hooks/draw.tsx draws with a file named register.tsx: rename it, since the plugin's hooks module takes that name.`)
  }
  const engram = {
    spec: 2,
    id,
    name,
    version: '0.1.0',
    author: author ?? base.author,
    description: base.description,
    // The bundled Engrams are the mod's, under its MIT licence: a remix may be shared.
    rights: 'licensed',
    remixOf: base.id,
    vessel: { ...base.vessel, scene: 'self' },
    extensions: base.extensions ?? {},
  }
  files['engram.json'] = `${JSON.stringify(engram, null, 2)}\n`
  files['.claude-plugin/plugin.json'] = `${JSON.stringify(
    { name: id, version: '0.1.0', description: `${name}, an Engram for Eidola, made from the bundled ${base.name}.`, author: { name: author ?? base.author }, dependencies: ['eidola'] },
    null,
    2,
  )}\n`
  files['hooks/hooks.json'] = '{ "modules": ["./register.tsx"] }\n'
  files['hooks/register.tsx'] = registerSource({ id, name, base })
  const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'))
  files['tsconfig.json'] = `${JSON.stringify({ compilerOptions: tsconfig.compilerOptions, include: ['.claude-plugin/types', 'hooks'] }, null, 2)}\n`
  files['README.md'] = readme({ id, name, base })
  for (const file of Object.values(base.vessel.thumbnails ?? {})) {
    files[`vessel/${file}`] = readFileSync(join(dir, 'vessel', file), 'utf8')
  }
  return files
}

function writeFiles(folder, files) {
  for (const [path, text] of Object.entries(files)) {
    const at = join(folder, ...path.split('/'))
    mkdirSync(dirname(at), { recursive: true })
    writeFileSync(at, text)
  }
}

/** The new id: --id, else the folder's name when it is a slug and not a bundled id, else <id>-remix. */
function newId(baseId, folder, flags, bundled) {
  const given = flags.id
  if (given !== undefined) {
    if (!SLUG.test(given)) {
      fail(`--id ${given} isn't an id: use 2 to 32 of a-z, 0-9 and -, such as "my-${baseId}".`)
    }
    if (bundled.includes(given)) {
      fail(`--id ${given} is a bundled Engram's id: pick a new one, such as "my-${baseId}".`)
    }
    return given
  }
  const name = basename(resolve(folder)).toLowerCase()
  return SLUG.test(name) && !bundled.includes(name) ? name : `${baseId}-remix`
}

/** A path with its symlinks resolved: the longest part that exists through realpath, the rest as given. */
function realOf(path) {
  const full = resolve(path)
  let at = full
  const rest = []
  while (!existsSync(at)) {
    const up = dirname(at)
    if (up === at) {
      return full
    }
    rest.unshift(basename(at))
    at = up
  }
  return join(realpathSync.native(at), ...rest)
}

function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--force' || arg === '--data' || arg === '--check' || arg === '--fixture') {
      flags[arg.slice(2)] = true
    } else if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1]
      i += 1
    } else {
      rest.push(arg)
    }
  }
  return { flags, rest }
}

/** Each bundled Engram exported fresh as exported-<id>, and the 2.3 fixture, as the checker reads them. */
async function freshData() {
  const { scannedLines } = await importTs('hooks/check-plugin.ts')
  const plugins = {}
  const reports = []
  const tmp = mkdtempSync(join(tmpdir(), 'eidola-export-'))
  try {
    const entries = bundledIds().map(baseId => [`exported-${baseId}`, baseId])
    for (const [key, baseId] of entries) {
      const folder = join(tmp, key)
      writeFiles(folder, exportFiles(baseId, { id: key, name: titled(key) }))
      reports.push(await checkFolder(folder))
      plugins[key] = readPlugin(folder)
    }
    plugins['fixture'] = readPlugin(join(root, FIXTURE))
    reports.push(await checkFolder(join(root, FIXTURE)))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  for (const { report, text } of reports) {
    if (report.errors.length) {
      fail(text)
    }
  }
  // Each plugin as the checker reads it: its hooks module and manifests whole; every other source file the lines the checker reads; each thumbnail a stand-in still.
  const out = {}
  for (const [key, files] of Object.entries(plugins)) {
    const hooks = JSON.parse(files['hooks/hooks.json']).modules.map(one => posix.normalize(`hooks/${one}`))
    out[key] = Object.fromEntries(
      Object.entries(files)
        .filter(([path]) => path !== 'README.md' && path !== 'tsconfig.json')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([path, text]) => [
          path,
          path.endsWith('.svg') ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><title>${key}/${path}</title></svg>` : /\.(tsx?|jsx?|mjs)$/.test(path) && !hooks.includes(path) ? scannedLines(lf(text)) : lf(text),
        ]),
    )
  }
  // The checker reads the same in what the data holds as in the folder.
  const { checkEngramPlugin } = await importTs('hooks/check-plugin.ts')
  for (const [key, files] of Object.entries(plugins)) {
    const findings = report => JSON.stringify({ errors: report.errors, warnings: report.warnings })
    const bundled = bundledIds()
    if (findings(checkEngramPlugin({ folder: key, files: out[key] }, { bundled })) !== findings(checkEngramPlugin({ folder: key, files }, { bundled }))) {
      fail(`the checker reads ${key} differently in the data than in its folder: hooks/check-plugin.ts's scannedLines misses a line it checks`)
    }
  }
  return `// The exported three (node scripts/export-engram.mjs <id> exported-<id>) and
// the 2.3 test plugin (test/fixtures/engram-plugin), as hooks/check.test.ts
// hands them to the checker: the test kit reads no disk. Each plugin's
// manifests and hooks module are whole; every other source file is the
// lines the checker reads in it (scannedLines in hooks/check-plugin.ts), so
// its report is the same as on the folder; each thumbnail is a stand-in
// still (hooks/validate.test.ts tests the thumbnail rules).
//
// Written by \`node scripts/export-engram.mjs --data\`. \`--check\` fails when it
// differs from a fresh export: after changing a bundled Engram's drawing, or
// the export, write it again.

export const PLUGINS: Readonly<Record<string, Readonly<Record<string, string>>>> = ${JSON.stringify(out, null, 2)}
`
}

async function writeData() {
  writeFileSync(join(root, DATA), await freshData())
  console.log(`wrote ${DATA}`)
}

/** Compares the committed exports and the data with a fresh export: the bundled files they copy may have changed. */
async function check() {
  const problems = []
  const stale = []
  for (const fixture of FIXTURE_EXPORTS) {
    const want = exportFiles(fixture.id, { id: basename(fixture.folder), name: titled(basename(fixture.folder)) })
    const dir = join(root, fixture.folder)
    const have = existsSync(dir) ? readPlugin(dir) : {}
    const before = problems.length
    for (const path of new Set([...Object.keys(want), ...Object.keys(have)])) {
      if (want[path] === undefined) {
        problems.push(`${fixture.folder}/${path} isn't in a fresh export`)
      } else if (have[path] === undefined) {
        problems.push(`${fixture.folder}/${path} is missing`)
      } else if (lf(have[path]) !== lf(want[path])) {
        problems.push(`${fixture.folder}/${path} differs from a fresh export`)
      }
    }
    if (problems.length > before) {
      stale.push(`node scripts/export-engram.mjs ${fixture.id} ${fixture.folder} --fixture --force`)
    }
  }
  const data = existsSync(join(root, DATA)) ? lf(readFileSync(join(root, DATA), 'utf8')) : ''
  if (data !== (await freshData())) {
    problems.push(`${DATA} differs from a fresh export`)
  }
  if (problems.length) {
    console.error(problems.join('\n'))
    console.error(`Export again: ${[...stale, 'node scripts/export-engram.mjs --data'].join(' && ')}`)
    process.exitCode = 1
  } else {
    console.log(`ok: ${FIXTURE_EXPORTS.map(fixture => fixture.folder).join(', ')}, ${DATA}`)
  }
}

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2))
  if (flags.data) {
    return writeData()
  }
  if (flags.check) {
    return check()
  }
  const [baseId, folder] = rest
  const bundled = bundledIds()
  if (!baseId || !folder) {
    fail(`usage: node scripts/export-engram.mjs <id> <folder> [--id <new-id>] [--name <name>] [--author <author>] [--force] [--fixture]\nbundled: ${bundled.join(', ')}`)
  }
  if (!bundled.includes(baseId) || !existsSync(join(root, 'engrams', baseId, 'hooks', 'draw.tsx'))) {
    fail(`${baseId} isn't a bundled Engram with a drawing module. Bundled: ${bundled.join(', ')}.`)
  }
  const dir = resolve(folder)
  if (existsSync(dir) && readdirSync(dir).length && !flags.force) {
    fail(`${folder} already holds files. Pick an empty or new folder, or pass --force to write over the files the export writes.`)
  }
  // Never inside Eidola's folder, symlinks resolved; under its test/ only for a fixture, asked for with --fixture.
  const { exportRefusal } = await importTs('hooks/home-rules.ts')
  const refusal = exportRefusal(realOf(root), realOf(dir), flags.fixture === true)
  if (refusal) {
    fail(refusal)
  }
  const id = newId(baseId, folder, flags, bundled)
  const name = flags.name ?? titled(id)
  writeFiles(dir, exportFiles(baseId, { id, name, author: flags.author }))
  console.log(`wrote ${folder}: ${name} (${id}), an Engram plugin made from the bundled ${baseId}`)
  const { report, text } = await checkFolder(dir)
  console.log(text)
  if (report.errors.length) {
    process.exitCode = 1
    return
  }
  console.log(`\nNext: claude plugin validate ${folder}`)
}

await main()
