// The Engram plugin checker (docs/spec/engram-plugin.md; Plan decision 8):
// checks an Engram plugin's folder against contract 1 and says, for every
// problem, the file and the fix. engram.json goes through the one validator
// (hooks/validate.ts), so the checker, the loader and `$.eidola.announce` can
// never disagree on it; the rest is the contract's: the plugin's manifest,
// the announce call, the drawing module and its surface modules, and that
// nothing reaches outside the folder.
//
// Pure, as validate.ts is: it takes the plugin's files as given, reads
// nothing, imports nothing from 'claude-code', and never throws.
// scripts/check-engram.mjs reads a folder and prints its report;
// scripts/export-engram.mjs checks each plugin it writes; hooks/check.test.ts
// tests it. Node runs it as it is (type stripping), so it holds no syntax
// that has to be compiled away.

import { SCENE_IDS, SELF_SCENE, SHOW_PLACES, THUMB_VIEWS } from './engram-types'
import { MANIFEST, THUMBNAIL_MAX, validate } from './validate'

/** The plugin's manifest, where Claude Code reads it. */
export const PLUGIN_MANIFEST = '.claude-plugin/plugin.json'
/** The hooks manifest, naming the hooks modules. */
export const HOOKS_MANIFEST = 'hooks/hooks.json'
/** Eidola's plugin name: an Engram plugin depends on it. */
export const EIDOLA = 'eidola'

/** An Engram plugin as the checker sees it: its folder's name, and its files by path inside it, each file's text. */
export type PluginFiles = { folder: string; files: Readonly<Record<string, string>> }

export type CheckOptions = {
  /** The ids an Engram plugin may not take: the bundled Engrams'. */
  bundled?: readonly string[]
}

/** One problem: the file it is in, what is wrong, and how to fix it. */
export type Finding = { file: string; problem: string; fix: string }

/**
 * The checker's report: the Engram's id (null when engram.json gives none),
 * every error (Eidola won't take it, or it can't draw), every warning (it
 * loads; something is missing or ignored), and what it found, for the
 * printed summary.
 */
export type PluginReport = { id: string | null; errors: Finding[]; warnings: Finding[]; notes: string[] }

// ── What the checker reads in a source file ──────────────────────────────

