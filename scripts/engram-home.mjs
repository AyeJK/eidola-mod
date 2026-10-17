// Your Engrams' home, for the Eidola skill (skills/eidola-engram/SKILL.md):
// every Engram you make lives in <home>/engrams/<id>/, an Engram plugin of its
// own (docs/spec/engram-plugin.md), and <home>/.claude-plugin/marketplace.json
// lists them all as the local marketplace `eidola-local`. Claude Code reads a
// plugin of a folder marketplace from the folder itself, so a change to an
// installed Engram shows after /reload-plugins, with no reinstall.
//
// It never writes inside Eidola's own folder: the home, and every Engram in
// it, must be outside it. It never overwrites an Engram: an id that is taken
// (bundled, already in the home, or an installed Engram plugin's) is refused.
//
//   node scripts/engram-home.mjs where
//       the home, its engrams/ folder and its marketplace file
//   node scripts/engram-home.mjs list
//       the Engrams in the home: id, name, what each was remixed from
//   node scripts/engram-home.mjs new <id> [--name <name>] [--author <author>] [--description <text>]
//       a new Engram from the starter (skills/eidola-engram/starter/)
//   node scripts/engram-home.mjs remix <from> <id> [--name <name>] [--author <author>] [--description <text>]
//       <from> a bundled Engram (kraken, lich, wisp): exported by
//              scripts/export-engram.mjs
//       <from> an Engram in the home, an installed Engram plugin's id, or
//              the path of an Engram plugin's folder: copied, its id changed
//              and remixOf set to <from>'s id
//   node scripts/engram-home.mjs check <id|folder>
//       the checker (scripts/check-engram.mjs) on an Engram in the home
//   node scripts/engram-home.mjs draws <id|folder>
//       writes test/draws.test.ts into the Engram and runs it with
//       `claude plugin test`: does it draw each mood, and the error effect?
//   node scripts/engram-home.mjs sync
//       writes the marketplace again from what is in engrams/
//   node scripts/engram-home.mjs publish-prep <id> --repo <owner>/<repo> [--author <author>]
//       readies an Engram for its own GitHub repo: the checker must pass;
//       writes its .claude-plugin/marketplace.json, an install section in its
//       README and a .gitignore, and prints the two commands others run to
//       install it. Runs no git and sends nothing anywhere.
//
// The home: --home <dir>, else $EIDOLA_HOME, else $EVAL_EIDOLA_HOME (an eval
// run's), else ~/.claude/eidola, which is said on stderr whenever it is taken
// (`where` names the source too). Inside an eval's workspace (a folder holding
// .eidola-eval, which each eval case's scaffold writes) the default is
// refused, and a relative home is read from that folder. A home inside
// Eidola's folder is refused, symlinks resolved (hooks/home-rules.ts holds
// these rules). Exits 1 on any refusal or checker error, 2 when used wrongly.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

import { bundledIds, checkFolder } from './check-engram.mjs'
import { importTs, root } from './ts.mjs'

/** The rules on where the scripts write: hooks/home-rules.ts, tested in the kit. */
const rules = await importTs('hooks/home-rules.ts')

const SLUG = /^[a-z0-9-]{2,32}$/
const MARKETPLACE = 'eidola-local'
const STARTER = join(root, 'skills', 'eidola-engram', 'starter')
/** Never copied from one Engram into another: git, packages, the engine's types. */
const SKIP = new Set(['.git', 'node_modules', '.mcpb-cache'])
/** Source files whose id is changed in a remix. */
const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/

const lf = text => text.replace(/\r\n/g, '\n')

class Refused extends Error {}

