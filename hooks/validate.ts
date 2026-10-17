// The one Engram validator (docs/spec/engram-format.md, "Validation rules"):
// the loader skips a package it fails and says why, the checker prints its
// report, and `/eidola check <id>` shows it. Pure: it takes a package's files
// as given, reads nothing itself, imports nothing from 'claude-code', and
// never throws, whatever it is handed.

import {
  HUD_LABELS,
  HUD_LAYOUTS,
  HUD_METERS,
  HUD_TAGS,
  RIGHTS,
  SCENE_IDS,
  SHOW_PLACES,
  SPEC_VERSION,
  THUMB_VIEWS,
  VESSEL_STATES,
} from './engram-types'

export type RuleId =
  | 'manifest'
  | 'id'
  | 'scene'
  | 'thumb-size'
  | 'thumb-safe'
  | 'thumb-exists'
  | 'frame'
  | 'shows'
  | 'soul'
  | 'unknown-key'
  | 'camera'
  | 'v1'

export type Level = 'error' | 'warning'

/** Every rule in the spec's table, its level, and what it checks. */
export const RULES: Readonly<Record<RuleId, { level: Level; checks: string }>> = {
  manifest: {
    level: 'error',
    checks: 'engram.json exists and parses, spec is 2, the required fields are present, and every field present has the right type',
  },
  id: { level: 'error', checks: "id equals the folder's name and, for a package that isn't bundled, isn't a bundled id" },
  scene: { level: 'error', checks: 'vessel.scene is set and names a scene the mod has' },
  'thumb-size': { level: 'error', checks: 'each thumbnail is at most 131,072 characters and starts with <svg' },
  'thumb-safe': { level: 'error', checks: 'no <script>, no on*= attribute and no href to http(s): in a thumbnail' },
  'thumb-exists': { level: 'error', checks: 'each file named in vessel.thumbnails exists in vessel/' },
  frame: { level: 'warning', checks: 'a v1 per-state frame file in vessel/ is ignored' },
  shows: { level: 'error', checks: 'vessel.shows, when given, lists known places, at least one, each once' },
  soul: { level: 'warning', checks: 'a v1 Soul file is ignored' },
  'unknown-key': { level: 'warning', checks: 'a key the format does not have, outside extensions, is ignored' },
  camera: { level: 'warning', checks: 'vessel.hud.camera is set without tag: livecam' },
  v1: { level: 'error', checks: 'a v1 package (engram.yaml, no engram.json) does not load' },
}

/** One problem: the file it is in, what is wrong, and how to fix it. */
export type Issue = { rule: RuleId; file: string; problem: string; fix: string }

export type Report = { errors: Issue[]; warnings: Issue[] }

/**
 * A package as the validator sees it: its folder's name, and its files by
 * path inside the folder (`engram.json`, `vessel/thumb-pane.svg`), each
 * file's text. A file listed with no text read yet may be given as ''.
 */
export type PackageFiles = { folder: string; files: Readonly<Record<string, string>> }

export type ValidateOptions = {
  /** Ids the package may not take: the bundled ids, for a package that isn't bundled. */
  reserved?: readonly string[]
  /** The scenes `vessel.scene` may name; the mod's built-in scenes by default. */
  scenes?: readonly string[]
  /**
   * Whether to check the thumbnails' files (default true). The loader reads
   * them on first use, not at start, and checks each then with checkThumbnail.
   */
  thumbnails?: boolean
}

export const MANIFEST = 'engram.json'
export const V1_MANIFEST = 'engram.yaml'
export const SOUL_FILE = 'SOUL.md'

/** A desktop Svg's bound on its source, which a thumbnail is drawn in. */
export const THUMBNAIL_MAX = 131_072

/** The required fields, at each level of engram.json that has them. */
export const REQUIRED = {
  engram: ['spec', 'id', 'name', 'version', 'author', 'description', 'rights', 'vessel'],
  vessel: ['scene'],
  colour: ['label', 'detail'],
} as const

