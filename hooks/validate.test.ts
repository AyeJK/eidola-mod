import { describe, expect, test } from 'claude-code/testing'

import type { VesselState } from '../types'
import { SCENE_IDS, SHOW_PLACES, VESSEL_STATES, withDefaults } from './engram-types'
import type { EngramJson } from './engram-types'
import { ENGRAM_SCHEMA } from './engram-schema'
import { SCENES } from './scenes'
import { ENUMS, KEYS, LIMITS, PATTERNS, REQUIRED, RULES, THUMBNAIL_MAX, checkThumbnail, validate } from './validate'
import type { Issue, PackageFiles, Report, RuleId, ValidateOptions } from './validate'

const THUMB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#123"/></svg>'

/** The bundled Lich as v2, every colour copied from hooks/engrams.ts. */
const LICH: EngramJson = {
  spec: 2,
  id: 'lich',
  name: 'Lich',
  version: '1.0.0',
  author: 'eidola',
  description: 'A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.',
  rights: 'original',
  vessel: {
    scene: 'lich',
    shows: ['pane', 'band', 'shrine'],
    thumbnails: { pane: 'thumb-pane.svg', band: 'thumb-band.svg' },
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
}

const KRAKEN: EngramJson = {
  spec: 2,
  id: 'kraken',
  name: 'Kraken',
  version: '1.0.0',
  author: 'eidola',
  description: 'Something vast in the deep water beside your work. It surfaces when there is work to do.',
  rights: 'original',
  vessel: {
    scene: 'kraken',
    thumbnails: { pane: 'thumb-pane.svg', band: 'thumb-band.svg' },
    hud: { show: true, meter: 'none', tag: 'livecam', camera: 'DEEPCAM 02', bracket: '#3c9aa6' },
  },
}

const WISP: EngramJson = {
  spec: 2,
  id: 'wisp',
  name: 'Wisp',
  version: '1.0.0',
  author: 'eidola',
  description: "A will-o'-the-wisp in a night fen. It flies where it likes, its ghost fire burning the colour of your work.",
  rights: 'original',
  vessel: {
    scene: 'wisp',
    shows: ['band'],
    thumbnails: { band: 'thumb-band.svg' },
    hud: { show: true, meter: 'none', tag: 'none', layout: 'bottom', label: 'pixel', bracket: '#6f62d8' },
  },
}

/** A manifest as plain, changeable JSON, for the edits below. */
type Loose = { [key: string]: any }

/** The Lich (or another manifest), changed by `change`, as a package in its own folder with both thumbnails. */
function pkg(change?: (m: Loose) => void, extra: Record<string, string> = {}, base: EngramJson = LICH): PackageFiles {
  const m = JSON.parse(JSON.stringify(base)) as Loose
  change?.(m)
  return {
    folder: typeof m['id'] === 'string' ? m['id'] : base.id,
    files: { 'engram.json': JSON.stringify(m, null, 2), 'vessel/thumb-pane.svg': THUMB, 'vessel/thumb-band.svg': THUMB, ...extra },
  }
}

/** The package with its files replaced outright. */
function raw(files: Record<string, string>, folder = 'lich'): PackageFiles {
  return { folder, files }
}

function all(report: Report): Issue[] {
  return [...report.errors, ...report.warnings]
}

function rulesOf(report: Report): RuleId[] {
  return all(report).map(issue => issue.rule)
}

type Case = { name: string; pkg: unknown; options?: ValidateOptions }

const big = (n: number) => `<svg>${'x'.repeat(n - '<svg></svg>'.length)}</svg>`

/** One passing and at least one failing package for every rule in the spec's table. */
const CASES: Record<RuleId, { pass: Case[]; fail: Case[] }> = {
  manifest: {
    pass: [
      { name: 'the Lich', pkg: pkg() },
      { name: 'only the required fields', pkg: pkg(m => { delete m['extensions']; m['vessel'] = { scene: 'lich' } }) },
      { name: 'a BOM before the JSON', pkg: raw({ 'engram.json': `﻿${JSON.stringify(LICH)}`, 'vessel/thumb-pane.svg': THUMB, 'vessel/thumb-band.svg': THUMB }) },
    ],
    fail: [
      { name: 'no engram.json', pkg: raw({ 'vessel/thumb-pane.svg': THUMB }) },
      { name: 'engram.json that does not parse', pkg: raw({ 'engram.json': '{ "spec": 2,' }) },
      { name: 'engram.json that is a list', pkg: raw({ 'engram.json': '[]' }) },
      { name: 'spec 1', pkg: pkg(m => { m['spec'] = 1 }) },
      { name: 'no spec', pkg: pkg(m => { delete m['spec'] }) },
      { name: 'no name', pkg: pkg(m => { delete m['name'] }) },
      { name: 'a name over 32', pkg: pkg(m => { m['name'] = 'L'.repeat(33) }) },
      { name: 'a blank author', pkg: pkg(m => { m['author'] = '  ' }) },
      { name: 'a description over 160', pkg: pkg(m => { m['description'] = 'd'.repeat(161) }) },
      { name: 'a version that is not semver', pkg: pkg(m => { m['version'] = '1.0' }) },
      { name: 'rights that are neither', pkg: pkg(m => { m['rights'] = 'mine' }) },
      { name: 'no rights', pkg: pkg(m => { delete m['rights'] }) },
      { name: 'an id that is not a slug', pkg: raw({ 'engram.json': JSON.stringify({ ...LICH, id: 'My_Lich' }) }, 'My_Lich') },
      { name: 'no vessel', pkg: pkg(m => { delete m['vessel'] }) },
      { name: 'a vessel that is a string', pkg: pkg(m => { m['vessel'] = 'lich' }) },
      { name: 'an unknown meter', pkg: pkg(m => { m['vessel']['hud']['meter'] = 'dial' }) },
      { name: 'show as a string', pkg: pkg(m => { m['vessel']['hud']['show'] = 'yes' }) },
      { name: 'a bracket that is not hex', pkg: pkg(m => { m['vessel']['hud']['bracket'] = 'gold' }) },
      { name: 'a colour missing its detail', pkg: pkg(m => { delete m['vessel']['hud']['colours']['idle']['detail'] }) },
      { name: 'a thumbnail outside vessel/', pkg: pkg(m => { m['vessel']['thumbnails']['pane'] = '../thumb.svg' }) },
      { name: 'extensions as a list', pkg: pkg(m => { m['extensions'] = [] }) },
    ],
  },
  id: {
    pass: [
      { name: 'the id names the folder', pkg: pkg() },
      { name: 'a new id among reserved ones', pkg: pkg(m => { m['id'] = 'my-lich' }), options: { reserved: ['kraken', 'lich', 'wisp'] } },
    ],
    fail: [
      { name: 'a folder named otherwise', pkg: { ...pkg(), folder: 'lich-2' } },
      { name: 'a bundled id in a package that is not bundled', pkg: pkg(), options: { reserved: ['kraken', 'lich', 'wisp'] } },
    ],
  },
  scene: {
    pass: [
      { name: 'a built-in scene', pkg: pkg() },
      { name: 'a scene a caller adds', pkg: pkg(m => { m['vessel']['scene'] = 'abyss' }), options: { scenes: ['abyss'] } },
    ],
    fail: [
      { name: 'a missing vessel.scene', pkg: pkg(m => { delete m['vessel']['scene'] }) },
      { name: 'an unknown vessel.scene', pkg: pkg(m => { m['vessel']['scene'] = 'hydra' }) },
      { name: 'a vessel.scene that is a number', pkg: pkg(m => { m['vessel']['scene'] = 7 }) },
    ],
  },
  'thumb-size': {
    pass: [
      { name: 'exactly 131,072 characters', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': big(THUMBNAIL_MAX) }) },
      { name: 'whitespace before <svg', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': `\n  ${THUMB}` }) },
    ],
    fail: [
      { name: 'a thumbnail over 131,072 characters', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': big(THUMBNAIL_MAX + 1) }) },
      { name: 'an XML prolog first', pkg: pkg(undefined, { 'vessel/thumb-band.svg': `<?xml version="1.0"?>${THUMB}` }) },
      { name: 'not an SVG at all', pkg: pkg(undefined, { 'vessel/thumb-band.svg': 'PNG' }) },
    ],
  },
  'thumb-safe': {
    pass: [
      { name: 'an xmlns to http is no link', pkg: pkg() },
      { name: 'a local href', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': '<svg><use href="#a"/><text>turn on = off</text></svg>' }) },
    ],
    fail: [
      { name: 'a <script>', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': '<svg><script>alert(1)</script></svg>' }) },
      { name: 'an onload attribute', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': '<svg onload="go()"></svg>' }) },
      { name: 'an onclick on an inner element', pkg: pkg(undefined, { 'vessel/thumb-band.svg': '<svg><rect width="1" onclick = "x"/></svg>' }) },
      { name: 'an http href', pkg: pkg(undefined, { 'vessel/thumb-pane.svg': '<svg><image href="http://example.com/a.png"/></svg>' }) },
      { name: 'an https xlink:href', pkg: pkg(undefined, { 'vessel/thumb-band.svg': "<svg><a xlink:href='https://example.com'>x</a></svg>" }) },
    ],
  },
  'thumb-exists': {
    pass: [
      { name: 'both named files present', pkg: pkg() },
      { name: 'no thumbnails named, no files', pkg: raw({ 'engram.json': JSON.stringify({ ...LICH, vessel: { scene: 'lich' } }) }) },
      { name: 'the loader at start, before reading thumbnails', pkg: raw({ 'engram.json': JSON.stringify(LICH) }), options: { thumbnails: false } },
    ],
    fail: [{ name: 'a named file that is missing', pkg: raw({ 'engram.json': JSON.stringify(LICH), 'vessel/thumb-pane.svg': THUMB }) }],
  },
  frame: {
    pass: [
      { name: 'thumbnails only', pkg: pkg() },
      { name: 'another file in vessel/', pkg: pkg(undefined, { 'vessel/notes.svg': THUMB }) },
    ],
    fail: [
      { name: 'a leftover vessel/idle.svg frame', pkg: pkg(undefined, { 'vessel/idle.svg': THUMB }) },
      { name: 'a leftover frame by a Windows path', pkg: pkg(undefined, { 'vessel\\sleeping.svg': THUMB }) },
    ],
  },
  shows: {
    pass: [
      { name: 'all three', pkg: pkg() },
      { name: 'left out', pkg: pkg(m => { delete m['vessel']['shows'] }) },
      { name: 'the band alone', pkg: pkg(undefined, {}, WISP) },
    ],
    fail: [
      { name: 'an empty list', pkg: pkg(m => { m['vessel']['shows'] = [] }) },
      { name: 'a place twice', pkg: pkg(m => { m['vessel']['shows'] = ['pane', 'pane'] }) },
      { name: 'a v1 value', pkg: pkg(m => { m['vessel']['shows'] = ['both'] }) },
      { name: 'a string, not a list', pkg: pkg(m => { m['vessel']['shows'] = 'pane' }) },
    ],
  },
  soul: {
    pass: [{ name: 'no Soul file', pkg: pkg() }],
    fail: [{ name: 'a leftover SOUL.md', pkg: pkg(undefined, { 'SOUL.md': '# Lich\n\nYou are a lich.' }) }],
  },
  'unknown-key': {
    pass: [
      { name: 'anything under extensions, and $schema', pkg: pkg(m => { m['$schema'] = '../engram.schema.json'; m['extensions'] = { tags: ['x'], voice_id: null, clips: { idle: 'a.webm' } } }) },
    ],
    fail: [
      { name: 'an unknown top-level key', pkg: pkg(m => { m['mood'] = 'grim' }) },
      { name: 'v1 tags', pkg: pkg(m => { m['tags'] = ['scene'] }) },
      { name: 'v1 voice_id', pkg: pkg(m => { m['voice_id'] = null }) },
      { name: 'v1 vessel.placement', pkg: pkg(m => { m['vessel']['placement'] = 'band' }) },
      { name: 'an unknown hud key', pkg: pkg(m => { m['vessel']['hud']['glow'] = true }) },
      { name: 'an unknown state in colours', pkg: pkg(m => { m['vessel']['hud']['colours']['busy'] = { label: '#fff', detail: '#000' } }) },
      { name: 'an unknown thumbnail view', pkg: pkg(m => { m['vessel']['thumbnails']['shrine'] = 'thumb-pane.svg' }) },
    ],
  },
  camera: {
    pass: [
      { name: 'a camera on a livecam tag', pkg: pkg(undefined, {}, KRAKEN) },
      { name: 'no camera', pkg: pkg() },
    ],
    fail: [
      { name: 'a camera on a sigil tag', pkg: pkg(m => { m['vessel']['hud']['camera'] = 'CAM 03' }) },
      { name: 'a camera with no tag', pkg: pkg(m => { delete m['vessel']['hud']['tag']; m['vessel']['hud']['camera'] = 'CAM 03' }) },
    ],
  },
  v1: {
    pass: [{ name: 'a v2 package', pkg: pkg() }],
    fail: [
      {
        name: 'a v1 engram.yaml package',
        pkg: raw({
          'engram.yaml': 'engram_version: 1.0.0\nid: lich\nname: Lich\nvoice_id: null\n',
          'SOUL.md': '# Lich',
          'vessel.yaml': 'type: gif\npack: lich\n',
          'vessel/idle.gif': 'GIF89a',
        }),
      },
    ],
  },
}

describe('validate: every rule passes one package and fails another', () => {
  test('every rule in the table has cases', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(RULES).sort())
    for (const [rule, { pass, fail }] of Object.entries(CASES)) {
      expect(pass.length, rule).toBeGreaterThan(0)
      expect(fail.length, rule).toBeGreaterThan(0)
    }
  })

  for (const [rule, { pass, fail }] of Object.entries(CASES) as [RuleId, { pass: Case[]; fail: Case[] }][]) {
    const level = RULES[rule].level
    for (const one of pass) {
      test(`${rule} passes: ${one.name}`, () => {
        const report = validate(one.pkg, one.options)
        expect(rulesOf(report).filter(r => r === rule), JSON.stringify(all(report))).toEqual([])
      })
    }
    for (const one of fail) {
      test(`${rule} fails (${level}): ${one.name}`, () => {
        const report = validate(one.pkg, one.options)
        const found = (level === 'error' ? report.errors : report.warnings).filter(issue => issue.rule === rule)
        expect(found.length, JSON.stringify(all(report))).toBeGreaterThan(0)
        // An error rule never lands among the warnings, nor a warning among the errors.
        expect((level === 'error' ? report.warnings : report.errors).some(issue => issue.rule === rule)).toBe(false)
      })
    }
  }
})

describe('validate', () => {
  test('the three bundled Engrams, as v2, are clean', () => {
    for (const base of [LICH, KRAKEN, WISP]) {
      const files: Record<string, string> = { 'engram.json': JSON.stringify(base) }
      for (const file of Object.values(base.vessel.thumbnails ?? {})) {
        files[`vessel/${file}`] = THUMB
      }
      expect(validate({ folder: base.id, files }), base.id).toEqual({ errors: [], warnings: [] })
    }
  })

  test('a v1 package gets the v1 error alone', () => {
    const report = validate(CASES.v1.fail[0]!.pkg)
    expect(report.warnings).toEqual([])
    expect(report.errors.map(issue => issue.rule)).toEqual(['v1'])
    expect(report.errors[0]?.problem).toContain("v1 Engram: its clips can't draw in Claude")
  })

  test('every issue names its file, the problem and the fix', () => {
    for (const { fail } of Object.values(CASES)) {
      for (const one of fail) {
        for (const issue of all(validate(one.pkg, one.options))) {
          expect(issue.file.length, one.name).toBeGreaterThan(0)
          expect(issue.problem.length, one.name).toBeGreaterThan(0)
          expect(issue.fix.length, one.name).toBeGreaterThan(0)
        }
      }
    }
  })

  test('a thumbnail problem names the thumbnail; a field problem names engram.json', () => {
    const big = validate(CASES['thumb-size'].fail[0]!.pkg)
    expect(big.errors[0]?.file).toBe('vessel/thumb-pane.svg')
    expect(big.errors[0]?.problem).toContain('131,072')
    expect(validate(CASES.scene.fail[0]!.pkg).errors[0]?.file).toBe('engram.json')
    expect(validate(CASES.frame.fail[0]!.pkg).warnings[0]?.file).toBe('vessel/idle.svg')
  })

  test('a v1 key gets a hint of why it went', () => {
    const report = validate(CASES['unknown-key'].fail[2]!.pkg)
    expect(report.warnings[0]?.problem).toContain('voice_id was a v1 field')
    expect(report.warnings[0]?.fix).toContain('extensions')
  })

  test('never throws on bad input', () => {
    const bad: unknown[] = [
      undefined,
      null,
      42,
      'lich',
      [],
      {},
      { files: null },
      { files: [] },
      { folder: 3, files: { 'engram.json': 5 } },
      raw({ 'engram.json': 'null' }),
      raw({ 'engram.json': '"lich"' }),
      raw({ 'engram.json': '{"vessel": []}' }),
      raw({ 'engram.json': '{"vessel": {"hud": {"colours": [], "camera": 4}, "thumbnails": [], "shows": {}}}' }),
      raw({ 'engram.json': '{"vessel": {"hud": {"colours": {"idle": null, "error": {"label": 1}}}, "thumbnails": {"pane": 3}, "shows": [null, {}]}}' }),
      raw({ 'engram.json': '{"id": {}, "name": [], "version": 1, "rights": null, "spec": "2", "extensions": "x"}' }),
    ]
    for (const one of bad) {
      const report = validate(one)
      expect(Array.isArray(report.errors)).toBe(true)
      expect(report.errors.length, JSON.stringify(one) ?? String(one)).toBeGreaterThan(0)
    }
    // Options that aren't options don't throw either.
    const odd = validate(pkg(), { scenes: 5 } as unknown as ValidateOptions)
    expect(odd.errors.length).toBeGreaterThan(0)
  })

  test('the loader checks a thumbnail on first read', () => {
    expect(checkThumbnail('vessel/thumb-pane.svg', THUMB)).toEqual([])
    expect(checkThumbnail('vessel/thumb-pane.svg', big(THUMBNAIL_MAX + 1)).map(issue => issue.rule)).toEqual(['thumb-size'])
    expect(checkThumbnail('vessel/thumb-pane.svg', '<svg><script/></svg>').map(issue => issue.rule)).toEqual(['thumb-safe'])
    expect(checkThumbnail('vessel/thumb-pane.svg', undefined).map(issue => issue.rule)).toEqual(['thumb-size'])
  })
})

describe('engram types', () => {
  test("the built-in scenes are the mod's scenes", () => {
    expect([...SCENE_IDS].sort()).toEqual(Object.keys(SCENES).sort())
  })

  test('colours are keyed by all nine states', () => {
    const every: Record<VesselState, true> = {
      idle: true,
      thinking: true,
      working: true,
      waiting: true,
      responding: true,
      success: true,
      error: true,
      attention: true,
      sleeping: true,
    }
    expect([...VESSEL_STATES].sort()).toEqual(Object.keys(every).sort())
  })

  test('the registry fills every default', () => {
    const engram = withDefaults({ ...LICH, vessel: { scene: 'lich' }, extensions: undefined })
    expect(engram.vessel.shows).toEqual([...SHOW_PLACES])
    expect(engram.vessel.thumbnails).toEqual({})
    expect(engram.vessel.hud).toEqual({ show: false, meter: 'bars', tag: 'name', layout: 'top', label: 'bold', bracket: '#b8913a', colours: {} })
    expect(engram.extensions).toEqual({})
  })

  test('the registry keeps what the manifest gives', () => {
    const engram = withDefaults(KRAKEN)
    expect(engram.vessel.hud.camera).toBe('DEEPCAM 02')
    expect(engram.vessel.hud.tag).toBe('livecam')
    expect(engram.vessel.thumbnails).toEqual({ pane: 'thumb-pane.svg', band: 'thumb-band.svg' })
    expect(withDefaults(WISP).vessel.shows).toEqual(['band'])
  })
})

/** What the schema is held to: the validator's own lists. */
type Validator = {
  REQUIRED: Readonly<Record<string, readonly unknown[]>>
  KEYS: Readonly<Record<string, readonly unknown[]>>
  ENUMS: Readonly<Record<string, readonly unknown[]>>
  PATTERNS: Readonly<Record<string, string>>
  LIMITS: Readonly<Record<string, { min?: number; max?: number }>>
}

const VALIDATOR: Validator = { REQUIRED, KEYS, ENUMS, PATTERNS, LIMITS }

/** Where each of the validator's lists sits in the schema. */
const REQUIRED_AT: Record<string, string> = { '': 'engram', 'properties.vessel': 'vessel', '$defs.stateColour': 'colour' }
const ENUM_AT: Record<string, string> = {
  'properties.spec': 'spec',
  'properties.rights': 'rights',
  'properties.vessel.properties.scene': 'scene',
  'properties.vessel.properties.shows.items': 'shows',
  'properties.vessel.properties.hud.properties.meter': 'meter',
  'properties.vessel.properties.hud.properties.tag': 'tag',
  'properties.vessel.properties.hud.properties.layout': 'layout',
  'properties.vessel.properties.hud.properties.label': 'label',
}
const KEYS_AT: Record<string, string> = {
  '': 'engram',
  'properties.vessel': 'vessel',
  'properties.vessel.properties.thumbnails': 'thumbnails',
  'properties.vessel.properties.hud': 'hud',
  'properties.vessel.properties.hud.properties.colours': 'colours',
  '$defs.stateColour': 'colour',
}

/** Every node in the schema with its path, depth first. */
function nodes(node: unknown, path = ''): [string, Loose][] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return []
  }
  const out: [string, Loose][] = [[path, node as Loose]]
  for (const [key, child] of Object.entries(node)) {
    out.push(...nodes(child, path ? `${path}.${key}` : key))
  }
  return out
}

function at(schema: Loose, path: string): Loose | undefined {
  return nodes(schema).find(([p]) => p === path)?.[1]
}

const sorted = (list: unknown) => JSON.stringify(Array.isArray(list) ? list.map(String).sort() : list)

/** Every way the schema and the validator disagree; none when they match. */
function mismatches(schema: Loose, v: Validator = VALIDATOR): string[] {
  const out: string[] = []
  const same = (what: string, a: unknown, b: unknown) => {
    if (sorted(a) !== sorted(b)) {
      out.push(`${what}: schema ${sorted(a)}, validate.ts ${sorted(b)}`)
    }
  }
  const all = nodes(schema)

  // Required fields: every required list in the schema is one of the validator's, and the same.
  same('required lists', all.filter(([, n]) => Array.isArray(n['required'])).map(([p]) => REQUIRED_AT[p] ?? p), Object.keys(v.REQUIRED))
  for (const [path, name] of Object.entries(REQUIRED_AT)) {
    same(`required at ${path || 'top'}`, at(schema, path)?.['required'], v.REQUIRED[name])
  }

  // Enums: every enum in the schema is one of the validator's, and the same values.
  same('enum fields', all.filter(([, n]) => Array.isArray(n['enum'])).map(([p]) => ENUM_AT[p] ?? p), Object.keys(v.ENUMS))
  for (const [path, name] of Object.entries(ENUM_AT)) {
    same(`enum ${name}`, at(schema, path)?.['enum'], v.ENUMS[name])
  }

  // Keys: each object's properties are the validator's known keys, and nothing else is allowed.
  for (const [path, name] of Object.entries(KEYS_AT)) {
    const node = at(schema, path)
    same(`keys at ${path || 'top'}`, Object.keys(node?.['properties'] ?? {}), v.KEYS[name])
    if (node?.['additionalProperties'] !== false) {
      out.push(`keys at ${path || 'top'}: the schema allows other keys`)
    }
  }

  // Patterns and limits.
  same('id pattern', at(schema, 'properties.id')?.['pattern'], v.PATTERNS['id'])
  same('version pattern', at(schema, 'properties.version')?.['pattern'], v.PATTERNS['version'])
  same('colour pattern', at(schema, '$defs.colour')?.['pattern'], v.PATTERNS['colour'])
  same('thumbnail pattern', at(schema, '$defs.thumbnail')?.['pattern'], v.PATTERNS['thumbnail'])
  for (const field of ['name', 'description', 'author']) {
    const node = at(schema, `properties.${field}`)
    same(`${field} minLength`, node?.['minLength'], v.LIMITS[field]?.min)
    same(`${field} maxLength`, node?.['maxLength'], v.LIMITS[field]?.max)
  }
  const shows = at(schema, 'properties.vessel.properties.shows')
  same('shows at least one, each once', [shows?.['minItems'], shows?.['uniqueItems']], [1, true])
  return out
}

const copy = (): Loose => JSON.parse(JSON.stringify(ENGRAM_SCHEMA)) as Loose

describe('engram.schema.json', () => {
  test("its required fields, keys, enums and limits match validate.ts", () => {
    expect(mismatches(ENGRAM_SCHEMA as unknown as Loose)).toEqual([])
  })

  test('a required field added to the schema alone fails', () => {
    const schema = copy()
    schema['required'].push('tags')
    expect(mismatches(schema).length).toBeGreaterThan(0)
    const hud = copy()
    hud['properties']['vessel']['properties']['hud']['required'] = ['show']
    expect(mismatches(hud).length).toBeGreaterThan(0)
  })

  test('a required field added to validate.ts alone fails', () => {
    const v = { ...VALIDATOR, REQUIRED: { ...REQUIRED, engram: [...REQUIRED.engram, 'tags'] } }
    expect(mismatches(copy(), v).length).toBeGreaterThan(0)
  })

  test('an enum value or an enum field added to the schema alone fails', () => {
    const value = copy()
    value['properties']['vessel']['properties']['hud']['properties']['meter']['enum'].push('dial')
    expect(mismatches(value).length).toBeGreaterThan(0)
    const field = copy()
    field['properties']['vessel']['properties']['hud']['properties']['glow'] = { enum: ['soft', 'hard'] }
    expect(mismatches(field).length).toBeGreaterThan(0)
  })

  test('an enum value or an enum field added to validate.ts alone fails', () => {
    const value = { ...VALIDATOR, ENUMS: { ...ENUMS, scene: [...ENUMS.scene, 'hydra'] } }
    expect(mismatches(copy(), value).length).toBeGreaterThan(0)
    const field = { ...VALIDATOR, ENUMS: { ...ENUMS, glow: ['soft', 'hard'] } }
    expect(mismatches(copy(), field).length).toBeGreaterThan(0)
  })
})