function refuse(message) {
  throw new Refused(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/** "glow-mote" as "Glow Mote". */
function titled(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 32)
}

/**
 * A path with its symlinks resolved: the longest part of it that exists,
 * through realpath, and the rest as given. A home that is a link into
 * Eidola's folder is caught this way.
 */
export function real(path) {
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

/** True when `child` is `parent` or inside it, symlinks resolved. */
function isInside(parent, child) {
  return rules.isInside(real(parent), real(child))
}

/** The folder holding an eval workspace's marker, from the working directory up; undefined outside one. */
function evalMarkerDir() {
  let at = process.cwd()
  for (;;) {
    if (existsSync(join(at, rules.EVAL_MARKER))) {
      return at
    }
    const up = dirname(at)
    if (up === at) {
      return undefined
    }
    at = up
  }
}

function parseArgs(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1]
      i += 1
    } else {
      rest.push(arg)
    }
  }
  return { flags, rest }
}

/**
 * The home and its parts, and where it came from (hooks/home-rules.ts,
 * chooseHome). The default is said on stderr, never taken silently, and is
 * refused inside an eval's workspace. Refused inside Eidola's folder,
 * symlinks resolved.
 */
function homeOf(flags) {
  const choice = rules.chooseHome({
    flag: flags.home,
    eidolaHome: process.env.EIDOLA_HOME,
    evalHome: process.env.EVAL_EIDOLA_HOME,
    defaultHome: join(homedir(), '.claude', 'eidola'),
    evalMarkerDir: evalMarkerDir(),
  })
  if (choice.refusal) {
    refuse(choice.refusal)
  }
  if (choice.notice) {
    console.error(choice.notice)
  }
  const home = real(choice.base ? resolve(choice.base, choice.home) : choice.home)
  const refusal = rules.homeRefusal(real(root), home)
  if (refusal) {
    refuse(refusal)
  }
  return { home, source: choice.source, engrams: join(home, 'engrams'), marketplace: join(home, '.claude-plugin', 'marketplace.json') }
}

/** Every Engram plugin folder in the home, by its id. */
function homeEngrams(paths) {
  const out = new Map()
  if (!existsSync(paths.engrams)) {
    return out
  }
  for (const entry of readdirSync(paths.engrams, { withFileTypes: true })) {
    const dir = join(paths.engrams, entry.name)
    if (!entry.isDirectory() || !existsSync(join(dir, 'engram.json'))) {
      continue
    }
    try {
      out.set(readJson(join(dir, 'engram.json')).id ?? entry.name, dir)
    } catch {
      out.set(entry.name, dir)
    }
  }
  return out
}

/**
 * Engram plugins installed in Claude Code, by id: every engram.json in the
 * plugin cache and the marketplaces' folders, a few levels down. Best effort:
 * a folder it can't read is passed over.
 */
function installedEngrams() {
  const out = new Map()
  const base = join(homedir(), '.claude', 'plugins')
  const walk = (dir, depth) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (entries.some(one => one.isFile() && one.name === 'engram.json') && existsSync(join(dir, '.claude-plugin', 'plugin.json'))) {
      try {
        const json = readJson(join(dir, 'engram.json'))
        if (json?.vessel?.scene === 'self' && typeof json.id === 'string' && !out.has(json.id)) {
          out.set(json.id, dir)
        }
      } catch {
        // Not readable: not ours to judge here.
      }
      return
    }
    if (depth === 0) {
      return
    }
    for (const one of entries) {
      if (one.isDirectory() && !SKIP.has(one.name) && !one.name.startsWith('.')) {
        walk(join(dir, one.name), depth - 1)
      }
    }
  }
  for (const sub of ['cache', 'marketplaces']) {
    walk(join(base, sub), 5)
  }
  return out
}

/** Refuses an id that isn't a slug or is taken; says by what. */
function claim(id, paths) {
  if (!id || !SLUG.test(id)) {
    refuse(`"${id ?? ''}" isn't an id: use 2 to 32 of a-z, 0-9 and -, such as "glow-mote".`)
  }
  const bundled = bundledIds()
  if (bundled.includes(id)) {
    refuse(`"${id}" is a bundled Engram's id (${bundled.join(', ')}). Pick a new one, such as "my-${id}".`)
  }
  if (id === 'starter') {
    refuse('"starter" is the starter\'s own id. Pick a name of your own.')
  }
  const mine = homeEngrams(paths)
  if (mine.has(id)) {
    refuse(`"${id}" is taken: ${mine.get(id)} already holds it. Nothing was overwritten. Pick another id, or change that Engram instead.`)
  }
  if (existsSync(join(paths.engrams, id))) {
    refuse(`${join(paths.engrams, id)} already exists. Nothing was overwritten. Pick another id.`)
  }
  const installed = installedEngrams()
  if (installed.has(id)) {
    refuse(`"${id}" is taken by an installed Engram plugin (${installed.get(id)}). Pick another id.`)
  }
}