/** Every key the format has, at each level; any other draws an unknown-key warning. */
export const KEYS = {
  engram: [...REQUIRED.engram, 'extensions', '$schema'],
  vessel: ['scene', 'shows', 'thumbnails', 'hud'],
  thumbnails: THUMB_VIEWS,
  hud: ['show', 'meter', 'tag', 'camera', 'layout', 'label', 'bracket', 'colours'],
  colours: VESSEL_STATES,
  colour: REQUIRED.colour,
} as const

/** Every field that takes one of a list of values. */
export const ENUMS = {
  spec: [SPEC_VERSION],
  rights: RIGHTS,
  scene: SCENE_IDS,
  shows: SHOW_PLACES,
  meter: HUD_METERS,
  tag: HUD_TAGS,
  layout: HUD_LAYOUTS,
  label: HUD_LABELS,
} as const

/** The patterns string fields must match, as regular expression sources. */
export const PATTERNS = {
  id: '^[a-z0-9-]{2,32}$',
  version:
    '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$',
  colour: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
  thumbnail: '^[A-Za-z0-9_-][A-Za-z0-9._-]*\\.svg$',
} as const

/** Length limits on string fields, in characters. */
export const LIMITS = {
  name: { min: 1, max: 32 },
  description: { min: 1, max: 160 },
  author: { min: 1 },
} as const

/** v1 keys that v2 dropped, and why: a hint beside the unknown-key warning. */
const DROPPED: Readonly<Record<string, string>> = {
  engram_version: 'v2 uses spec and version',
  voice_id: 'v2 has no voice',
  meta: 'v2 keeps author and description at the top level',
  tags: 'nothing reads tags',
  created: 'nothing reads it',
  soul: 'Eidola adds nothing to the prompt',
  type: 'every v2 Engram draws a scene',
  pack: "a v2 package's own vessel/ folder holds its files",
  forge: 'nothing reads it',
  placement: 'where an Engram draws is the person\'s surfaces setting, and vessel.shows',
  fallback: 'every scene draws every mood',
  media: 'v2 has no media tier',
}