/** A static import or re-export, on the line that names the file: `import { a } from './x'`, `} from './x'`, `import './x'`. */
const IMPORT_LINE = /^\s*(?:(?:import|export)\b[^'"\n]*?\bfrom|\}\s*from|import)\s*(['"])([^'"\n]+)\1/
const IMPORT = new RegExp(IMPORT_LINE.source, 'gm')
/** A surface module a Client names: `module="./x.tsx"`, `module={'./x.tsx'}` or `module: './x.tsx'`. */
const CLIENT_MODULE = /\bmodule\s*[=:]\s*\{?\s*(['"])(\.{1,2}\/[^'"\n]+)\1/g
/** What a surface module draws with: its default export, else its one PascalCase export. */
const SURFACE_EXPORT = /^\s*export\s+(default\b|(const|function|let|class)\s+[A-Z])/m
/** Hooks that add to the prompt. */
const PROMPT_HOOK = /\bon\(\s*['"](prompt\.submit|prompt\.compose|prompt\.context)['"]/
/** A row added to the session's transcript, which the model reads. */
const SESSION_APPEND = /\$\.session\.append\b/
/** A hook on state.set, which could change Eidola's state on its way. */
const STATE_HOOK = /\bon\(\s*['"]state\.set['"]/
/** A write to Eidola's state. */
const EIDOLA_WRITE = /\$\.state\.set\(\s*\{[^}\n]*\bplugin\s*:\s*['"]eidola['"]/

/**
 * Every line pattern the checker reads in a source file that isn't a hooks
 * module. A file's lines that match none of them never change its report:
 * `scannedLines` keeps just these, which is what hooks/exports.data.ts holds
 * for a plugin's library files.
 */
const SCANNED: readonly RegExp[] = [
  IMPORT_LINE,
  /\bmodule\s*[=:]/,
  /^\s*export\s+(default\b|(const|function|let|class)\s+[A-Z])/,
  PROMPT_HOOK,
  SESSION_APPEND,
  STATE_HOOK,
  /\$\.state\.set\(/,
]

/** A source file's lines the checker reads, in order; the rest dropped. */
export function scannedLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(line => SCANNED.some(re => re.test(line)))
    .join('\n')
}

/** The engine's own modules, the only ones a plugin imports by name. */
const ENGINE_MODULES = ['claude-code', 'claude-code/testing']

const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/
const TEST = /\.test\.(tsx?|jsx?|mjs|cjs)$/
const DECLARATION = /\.d\.ts$/

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** `a/b/../c` as `a/c`; null when it climbs out of the folder. */
function normal(path: string): string | null {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') {
      continue
    }
    if (part === '..') {
      if (out.length === 0) {
        return null
      }
      out.pop()
    } else {
      out.push(part)
    }
  }
  return out.join('/')
}

function dirOf(path: string): string {
  const at = path.lastIndexOf('/')
  return at < 0 ? '' : path.slice(0, at)
}

/** The file a relative specifier names from `from`, as the bundler finds it; null outside the folder, '' when no such file. */
function resolve(files: ReadonlyMap<string, string>, from: string, spec: string, isModule: boolean): string | null {
  const base = normal(`${dirOf(from)}/${spec}`)
  if (base === null) {
    return null
  }
  const tries = isModule ? [base] : [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.d.ts`]
  return tries.find(path => files.has(path)) ?? ''
}

function parseJson(text: string | undefined): { value?: unknown; error?: string } {
  if (text === undefined) {
    return {}
  }
  try {
    return { value: JSON.parse(text.replace(/^\uFEFF/, '')) as unknown }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'a syntax error' }
  }
}

class Findings {
  readonly errors: Finding[] = []
  readonly warnings: Finding[] = []
  readonly notes: string[] = []

  /** Each problem once, however many times a file shows it (four Clients naming one missing module). */
  private add(list: Finding[], file: string, problem: string, fix: string): void {
    if (!list.some(one => one.file === file && one.problem === problem)) {
      list.push({ file, problem, fix })
    }
  }

  error(file: string, problem: string, fix: string): void {
    this.add(this.errors, file, problem, fix)
  }

  warn(file: string, problem: string, fix: string): void {
    this.add(this.warnings, file, problem, fix)
  }
}

/**
 * Checks an Engram plugin's folder against contract 1. Never throws: a
 * plugin it can't read is one error, naming why.
 */
export function checkEngramPlugin(plugin: PluginFiles | unknown, options: CheckOptions = {}): PluginReport {
  const out = new Findings()
  let id: string | null = null
  try {
    id = check(out, plugin, options)
  } catch (error) {
    out.error('.', `The checker couldn't read this plugin (${error instanceof Error ? error.message : String(error)}).`, 'Point it at an Engram plugin folder: .claude-plugin/plugin.json, engram.json and hooks/.')
  }
  return { id, errors: out.errors, warnings: out.warnings, notes: out.notes }
}

function check(out: Findings, plugin: unknown, options: CheckOptions): string | null {
  if (!isObject(plugin) || !isObject(plugin['files'])) {
    out.error('.', 'No plugin was given: no files to read.', 'Point the checker at an Engram plugin folder.')
    return null
  }
  const files = new Map<string, string>()
  for (const [path, text] of Object.entries(plugin['files'])) {
    files.set(path.replace(/\\/g, '/').replace(/^\.\//, ''), typeof text === 'string' ? text : '')
  }
  const bundled = options.bundled ?? SCENE_IDS

  manifest(out, files)
  const engram = engramJson(out, files, bundled)
  const id = engram && typeof engram['id'] === 'string' ? engram['id'] : null
  const vessel = engram && isObject(engram['vessel']) ? engram['vessel'] : undefined
  const shows = Array.isArray(vessel?.['shows']) ? (vessel['shows'] as unknown[]) : [...SHOW_PLACES]
  const modules = hooksModules(out, files)
  hooksContract(out, files, modules, id, shows)
  const sources = [...files.keys()].filter(path => SOURCE.test(path) && !TEST.test(path) && !DECLARATION.test(path)).sort()
  const surface = selfContained(out, files, sources)
  neverDoes(out, files, sources)
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    for (const path of files.keys()) {
      if (path === name || path.endsWith(`/${name}`)) {
        out.error(path, `This is prompt text: an Engram plugin carries none.`, `Delete ${path}. A persona belongs in your own CLAUDE.md, an output style or a skill, never in an Engram.`)
      }
    }
  }
  if (engram) {
    summary(out, files, engram, modules, surface, sources.length)
  }
  return id
}

/** .claude-plugin/plugin.json: there, an object, named, depending on Eidola. */
function manifest(out: Findings, files: Map<string, string>): void {
  const text = files.get(PLUGIN_MANIFEST)
  if (text === undefined) {
    out.error(PLUGIN_MANIFEST, "There is no plugin manifest, so Claude Code won't install this folder as a plugin.", `Add ${PLUGIN_MANIFEST}: { "name": "my-engram", "version": "0.1.0", "description": "My Engram for Eidola.", "dependencies": ["eidola"] }.`)
    return
  }
  const { value, error } = parseJson(text)
  if (error !== undefined || !isObject(value)) {
    out.error(PLUGIN_MANIFEST, error !== undefined ? `It doesn't parse as JSON (${error}).` : "It isn't a JSON object.", 'Fix the JSON: one object, quoted keys, no trailing commas, no comments.')
    return
  }
  const name = value['name']
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    out.error(PLUGIN_MANIFEST, name === undefined ? 'The plugin has no name.' : `The plugin's name is ${JSON.stringify(name)}, not a kebab-case name.`, 'Set "name" to a kebab-case name, such as "my-engram". Any name will do; the Engram\'s id is in engram.json.')
  }
  const dependencies = value['dependencies']
  const list = Array.isArray(dependencies) ? dependencies : []
  const dependsOnEidola = list.some(one => one === EIDOLA || (isObject(one) && one['name'] === EIDOLA))
  if (!dependsOnEidola) {
    out.error(
      PLUGIN_MANIFEST,
      "The plugin doesn't depend on Eidola, so nothing installs Eidola with it and $.eidola isn't typed in its module.",
      'Add "dependencies": ["eidola"] (docs/spec/engram-plugin.md, plugin.json).',
    )
  }
}

/** engram.json through the one validator, as an Engram plugin's: scene "self", no bundled id; the id stands alone. */
function engramJson(out: Findings, files: Map<string, string>, bundled: readonly string[]): Json | undefined {
  const text = files.get(MANIFEST)
  const parsed = parseJson(text)
  const json = isObject(parsed.value) ? parsed.value : undefined
  const id = json && typeof json['id'] === 'string' ? json['id'] : 'engram'
  // The validator reads the package's own files: engram.json and the thumbnails in vessel/.
  const own: Record<string, string> = {}
  for (const [path, body] of files) {
    if (path === MANIFEST || path.startsWith('vessel/') || path.toLowerCase() === 'soul.md') {
      own[path] = body
    }
  }
  const report = validate({ folder: id, files: own }, { scenes: [SELF_SCENE], reserved: bundled })
  for (const issue of report.errors) {
    out.error(issue.file, issue.problem, issue.rule === 'scene' ? 'Set vessel.scene to "self": an Engram plugin draws its own creature.' : issue.fix)
  }
  for (const issue of report.warnings) {
    out.warn(issue.file, issue.problem, issue.fix)
  }
  const remixOf = json?.['remixOf']
  if (typeof remixOf === 'string' && /^[a-z0-9-]{2,32}$/.test(remixOf) && remixOf !== json?.['id'] && !bundled.includes(remixOf)) {
    out.warn(
      MANIFEST,
      `remixOf is "${remixOf}", which isn't a bundled Engram: while your drawing can't draw, Eidola draws the resting sprite in its place.`,
      `Set remixOf to the bundled Engram yours came from (${bundled.map(one => `"${one}"`).join(', ')}), or leave it out.`,
    )
  }
  return json
}

/** hooks/hooks.json's modules, as paths in the folder; each one there. */
function hooksModules(out: Findings, files: Map<string, string>): string[] {
  const text = files.get(HOOKS_MANIFEST)
  if (text === undefined) {
    out.error(HOOKS_MANIFEST, 'There is no hooks manifest, so the engine loads no hooks: nothing announces the Engram or draws it.', `Add ${HOOKS_MANIFEST}: { "modules": ["./register.tsx"] }.`)
    return []
  }
  const { value, error } = parseJson(text)
  const modules = isObject(value) ? value['modules'] : undefined
  if (error !== undefined || !Array.isArray(modules) || modules.length === 0 || !modules.every(one => typeof one === 'string')) {
    out.error(HOOKS_MANIFEST, error !== undefined ? `It doesn't parse as JSON (${error}).` : 'It names no hooks module.', 'Make it { "modules": ["./register.tsx"] }, naming the drawing module beside it.')
    return []
  }
  const paths: string[] = []
  for (const spec of modules as string[]) {
    const path = normal(`hooks/${spec}`)
    if (path === null || !path.startsWith('hooks/')) {
      out.error(HOOKS_MANIFEST, `It names ${JSON.stringify(spec)}, outside hooks/.`, 'Name the module by its path from hooks/, such as "./register.tsx".')
    } else if (!files.has(path)) {
      out.error(HOOKS_MANIFEST, `It names ${JSON.stringify(spec)}, but there is no ${path}.`, `Add ${path}, the drawing module, or fix the path.`)
    } else {
      paths.push(path)
    }
  }
  return paths
}

/** The hooks module's side of the contract: it announces, and draws where engram.json says, keyed by its id, from both seats. */
function hooksContract(out: Findings, files: Map<string, string>, modules: string[], id: string | null, shows: unknown[]): void {
  if (modules.length === 0) {
    return
  }
  const main = modules[0]!
  const text = modules.map(path => files.get(path) ?? '').join('\n')

  // Announcing.
  if (!/\$\.eidola\.announce\s*\(/.test(text)) {
    out.error(main, "It never calls $.eidola.announce, so Eidola never hears of this Engram and can't draw it.", 'Announce from a session.start hook: await $.eidola.announce({ root: $.plugin.root }) (docs/spec/engram-plugin.md, Announcing).')
  } else {
    if (!/\bon\(\s*['"]session\.start['"]/.test(text)) {
      out.error(main, 'It announces, but has no session.start hook to announce from.', "Call $.eidola.announce from on('session.start', ...), then return next(e).")
    }
    if (!/\broot\s*:\s*\$\.plugin\.root\b/.test(text)) {
      out.warn(main, "It doesn't announce with its own folder, so Eidola may read another engram.json.", 'Announce with { root: $.plugin.root }.')
    }
  }

  // Drawing, where engram.json says it shows.
  const matchers = [...text.matchAll(/\bon\(\s*['"]ui\.render['"]\s*,\s*(\{[^}]*\})/g)].map(m => m[1] ?? '')
  const hasPane = matchers.some(m => /component\s*:\s*['"]Pane['"]/.test(m) && /requestId\s*:\s*['"]eidola['"]/.test(m))
  const hasBand = matchers.some(m => /component\s*:\s*['"]AbovePrompt['"]/.test(m))
  if (shows.includes('pane') && !hasPane) {
    out.error(main, "It draws nothing in the pane: it has no ui.render hook on { component: 'Pane', requestId: 'eidola' }, and engram.json's vessel.shows lists the pane.", 'Add the pane hook (docs/spec/engram-plugin.md, The hand-off), or take "pane" out of vessel.shows.')
  }
  if (shows.includes('band') && !hasBand) {
    out.error(main, "It draws nothing in the band: it has no ui.render hook on { component: 'AbovePrompt' }, and engram.json's vessel.shows lists the band.", 'Add the band hook (docs/spec/engram-plugin.md, The hand-off), or take "band" out of vessel.shows.')
  }
  if (!hasPane && !hasBand) {
    return
  }

  // The keys: its drawing comes back as eidola:<id>, its slot is eidola-slot:<id>.
  if (!/eidola:/.test(text)) {
    out.error(main, 'It never keys its drawing "eidola:<id>", so Eidola finds nothing it can place.', `Answer one Box keyed "eidola:${id ?? '<id>'}", as wide and tall as the hand-off.`)
  } else if (id !== null) {
    const named = new RegExp(`['"\`]${id.replace(/[-]/g, '\\-')}['"\`]|eidola:${id.replace(/[-]/g, '\\-')}\\b`).test(text)
    const own = /\bconst\s+ID\s*=\s*['"]([^'"]+)['"]/.exec(text)?.[1]
    if (own !== undefined && own !== id) {
      out.error(main, `Its ID is "${own}", but engram.json's id is "${id}": Eidola asks for eidola:${id} and this draws eidola:${own}.`, `Set const ID = '${id}', the same as engram.json's id.`)
    } else if (!named) {
      out.error(main, `It never names "${id}", engram.json's id: its drawing must come back in a Box keyed "eidola:${id}".`, `Set its ID to '${id}' (const ID = '${id}'), the same as engram.json's id.`)
    }
  }
  if (!/eidola-slot:/.test(text)) {
    out.warn(
      main,
      'It draws only beneath Eidola: it never looks for its slot (eidola-slot:<id>), so when it loads first nothing draws but the fallback.',
      "Above Eidola, call next(e) and replace the Box keyed eidola-slot:<id> with your drawing (docs/spec/engram-plugin.md, Above Eidola).",
    )
  }
  if (!/[\w)\]]\.eidola\b/.test(text.replace(/\$\.eidola\b/g, ''))) {
    out.warn(
      main,
      "It never reads the hand-off (e.props.eidola), so when it loads after Eidola nothing draws but the fallback.",
      "Beneath Eidola, draw from e.props.eidola when its engram is yours, and return next(e) when it isn't (docs/spec/engram-plugin.md, Beneath Eidola).",
    )
  }
  if (!/\$\.eidola\.fault\s*\(/.test(text)) {
    out.warn(main, "It never calls $.eidola.fault, so when its drawing fails /eidola can't say where.", 'Catch your drawing\'s errors and call $.eidola.fault({ engram: ID, message, file, stack }), then return next(e).')
  }
}

/** Every import and surface module stays inside the folder and is there; returns the surface modules named. */
function selfContained(out: Findings, files: Map<string, string>, sources: string[]): string[] {
  const surface = new Set<string>()
  for (const file of sources) {
    const text = files.get(file) ?? ''
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[2] ?? ''
      if (!spec.startsWith('.')) {
        if (!ENGINE_MODULES.includes(spec)) {
          out.error(file, `It imports "${spec}", a package: the engine loads a plugin's own files and 'claude-code', nothing installed beside them.`, "Copy what it needs into the plugin's hooks/ and import it by path.")
        }
        continue
      }
      const found = resolve(files, file, spec, false)
      if (found === null) {
        out.error(file, `It imports "${spec}", which is outside the plugin's folder: an installed plugin has only its own files.`, "Copy that file into the plugin's hooks/, beside this one, and import it from there.")
      } else if (found === '') {
        out.error(file, `It imports "${spec}", which isn't in the plugin.`, 'Add the file, or fix the path.')
      }
    }
    for (const m of text.matchAll(CLIENT_MODULE)) {
      const spec = m[2] ?? ''
      const found = resolve(files, file, spec, true)
      if (found === null) {
        out.error(file, `A Client names the surface module "${spec}", which is outside the plugin's folder: the engine refuses the hooks module at load.`, "Copy that surface module into the plugin's hooks/ and name it by its path from this file.")
      } else if (found === '') {
        out.error(file, `A Client names the surface module "${spec}", which isn't in the plugin: the engine refuses the hooks module at load.`, 'Add the surface module, or fix the path: it is relative to the file that names it.')
      } else {
        surface.add(found)
      }
    }
  }
  for (const path of surface) {
    if (!SURFACE_EXPORT.test(files.get(path) ?? '')) {
      out.warn(path, 'This surface module exports nothing a Client can draw with.', 'Export its drawing as the default export (export default Creature), or as its one PascalCase export.')
    }
  }
  return [...surface].sort()
}

/** What an Engram plugin must never do (docs/spec/engram-plugin.md): add prompt text, or write Eidola's state. */
function neverDoes(out: Findings, files: Map<string, string>, sources: string[]): void {
  for (const file of sources) {
    const text = files.get(file) ?? ''
    const prompt = PROMPT_HOOK.exec(text)?.[1]
    if (prompt) {
      out.error(file, `It hooks ${prompt}: an Engram plugin adds nothing to the prompt.`, `Remove the ${prompt} hook (docs/spec/engram-plugin.md, What it must never do).`)
    }
    if (SESSION_APPEND.test(text)) {
      out.error(file, 'It calls $.session.append, which adds to what the model reads: an Engram plugin adds nothing to the prompt.', 'Remove the call.')
    }
    if (STATE_HOOK.test(text)) {
      out.error(file, "It hooks state.set, which could change Eidola's state on its way: only Eidola writes eidola.*.", 'Remove the state.set hook; read Eidola\'s state with $.state.get instead.')
    }
    if (EIDOLA_WRITE.test(text)) {
      out.error(file, "It writes Eidola's state: only Eidola writes eidola.*.", 'Remove the write; read the state with $.state.get, and draw from it.')
    }
  }
}

/** What the plugin draws and with what, for the report's summary. */
function summary(out: Findings, files: Map<string, string>, engram: Json, modules: string[], surface: string[], sources: number): void {
  const vessel = isObject(engram['vessel']) ? engram['vessel'] : {}
  const shows = Array.isArray(vessel['shows']) ? (vessel['shows'] as unknown[]).map(String) : [...SHOW_PLACES]
  const remixOf = typeof engram['remixOf'] === 'string' ? `, remixed from ${engram['remixOf']}` : ''
  out.notes.push(`draws: its own creature${remixOf} · shows ${shows.join(' + ')}`)
  if (modules.length) {
    out.notes.push(`hooks: ${modules.join(', ')}${surface.length ? ` · surface modules ${surface.join(', ')}` : ''} · ${plural(sources, 'source file')}, all in the folder`)
  }
  const hud = isObject(vessel['hud']) ? vessel['hud'] : undefined
  if (hud) {
    const parts = [hud['show'] === true ? 'shown' : 'hidden until /eidola frame']
    if (typeof hud['meter'] === 'string') {
      parts.push(hud['meter'] === 'none' ? 'no meter' : `${hud['meter']} meter`)
    }
    if (typeof hud['tag'] === 'string') {
      parts.push(hud['tag'] === 'none' ? 'no tag' : `${hud['tag']} tag`)
    }
    if (isObject(hud['colours'])) {
      parts.push('its own colours')
    }
    out.notes.push(`HUD: ${parts.join(', ')}`)
  }
  const thumbnails = isObject(vessel['thumbnails']) ? vessel['thumbnails'] : {}
  const named = THUMB_VIEWS.filter(view => typeof thumbnails[view] === 'string')
  if (named.length) {
    const largest = Math.max(...named.map(view => (files.get(`vessel/${String(thumbnails[view])}`) ?? '').length))
    out.notes.push(`thumbnails: ${named.join(', ')} (largest ${largest.toLocaleString('en-US')} / ${THUMBNAIL_MAX.toLocaleString('en-US')})`)
  } else {
    out.notes.push('thumbnails: none; the picker shows the scene it was remixed from, or the resting sprite')
  }
}

/** The report as the checker prints it: ok or the count of problems, then each error and warning with its file and fix. */
export function formatReport(report: PluginReport, label = report.id ?? 'plugin'): string {
  const lines: string[] = []
  const n = report.errors.length
  lines.push(n === 0 ? `${label}: ok` : `${label}: ${plural(n, 'problem')}`)
  if (n === 0) {
    lines.push(...report.notes.map(note => `  ${note}`))
  }
  const list = (title: string, findings: Finding[]) => {
    if (findings.length) {
      lines.push(`${title}:`)
      lines.push(...findings.map(one => `  ${one.file}: ${one.problem} ${one.fix}`))
    }
  }
  list(plural(n, 'error'), report.errors)
  list(plural(report.warnings.length, 'warning'), report.warnings)
  return lines.join('\n')
}