/** Copies an Engram plugin's folder, leaving out git, packages and the engine's types. */
function copyPlugin(from, to) {
  cpSync(from, to, {
    recursive: true,
    filter: src => {
      const rel = relative(from, src).split(sep).join('/')
      return !rel.split('/').some(part => SKIP.has(part)) && rel !== '.claude-plugin/types' && !rel.startsWith('.claude-plugin/types/') && rel !== '.claude-plugin/marketplace.json'
    },
  })
}

/** Every source file under `dir`, by path. */
function sources(dir) {
  const out = []
  const walk = at => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && relative(dir, path).split(sep).join('/') !== '.claude-plugin/types') {
          walk(path)
        }
      } else if (SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(path)
      }
    }
  }
  walk(dir)
  return out
}

/** Points a copied Engram plugin's sources at its new id: its ID, its scene key and its slot key. */
function renameSources(dir, from, to) {
  const esc = from.replace(/[-]/g, '\\-')
  const changed = []
  for (const path of sources(dir)) {
    const text = readFileSync(path, 'utf8')
    const next = text
      .replace(new RegExp(`(\\bconst\\s+ID\\s*=\\s*)(['"])${esc}\\2`, 'g'), `$1$2${to}$2`)
      .replace(new RegExp(`(['"\`])(eidola(?:-slot|-fallback)?):${esc}\\1`, 'g'), `$1$2:${to}$1`)
    if (next !== text) {
      writeFileSync(path, next)
      changed.push(relative(dir, path).split(sep).join('/'))
    }
  }
  return changed
}

/** The Engram's plugin.json, named after its id and depending on Eidola. */
function rewriteManifest(dir, { id, name, author, from }) {
  const path = join(dir, '.claude-plugin', 'plugin.json')
  const old = existsSync(path) ? readJson(path) : {}
  const dependencies = Array.isArray(old.dependencies) ? old.dependencies : []
  const next = {
    ...old,
    name: id,
    version: '0.1.0',
    description: from ? `${name}, an Engram for Eidola, remixed from ${from}.` : `${name}, an Engram for Eidola.`,
    ...(author ? { author: { name: author } } : {}),
    dependencies: dependencies.some(one => one === 'eidola' || one?.name === 'eidola') ? dependencies : [...dependencies, 'eidola'],
  }
  delete next.repository
  delete next.homepage
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true })
  writeJson(path, next)
}