const RE = {
  id: new RegExp(PATTERNS.id),
  version: new RegExp(PATTERNS.version),
  colour: new RegExp(PATTERNS.colour),
  thumbnail: new RegExp(PATTERNS.thumbnail),
  script: /<script\b/i,
  // An on* attribute inside a tag: `<g onload=`, `<a onclick =`.
  handler: /<[A-Za-z][^<>]*?\son[A-Za-z]+\s*=/,
  // An href (or xlink:href) to a web address.
  webHref: /\bhref\s*=\s*["']?\s*https?:/i,
  frame: /^vessel\/([^/]+)\.svg$/,
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A value as a short quote for a problem line. */
function quote(value: unknown): string {
  let text: string
  try {
    text = typeof value === 'string' ? JSON.stringify(value) : (JSON.stringify(value) ?? String(value))
  } catch {
    text = typeof value
  }
  return text.length > 40 ? `${text.slice(0, 37)}...` : text
}

function oneOf(values: readonly unknown[]): string {
  return values.map(v => (typeof v === 'string' ? `"${v}"` : String(v))).join(', ')
}

class Collector {
  readonly report: Report = { errors: [], warnings: [] }

  add(rule: RuleId, file: string, problem: string, fix: string): void {
    const issue: Issue = { rule, file, problem, fix }
    if (RULES[rule].level === 'error') {
      this.report.errors.push(issue)
    } else {
      this.report.warnings.push(issue)
    }
  }

  /** An unknown-key warning for each key of `obj` not in `known`; `at` is the path to `obj`. */
  unknownKeys(obj: Json, known: readonly string[], at: string): void {
    for (const key of Object.keys(obj)) {
      if (known.includes(key)) {
        continue
      }
      const path = at ? `${at}.${key}` : key
      const why = DROPPED[key]
      this.add(
        'unknown-key',
        MANIFEST,
        why ? `${path} was a v1 field; ${why}, so it is ignored.` : `${path} isn't part of the format, so it is ignored.`,
        `Delete ${path}, or move it under extensions to keep it.`,
      )
    }
  }
}

/** Checks one thumbnail's text: its size, that it is an SVG, and that it is safe to draw. */
export function checkThumbnail(file: string, text: unknown): Issue[] {
  const out = new Collector()
  try {
    thumbnail(out, file, text)
  } catch {
    out.add('thumb-size', file, "This thumbnail couldn't be read.", 'Save it again as a plain SVG file.')
  }
  return out.report.errors
}

function thumbnail(out: Collector, file: string, text: unknown): void {
  if (typeof text !== 'string') {
    out.add('thumb-size', file, "This thumbnail isn't text.", 'Save it as a plain SVG file.')
    return
  }
  if (text.length > THUMBNAIL_MAX) {
    out.add(
      'thumb-size',
      file,
      `This thumbnail is ${text.length} characters, over the 131,072 a desktop Svg can draw.`,
      'Simplify it or bake it smaller, then check it again.',
    )
  }
  if (!text.trimStart().startsWith('<svg')) {
    out.add(
      'thumb-size',
      file,
      "This thumbnail doesn't start with <svg.",
      'Save it as a bare SVG: the <svg> element first, no XML prolog or doctype before it.',
    )
  }
  if (RE.script.test(text)) {
    out.add('thumb-safe', file, 'This thumbnail has a <script>.', 'Remove it: a thumbnail is a still picture, and the host strips scripts anyway.')
  }
  if (RE.handler.test(text)) {
    out.add('thumb-safe', file, 'This thumbnail has an on* event attribute, such as onload.', 'Remove every on*= attribute.')
  }
  if (RE.webHref.test(text)) {
    out.add(
      'thumb-safe',
      file,
      'This thumbnail links to a web address (an href to http: or https:).',
      'Inline what it links to, or remove the link: a thumbnail draws from its own text alone.',
    )
  }
}

/**
 * Validates an Engram package against spec v2. Returns every error (the
 * package doesn't load) and warning (it loads; something is ignored).
 */
export function validate(pkg: PackageFiles | unknown, options: ValidateOptions = {}): Report {
  const out = new Collector()
  try {
    check(out, pkg, options)
  } catch (error) {
    out.add(
      'manifest',
      MANIFEST,
      `The validator couldn't read this package (${error instanceof Error ? error.message : quote(error)}).`,
      'Check the package is a folder holding an engram.json.',
    )
  }
  return out.report
}

function check(out: Collector, pkg: unknown, options: ValidateOptions): void {
  if (!isObject(pkg) || !isObject(pkg['files'])) {
    out.add('manifest', MANIFEST, 'No package was given: no files to read.', 'Point the check at a package folder holding an engram.json.')
    return
  }
  const files = new Map<string, string>()
  for (const [path, text] of Object.entries(pkg['files'])) {
    files.set(path.replace(/\\/g, '/').replace(/^\.\//, ''), typeof text === 'string' ? text : '')
  }
  const rawFolder = pkg['folder']
  const folder = typeof rawFolder === 'string' ? rawFolder.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() : undefined

  if (!files.has(MANIFEST)) {
    if (files.has(V1_MANIFEST)) {
      out.add(
        'v1',
        V1_MANIFEST,
        "v1 Engram: its clips can't draw in Claude. A v1 package has engram.yaml and no engram.json.",
        'Remake it as v2: an engram.json naming a scene (docs/spec/engram-format.md).',
      )
    } else {
      out.add('manifest', MANIFEST, 'There is no engram.json.', 'Add an engram.json at the top of the package folder (docs/spec/engram-format.md).')
    }
    return
  }

  leftovers(out, files)

  let json: unknown
  try {
    json = JSON.parse((files.get(MANIFEST) ?? '').replace(/^﻿/, ''))
  } catch (error) {
    out.add(
      'manifest',
      MANIFEST,
      `engram.json doesn't parse as JSON (${error instanceof Error ? error.message : 'a syntax error'}).`,
      'Fix the JSON: quoted keys, no trailing commas, no comments.',
    )
    return
  }
  if (!isObject(json)) {
    out.add('manifest', MANIFEST, "engram.json isn't a JSON object.", 'Make the whole file one object: { "spec": 2, "id": ..., ... }.')
    return
  }

  top(out, json, folder, options)

  const vessel = json['vessel']
  if (vessel === undefined) {
    out.add('manifest', MANIFEST, 'The required field vessel is missing.', 'Add "vessel": { "scene": "kraken" }, naming the scene it draws.')
  } else if (!isObject(vessel)) {
    out.add('manifest', MANIFEST, `vessel is ${quote(vessel)}, not an object.`, 'Make vessel an object: { "scene": "kraken" }.')
  } else {
    const named = vesselFields(out, vessel, options)
    if (options.thumbnails !== false) {
      for (const file of named) {
        const text = files.get(file)
        if (text === undefined) {
          out.add('thumb-exists', file, `vessel.thumbnails names ${file}, which isn't in the package.`, `Add ${file}, or take it out of vessel.thumbnails.`)
        } else {
          thumbnail(out, file, text)
        }
      }
    }
  }

  const extensions = json['extensions']
  if (extensions !== undefined && !isObject(extensions)) {
    out.add('manifest', MANIFEST, `extensions is ${quote(extensions)}, not an object.`, 'Make extensions an object, such as {}.')
  }
  out.unknownKeys(json, KEYS.engram, '')
}

/** Files v2 no longer has: per-state frames and the Soul. */
function leftovers(out: Collector, files: Map<string, string>): void {
  for (const path of files.keys()) {
    const frame = RE.frame.exec(path)
    if (frame && (VESSEL_STATES as readonly string[]).includes(frame[1] ?? '')) {
      out.add('frame', path, 'v2 has no frames; this file is ignored. Every Engram draws a scene.', `Delete ${path}.`)
    }
    if (path.toLowerCase() === SOUL_FILE.toLowerCase()) {
      out.add('soul', path, 'Eidola adds nothing to the prompt; this file is ignored.', `Delete ${path}. A persona belongs in CLAUDE.md, an output style or a skill.`)
    }
  }
}

function top(out: Collector, json: Json, folder: string | undefined, options: ValidateOptions): void {
  const spec = json['spec']
  if (spec === undefined) {
    out.add('manifest', MANIFEST, 'The required field spec is missing.', 'Add "spec": 2.')
  } else if (spec !== SPEC_VERSION) {
    out.add('manifest', MANIFEST, `spec is ${quote(spec)}; this mod reads spec 2.`, 'Set "spec": 2, and check the package against docs/spec/engram-format.md.')
  }

  const id = json['id']
  if (id === undefined) {
    out.add('manifest', MANIFEST, 'The required field id is missing.', 'Add "id", the same as the folder\'s name, such as "my-engram".')
  } else if (typeof id !== 'string' || !RE.id.test(id)) {
    out.add('manifest', MANIFEST, `id is ${quote(id)}, not a slug.`, 'Use 2 to 32 of a-z, 0-9 and -, such as "my-engram", and name the folder the same.')
  } else {
    if (folder !== undefined && id !== folder) {
      out.add('id', MANIFEST, `id is "${id}" but the folder is named "${folder}".`, `Rename the folder to ${id}, or set "id": "${folder}".`)
    }
    if (options.reserved?.includes(id)) {
      out.add('id', MANIFEST, `"${id}" is a bundled Engram's id.`, 'Remix it under a new id: change id and rename the folder to match.')
    }
  }

  text(out, json, 'name', LIMITS.name.max, 'Add "name", what the picker and the HUD call it.')
  const version = json['version']
  if (version === undefined) {
    out.add('manifest', MANIFEST, 'The required field version is missing.', 'Add "version": "1.0.0".')
  } else if (typeof version !== 'string' || !RE.version.test(version)) {
    out.add('manifest', MANIFEST, `version is ${quote(version)}, not a semver version.`, 'Use major.minor.patch, such as "1.0.0".')
  }
  text(out, json, 'author', undefined, 'Add "author", your name or handle.')
  text(out, json, 'description', LIMITS.description.max, 'Add "description", a line or two for the picker card.')

  const rights = json['rights']
  if (rights === undefined) {
    out.add('manifest', MANIFEST, 'The required field rights is missing.', 'Add "rights": "original" if you made it, or "licensed" if you may share it.')
  } else if (!(RIGHTS as readonly unknown[]).includes(rights)) {
    out.add('manifest', MANIFEST, `rights is ${quote(rights)}.`, `Set rights to one of ${oneOf(RIGHTS)}.`)
  }
}

/** A required string field, non-blank and at most `max` characters. */
function text(out: Collector, json: Json, field: 'name' | 'author' | 'description', max: number | undefined, add: string): void {
  const value = json[field]
  if (value === undefined) {
    out.add('manifest', MANIFEST, `The required field ${field} is missing.`, add)
  } else if (typeof value !== 'string' || value.trim() === '') {
    out.add('manifest', MANIFEST, `${field} is ${quote(value)}, not a non-empty string.`, add)
  } else if (max !== undefined && value.length > max) {
    out.add('manifest', MANIFEST, `${field} is ${value.length} characters, over ${max}.`, `Shorten ${field} to ${max} characters or fewer.`)
  }
}

/** Checks vessel's fields; returns the thumbnail files it names, as paths in the package. */
function vesselFields(out: Collector, vessel: Json, options: ValidateOptions): string[] {
  const scenes: readonly string[] = options.scenes ?? SCENE_IDS
  const scene = vessel['scene']
  if (scene === undefined) {
    out.add('scene', MANIFEST, 'vessel.scene is missing: every Engram draws a scene.', `Set vessel.scene to one of ${oneOf(scenes)}.`)
  } else if (typeof scene !== 'string' || !scenes.includes(scene)) {
    out.add('scene', MANIFEST, `vessel.scene is ${quote(scene)}, which isn't a scene this mod has.`, `Set vessel.scene to one of ${oneOf(scenes)}.`)
  }

  const shows = vessel['shows']
  if (shows !== undefined) {
    if (!Array.isArray(shows)) {
      out.add('shows', MANIFEST, `vessel.shows is ${quote(shows)}, not a list.`, `Make it a list of places: ${oneOf(SHOW_PLACES)}.`)
    } else if (shows.length === 0) {
      out.add('shows', MANIFEST, 'vessel.shows lists no place, so it would draw nowhere.', `List at least one of ${oneOf(SHOW_PLACES)}, or leave shows out for all three.`)
    } else {
      const seen = new Set<unknown>()
      for (const place of shows) {
        if (!(SHOW_PLACES as readonly unknown[]).includes(place)) {
          out.add('shows', MANIFEST, `vessel.shows lists ${quote(place)}, which isn't a place.`, `Use only ${oneOf(SHOW_PLACES)}.`)
        } else if (seen.has(place)) {
          out.add('shows', MANIFEST, `vessel.shows lists "${String(place)}" twice.`, 'List each place once.')
        }
        seen.add(place)
      }
    }
  }

  const named: string[] = []
  const thumbnails = vessel['thumbnails']
  if (thumbnails !== undefined) {
    if (!isObject(thumbnails)) {
      out.add('manifest', MANIFEST, `vessel.thumbnails is ${quote(thumbnails)}, not an object.`, 'Make it { "pane": "thumb-pane.svg", "band": "thumb-band.svg" }, or leave it out.')
    } else {
      for (const view of THUMB_VIEWS) {
        const file = thumbnails[view]
        if (file === undefined) {
          continue
        }
        if (typeof file !== 'string' || !RE.thumbnail.test(file)) {
          out.add('manifest', MANIFEST, `vessel.thumbnails.${view} is ${quote(file)}, not an SVG file name in vessel/.`, `Name a file in vessel/, such as "thumb-${view}.svg".`)
        } else {
          named.push(`vessel/${file}`)
        }
      }
      out.unknownKeys(thumbnails, KEYS.thumbnails, 'vessel.thumbnails')
    }
  }

  const hud = vessel['hud']
  if (hud !== undefined) {
    if (!isObject(hud)) {
      out.add('manifest', MANIFEST, `vessel.hud is ${quote(hud)}, not an object.`, 'Make vessel.hud an object, or leave it out.')
    } else {
      hudFields(out, hud)
    }
  }

  out.unknownKeys(vessel, KEYS.vessel, 'vessel')
  return named
}

function hudFields(out: Collector, hud: Json): void {
  const show = hud['show']
  if (show !== undefined && typeof show !== 'boolean') {
    out.add('manifest', MANIFEST, `vessel.hud.show is ${quote(show)}, not true or false.`, 'Set it to true or false.')
  }
  const enums = { meter: HUD_METERS, tag: HUD_TAGS, layout: HUD_LAYOUTS, label: HUD_LABELS } as const
  for (const field of ['meter', 'tag', 'layout', 'label'] as const) {
    const value = hud[field]
    if (value !== undefined && !(enums[field] as readonly unknown[]).includes(value)) {
      out.add('manifest', MANIFEST, `vessel.hud.${field} is ${quote(value)}.`, `Set it to one of ${oneOf(enums[field])}.`)
    }
  }
  const camera = hud['camera']
  if (camera !== undefined) {
    if (typeof camera !== 'string' || camera.trim() === '') {
      out.add('manifest', MANIFEST, `vessel.hud.camera is ${quote(camera)}, not a name.`, 'Set it to the camera\'s name, such as "DEEPCAM 02".')
    } else if (hud['tag'] !== 'livecam') {
      out.add('camera', MANIFEST, 'vessel.hud.camera is set but the tag isn\'t "livecam", so nothing shows it.', 'Set vessel.hud.tag to "livecam", or remove camera.')
    }
  }
  const bracket = hud['bracket']
  if (bracket !== undefined && !(typeof bracket === 'string' && RE.colour.test(bracket))) {
    out.add('manifest', MANIFEST, `vessel.hud.bracket is ${quote(bracket)}, not a hex colour.`, 'Use #rgb or #rrggbb, such as "#b8913a".')
  }
  const colours = hud['colours']
  if (colours !== undefined) {
    if (!isObject(colours)) {
      out.add('manifest', MANIFEST, `vessel.hud.colours is ${quote(colours)}, not an object.`, 'Make it an object of states, such as { "idle": { "label": "#ffffff", "detail": "#a0a0b8" } }.')
    } else {
      for (const state of VESSEL_STATES) {
        const pair = colours[state]
        if (pair === undefined) {
          continue
        }
        const at = `vessel.hud.colours.${state}`
        if (!isObject(pair)) {
          out.add('manifest', MANIFEST, `${at} is ${quote(pair)}, not { label, detail }.`, `Set ${at} to { "label": "#rrggbb", "detail": "#rrggbb" }.`)
          continue
        }
        for (const part of REQUIRED.colour) {
          const value = pair[part]
          if (value === undefined) {
            out.add('manifest', MANIFEST, `${at}.${part} is missing.`, `Add ${at}.${part}, a hex colour.`)
          } else if (!(typeof value === 'string' && RE.colour.test(value))) {
            out.add('manifest', MANIFEST, `${at}.${part} is ${quote(value)}, not a hex colour.`, 'Use #rgb or #rrggbb.')
          }
        }
        out.unknownKeys(pair, KEYS.colour, at)
      }
      out.unknownKeys(colours, KEYS.colours, 'vessel.hud.colours')
    }
  }
  out.unknownKeys(hud, KEYS.hud, 'vessel.hud')
}