/** Writes the marketplace from what is in engrams/: one entry per Engram plugin, its source the folder. */
function sync(paths, flags = {}) {
  const plugins = []
  for (const [id, dir] of [...homeEngrams(paths)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let name = id
    let description
    try {
      const manifest = readJson(join(dir, '.claude-plugin', 'plugin.json'))
      name = typeof manifest.name === 'string' ? manifest.name : id
      description = typeof manifest.description === 'string' ? manifest.description : undefined
    } catch {
      // No manifest: the checker says so; listed under its id meanwhile.
    }
    plugins.push({ name, source: `./engrams/${basename(dir)}`, ...(description ? { description } : {}) })
  }
  const old = existsSync(paths.marketplace) ? readJson(paths.marketplace) : {}
  const owner = flags.author ? { name: flags.author } : (old.owner ?? { name: 'you' })
  mkdirSync(join(paths.home, '.claude-plugin'), { recursive: true })
  writeJson(paths.marketplace, {
    name: MARKETPLACE,
    owner,
    description: 'Your Engrams for Eidola, made with the Eidola skill. Read from this folder: change an Engram, then /reload-plugins.',
    plugins,
  })
  return plugins
}

/** The commands that install an Engram from the home, for the person (the skill runs them with their yes). */
function installLines(paths, id) {
  return [`claude plugin marketplace add "${paths.home}"   (once; skip if \`claude plugin marketplace list\` shows ${MARKETPLACE})`, `claude plugin install ${id}@${MARKETPLACE}`]
}

async function report(dir) {
  const { report, text } = await checkFolder(dir)
  console.log(text)
  return report.errors.length === 0
}

async function finish(paths, id, dir, what) {
  sync(paths)
  console.log(`${what}: ${dir}`)
  console.log(`listed in ${paths.marketplace} (${MARKETPLACE})`)
  const ok = await report(dir)
  console.log(`\nTo install it:\n${installLines(paths, id).map(line => `  ${line}`).join('\n')}\nthen /reload-plugins and /awaken ${id} in the session.`)
  return ok
}

async function create(paths, id, flags) {
  claim(id, paths)
  const dir = join(paths.engrams, id)
  const name = flags.name ?? titled(id)
  mkdirSync(paths.engrams, { recursive: true })
  copyPlugin(STARTER, dir)
  const engram = readJson(join(dir, 'engram.json'))
  writeJson(join(dir, 'engram.json'), {
    ...engram,
    id,
    name,
    author: flags.author ?? 'you',
    ...(flags.description ? { description: flags.description } : {}),
    rights: 'original',
  })
  rewriteManifest(dir, { id, name, author: flags.author })
  renameSources(dir, 'starter', id)
  const readme = join(dir, 'README.md')
  writeFileSync(readme, lf(readFileSync(readme, 'utf8')).replace(/^# Starter\n/, `# ${name}\n`).replace('a small mote of light', `${name}`))
  return finish(paths, id, dir, `made ${name} (${id}) from the starter`)
}

/** Where <from> is: a folder path, an Engram in the home, or an installed Engram plugin. */
function sourceOf(from, paths) {
  if (existsSync(from) && statSync(from).isDirectory()) {
    return resolve(from)
  }
  const mine = homeEngrams(paths)
  if (mine.has(from)) {
    return mine.get(from)
  }
  const installed = installedEngrams()
  if (installed.has(from)) {
    return installed.get(from)
  }
  refuse(`No Engram "${from}" to remix: it isn't bundled (${bundledIds().join(', ')}), in ${paths.engrams}, or an installed Engram plugin. Give the path of its folder instead.`)
}

async function remix(paths, from, id, flags) {
  if (!from) {
    refuse('Say what to remix: node scripts/engram-home.mjs remix <from> <id>.')
  }
  claim(id, paths)
  const dir = join(paths.engrams, id)
  const name = flags.name ?? titled(id)
  mkdirSync(paths.engrams, { recursive: true })
  if (bundledIds().includes(from)) {
    const args = [join(root, 'scripts', 'export-engram.mjs'), from, dir, '--id', id, '--name', name, ...(flags.author ? ['--author', flags.author] : [])]
    const run = spawnSync(process.execPath, args, { encoding: 'utf8' })
    process.stdout.write(run.stdout ?? '')
    process.stderr.write(run.stderr ?? '')
    if (!existsSync(join(dir, 'engram.json'))) {
      refuse(`The export of ${from} wrote nothing.`)
    }
    if (flags.description) {
      writeJson(join(dir, 'engram.json'), { ...readJson(join(dir, 'engram.json')), description: flags.description })
    }
    sync(paths)
    console.log(`\nlisted in ${paths.marketplace} (${MARKETPLACE})`)
    console.log(`\nTo install it:\n${installLines(paths, id).map(line => `  ${line}`).join('\n')}\nthen /reload-plugins and /awaken ${id} in the session.`)
    return run.status === 0
  }
  const source = sourceOf(from, paths)
  if (isInside(source, paths.home) || isInside(dir, source)) {
    refuse(`${source} holds the home, or the new Engram would land inside it: remix from a folder of its own.`)
  }
  const old = readJson(join(source, 'engram.json'))
  if (typeof old.id !== 'string') {
    refuse(`${join(source, 'engram.json')} has no id: run the checker on it first.`)
  }
  copyPlugin(source, dir)
  const next = {
    ...old,
    id,
    name,
    version: '0.1.0',
    ...(flags.author ? { author: flags.author } : {}),
    ...(flags.description ? { description: flags.description } : {}),
    // A remix of someone else's Engram: shared only where its licence lets you. The skill asks before publishing.
    rights: 'licensed',
    remixOf: old.id,
  }
  delete next.$schema
  writeJson(join(dir, 'engram.json'), next)
  rewriteManifest(dir, { id, name, author: flags.author, from: old.id })
  const changed = renameSources(dir, old.id, id)
  console.log(`copied ${source}; ${changed.length ? `pointed ${changed.join(', ')} at "${id}"` : `no source named "${old.id}" in a way this could change: the checker says where`}`)
  return finish(paths, id, dir, `remixed ${old.name ?? old.id} (${old.id}) as ${name} (${id})`)
}

function list(paths) {
  const mine = homeEngrams(paths)
  if (mine.size === 0) {
    console.log(`No Engrams in ${paths.engrams} yet.`)
    return true
  }
  for (const [id, dir] of mine) {
    try {
      const json = readJson(join(dir, 'engram.json'))
      console.log(`${id}: ${json.name ?? id}${json.remixOf ? `, remixed from ${json.remixOf}` : ''} (${dir})`)
    } catch {
      console.log(`${id}: engram.json doesn't parse (${dir})`)
    }
  }
  return true
}

function folderOf(arg, paths) {
  if (!arg) {
    refuse('Say which Engram: its id, or its folder.')
  }
  const mine = homeEngrams(paths)
  if (mine.has(arg)) {
    return mine.get(arg)
  }
  if (existsSync(arg) && statSync(arg).isDirectory()) {
    return resolve(arg)
  }
  refuse(`No Engram "${arg}" in ${paths.engrams}.`)
}

/** The band's rows Eidola hands an Engram plugin, by what it was remixed from (docs/spec/engram-plugin.md). */
const BAND_ROWS = { lich: 12, wisp: 9 }
const DRAWS_TEMPLATE = join(root, 'skills', 'eidola-engram', 'checks', 'draws.test.ts.txt')
const DRAWS_TEST = 'test/draws.test.ts'

/**
 * Writes the draw check into the Engram (test/draws.test.ts) and runs it with
 * `claude plugin test`: the drawing module, handed what Eidola hands it in
 * each place, surface and mood, must draw its Box, within the block limit,
 * each mood differently and the error effect over each.
 */
function draws(arg, paths) {
  const dir = folderOf(arg, paths)
  const engram = readJson(join(dir, 'engram.json'))
  const manifest = readJson(join(dir, '.claude-plugin', 'plugin.json'))
  const shows = Array.isArray(engram.vessel?.shows) ? engram.vessel.shows : ['pane', 'band']
  const places = ['pane', 'band'].filter(place => shows.includes(place))
  const text = readFileSync(DRAWS_TEMPLATE, 'utf8')
    .replace("'__ID__'", JSON.stringify(engram.id))
    .replace("'__PLUGIN__'", JSON.stringify(manifest.name))
    .replace('__PLACES__', JSON.stringify(places))
    .replace('__BAND_ROWS__', String(BAND_ROWS[engram.remixOf] ?? 7))
  mkdirSync(join(dir, 'test'), { recursive: true })
  writeFileSync(join(dir, ...DRAWS_TEST.split('/')), text)
  const run = spawnSync('claude', ['plugin', 'test', dir], { encoding: 'utf8', shell: process.platform === 'win32' })
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const lines = out.split(/\r?\n/).filter(line => /\(pass\)|\(fail\)|error|expect|pass$|fail$|Ran /i.test(line))
  console.log(lines.join('\n') || out)
  const ok = run.status === 0
  console.log(ok ? `${engram.id}: draws` : `${engram.id}: does not draw. Read the failures above; ${DRAWS_TEST} says what each check wants.`)
  return ok
}

const GITIGNORE = ['.claude-plugin/types/', 'node_modules/', '.mcpb-cache/', '.DS_Store', 'Thumbs.db', '*.log', '.env*', '']

async function publishPrep(paths, arg, flags) {
  const dir = folderOf(arg, paths)
  const repo = flags.repo
  if (!repo || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) {
    refuse('Say which GitHub repo, as --repo <owner>/<repo>, such as --repo octocat/glow-mote.')
  }
  if (!(await report(dir))) {
    refuse('The checker found errors: fix them before publishing. Nothing was written.')
  }
  const [owner, name] = repo.split('/')
  const manifest = readJson(join(dir, '.claude-plugin', 'plugin.json'))
  const engram = readJson(join(dir, 'engram.json'))
  const marketplace = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  writeJson(join(dir, '.claude-plugin', 'marketplace.json'), {
    name: marketplace,
    owner: { name: flags.author ?? owner },
    description: `${engram.name}, an Engram for Eidola.`,
    plugins: [{ name: manifest.name, source: './', description: engram.description }],
  })
  const lines = [`claude plugin marketplace add ${repo}`, `claude plugin install ${manifest.name}@${marketplace}`]
  const readme = join(dir, 'README.md')
  const text = existsSync(readme) ? lf(readFileSync(readme, 'utf8')) : `# ${engram.name}\n\n${engram.description}\n`
  const section = `## Install\n\nIt draws inside [Eidola](https://github.com/AyeJK/eidola-mod): install Eidola first (\`claude plugin install eidola --marketplace AyeJK/eidola-mod\`). Then, from a shell:\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n\nThen \`/reload-plugins\` and \`/awaken ${engram.id}\` in a session.\n`
  writeFileSync(readme, /\n## Install\n[\s\S]*?(?=\n## |$)/.test(text) ? text.replace(/\n## Install\n[\s\S]*?(?=\n## |$)/, `\n${section}`) : `${text.trimEnd()}\n\n${section}`)
  const ignore = join(dir, '.gitignore')
  const have = existsSync(ignore) ? lf(readFileSync(ignore, 'utf8')).split('\n') : []
  writeFileSync(ignore, [...new Set([...have.filter(Boolean), ...GITIGNORE.filter(Boolean)])].join('\n') + '\n')
  console.log(`\nready to publish ${engram.name} (${engram.id}) from ${dir} to github.com/${repo}`)
  console.log(`wrote .claude-plugin/marketplace.json (${marketplace}), README.md's install section, .gitignore`)
  console.log(`\nOthers install it with:\n${lines.map(line => `  ${line}`).join('\n')}`)
  return true
}

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2))
  const [command, a, b] = rest
  const paths = homeOf(flags)
  switch (command) {
    case 'where':
      console.log(`home: ${paths.home} (from ${paths.source === 'default' ? 'the default, ~/.claude/eidola' : paths.source})\nengrams: ${paths.engrams}\nmarketplace: ${paths.marketplace} (${MARKETPLACE})\neidola: ${root}`)
      return true
    case 'list':
      return list(paths)
    case 'new':
      return create(paths, a, flags)
    case 'remix':
      return remix(paths, a, b, flags)
    case 'check':
      return report(folderOf(a, paths))
    case 'draws':
      return draws(a, paths)
    case 'sync': {
      const plugins = sync(paths, flags)
      console.log(`wrote ${paths.marketplace}: ${plugins.length ? plugins.map(one => one.name).join(', ') : 'no Engrams yet'}`)
      return true
    }
    case 'publish-prep':
      return publishPrep(paths, a, flags)
    default:
      console.error('usage: node scripts/engram-home.mjs where | list | new <id> | remix <from> <id> | check <id> | draws <id> | sync | publish-prep <id> --repo <owner>/<repo>')
      process.exitCode = 2
      return undefined
  }
}

try {
  const ok = await main()
  if (ok === false) {
    process.exitCode = 1
  }
} catch (error) {
  if (error instanceof Refused) {
    console.error(error.message)
    process.exitCode = 1
  } else {
    throw error
  }
}

