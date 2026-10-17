import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { EidolaAnnounced, EidolaHandoff, EidolaWhere, Mood, Preview, VesselState, VesselView } from '../types'
import { RESTING_ID } from './engrams'
import { BRASS, SCENE_IDS, SELF_SCENE, isSelfDrawn, withDefaults } from './engram-types'
import type { Engram, EngramJson, SceneName } from './engram-types'
import { ENGRAMS_DIR, loadEngrams } from './loader'
import type { Skipped } from './loader'
import { MANIFEST, checkThumbnail, validate } from './validate'
import { CONTRACT, fallbackKey, faultLine, judge, lineOf, sceneKey, slotKey, splitAt } from './handoff'
import type { Fault, Verdict } from './handoff'
import { BLEND_STEPS, blendTestSvg } from './blend-test'
import { MEASURE_EDGE, MEASURE_GROUND, MEASURE_HELP, REFERENCE_PX, bandReport, paneReport, referenceSvg } from './measure'
import { mediaCases } from './media-test'
import { NET_PROBES, PROBE_TIMEOUT_MS, describeOutcome } from './net-probe'
import type { NetProbe, Outcome } from './net-probe'
import {
  DEFAULT_SURFACES,
  OPTION_KEYS,
  SWITCHES,
  SWITCH_HELP,
  drawsIn,
  isSwitch,
  readOnOff,
  readStatusLine,
  readSurfaces,
  showsLabel,
  surfacesLine,
  switchOf,
  whereItDraws,
} from './placement'
import type { Drawing, Surfaces, Switch } from './placement'
import { EMPTY, step } from './resolver'
import type { Model, Signal, TurnEndReason } from './resolver'
import { FACES, SPRITE_PALETTE, vesselSvg } from './sprite'
import { renderScene } from './field'
import { krakenWaterScene } from './kraken'
import { voidScene } from './lich'
import { fenScene } from './wisp'
import { overdrawn } from './drawing'
import type { Draw, DrawKit } from './drawing'
import { draw as drawKraken } from '../engrams/kraken/hooks/draw'
import { draw as drawLich } from '../engrams/lich/hooks/draw'
import { draw as drawWisp } from '../engrams/wisp/hooks/draw'
import { FRAME_GREY, FRAME_STATES, labelSvg } from './hud'
import { SCENES } from './scenes'
import {
  FRESH_PREVIEW,
  SURFACE_ICONS,
  chip,
  divider,
  drawingLine,
  engramPage,
  header,
  label,
  previewRows,
  primaryButton,
  secondaryButton,
  surfaceIcon,
  titleBlock,
} from './engram-page'
import type { Els, Kit } from './engram-page'
import { surfacesPage } from './surfaces-page'
import type { SurfacesControl } from './surfaces-page'
import type { SurfaceIcon } from './icons'
import { THEME } from './theme'
import { BACKDROP, BAND_SCENE_PX, BAND_STAGE_PX, PX_PER_COLUMN, PX_PER_ROW, VEIL, sceneSize, stageSize } from './stage'

const PANE = 'eidola'
const STORE_KEY = 'engram'
/** The name of a removed Engram that was awake, kept until `/eidola` has said so once. */
const REMOVED_KEY = 'removed'
/** Where the frame's toggles are kept between sessions: by Engram id. */
const FRAME_KEY = 'frames'

const viewAtom = atom({ plugin: 'eidola', key: 'view' } as const, {
  state: 'idle',
  detail: '',
} as VesselView)
// The drawings read the mood alone, so a tool's detail never redraws them.
const moodAtom = atom({ plugin: 'eidola', key: 'mood' } as const, 'idle' as Mood)
const engramAtom = atom({ plugin: 'eidola', key: 'engram' } as const, RESTING_ID as string | null)
const mediaAtom = atom({ plugin: 'eidola', key: 'media' } as const, false)
const measureAtom = atom({ plugin: 'eidola', key: 'measure' } as const, false)
const blendAtom = atom({ plugin: 'eidola', key: 'blend' } as const, null as number | null)
const liveAtom = atom({ plugin: 'eidola', key: 'live' } as const, null as Mood | null)
const inkAtom = atom({ plugin: 'eidola', key: 'ink' } as const, 0)
const frameAtom = atom({ plugin: 'eidola', key: 'frame' } as const, {} as Record<string, boolean>)
const pickerAtom = atom({ plugin: 'eidola', key: 'picker' } as const, false)
const pickerFilterAtom = atom({ plugin: 'eidola', key: 'pickerFilter' } as const, 'all' as 'all' | 'pane' | 'band' | 'yours')
const pageAtom = atom({ plugin: 'eidola', key: 'page' } as const, null as string | null)
const previewAtom = atom({ plugin: 'eidola', key: 'preview' } as const, FRESH_PREVIEW as Preview)
const surfacesAtom = atom({ plugin: 'eidola', key: 'surfaces' } as const, false)
const switchedAtom = atom({ plugin: 'eidola', key: 'switched' } as const, 0)
const pluginsAtom = atom({ plugin: 'eidola', key: 'plugins' } as const, 0)
const contractAtom = atom({ plugin: 'eidola', key: 'contract' } as const, CONTRACT)

/** Whether an Engram's HUD frame shows: as the person toggled it, else as it ships. */
function isFramed(frames: Record<string, boolean>, engram: Engram | undefined): boolean {
  return engram ? (frames[engram.id] ?? engram.vessel.hud.show) : false
}
const moodAtAtom = atom({ plugin: 'eidola', key: 'moodAt' } as const, 0)
const moodBeforeAtom = atom({ plugin: 'eidola', key: 'moodBefore' } as const, 'idle' as Mood)
const inkAtAtom = atom({ plugin: 'eidola', key: 'inkAt' } as const, 0)
const epochAtom = atom({ plugin: 'eidola', key: 'epoch' } as const, 0)

const LABELS: Record<VesselState, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  attention: 'Needs you',
  success: 'Done',
  responding: 'Replying',
  error: 'Hit an error',
  waiting: 'Waiting',
  sleeping: 'Asleep',
}

type Timer = ReturnType<EngineInterface['clock']['after']>

/** The state a drawing shows for a mood: its Vessel's idle, working or attention. */
const MOOD_STATE: Record<Mood, VesselState> = { idle: 'idle', working: 'working', attention: 'attention' }

// Resolver bookkeeping. Not drawn, so module variables are fine: a reload
// resets them and the next event puts them right.
let model: Model = EMPTY
let generation = 0
let pending: Timer | undefined
const svgCache = new Map<string, string>()
// Thumbnail files, read once each. null: the file couldn't be read.
const fileCache = new Map<string, string | null>()
/** Cell rows the live band takes: it fills the band's own minimum height. */
const BAND_ROWS = 7
/** The Wisp's band: tall enough for sky, lanterns, the boardwalk and the water under them. */
const WISP_BAND_ROWS = 9
/** The Lich's band: tall enough for brow, eyes, nose and teeth at the pane's scale. */
const LICH_BAND_ROWS = 12

// What the band hook saw and drew last, for /eidola. Not drawn from.
type BandSeen = { surface: string; hasSurvey: boolean; isWorking: boolean; drew: 'engine' | 'strip' | 'strip+survey' | 'beneath+strip' }
let lastBand: BandSeen | undefined

/**
 * Whether what the hooks beneath drew in the band shows nothing: no text, no
 * Svg, no Client, only empty Boxes and Texts (the engine's own answer when
 * no plugin beneath draws). The strip then draws alone, where it always has.
 */
function isBlank(node: unknown): boolean {
  if (node === null || node === undefined || node === false || node === '') {
    return true
  }
  if (Array.isArray(node)) {
    return node.every(isBlank)
  }
  if (typeof node === 'object') {
    const { type, children } = node as { type?: unknown; children?: unknown }
    return (type === 'Box' || type === 'Text') && isBlank(children)
  }
  return false
}
/** Which clock each live drawing keeps, as it reported on starting: for /eidola. */
const liveClocks = new Map<string, string>()
// The scene last built for the pane and the band. A scene's loops are locked
// to the clock when it is built, so it is rebuilt only when its state or
// size changes; a redraw for anything else (a tool's detail) reuses it and
// the surface keeps the running drawing.
const lastScene = new Map<'pane' | 'band', { key: string; svg: string }>()

function sceneFor(where: 'pane' | 'band', key: string, build: () => string): string {
  const last = lastScene.get(where)
  if (last?.key === key) {
    return last.svg
  }
  const svg = build()
  lastScene.set(where, { key, svg })
  return svg
}

// The person's options. A change in /config reloads the module, so these
// are set once per load in register().
let surfaces: Surfaces = DEFAULT_SURFACES
let isStatusLineOn = true

// ── The registry ───────────────────────────────────────────────────────

/**
 * The frames Engrams removed in 0.7.0, by id: v2 draws scenes only. A session
 * whose stored awake id is one of these starts with nothing awake, and
 * `/eidola` says once that it was removed. Migration data, not Engrams.
 */
const REMOVED: Record<string, string> = {
  spirit: 'Spirit',
  skull: 'Skull',
  moon: 'Moon',
  sigil: 'Sigil',
  starfield: 'Starfield',
}

// The Engrams loaded from engrams/<id>/ (hooks/loader.ts), by id, and the
// packages skipped with why. Loaded at session start and on /engrams, and on
// first need by anything that runs before session start; a reload of the
// module loads again, so module variables are fine.
let registry = new Map<string, Engram>()
let skipped: Skipped[] = []
let loading: Promise<void> | undefined

/** Loads the bundled packages afresh. Never rejects: a failure leaves the registry empty. */
function loadRegistry($: EngineInterface): Promise<void> {
  loading = (async () => {
    const out = await loadEngrams({ list: path => $.fs.list(path), read: path => $.fs.read(path) }, `${$.plugin.root}/${ENGRAMS_DIR}`)
    // The Engram plugins found so far stay: they announced, and won't again until they reload.
    for (const [id, engram] of plugged) {
      if (!out.registry.has(id)) {
        out.registry.set(id, engram)
      }
    }
    registry = out.registry
    skipped = out.skipped
    // A package's thumbnails may have changed with it.
    fileCache.clear()
  })().catch(() => undefined)
  return loading
}

/** The registry, loaded once if nothing has loaded it yet. */
async function engramsOf($: EngineInterface): Promise<Map<string, Engram>> {
  await (loading ?? loadRegistry($))
  return registry
}

async function engramOf($: EngineInterface, id: string | null): Promise<Engram | undefined> {
  const engrams = await engramsOf($)
  return id === null ? undefined : engrams.get(id)
}

/** The Engrams in the order they are listed: the resting one first, then by id. */
async function listed($: EngineInterface): Promise<Engram[]> {
  const all = [...(await engramsOf($)).values()]
  return [...all.filter(one => one.id === RESTING_ID), ...all.filter(one => one.id !== RESTING_ID)]
}

/**
 * Drawn, dimmed, while nothing is awake, should the resting Engram's
 * package not load: its scene under the mod's own name.
 */
const UNNAMED_REST: Engram = withDefaults({
  spec: 2,
  id: RESTING_ID,
  name: 'Eidola',
  version: '0.0.0',
  author: 'eidola',
  description: '',
  rights: 'original',
  vessel: { scene: 'wisp' },
})

/** The scene the resting Engram draws: what stands in where no other scene can. */
const RESTING_SCENE: SceneName = 'wisp'

/** The resting Engram: its scene, dimmed, is what shows while nothing is awake. */
async function restingOf($: EngineInterface): Promise<Engram> {
  return (await engramsOf($)).get(RESTING_ID) ?? UNNAMED_REST
}

// ── Engram plugins (docs/spec/engram-plugin.md) ────────────────────────
//
// An Engram plugin announces itself at its session.start ($.eidola.announce),
// or Eidola's plugin.register hook finds it loading after Eidola. Either way
// Eidola reads its engram.json, checks it with the one validator, and adds it
// to the registry. Module variables: a reload of Eidola forgets them, and the
// plugins announce again at the session.start that reload brings.

/** Engram plugins' Engrams, by id. */
const plugged = new Map<string, Engram>()
/**
 * Engram plugins whose engram.json didn't load, by folder, with the plugin's
 * name: /eidola says why, and the Yours view shows each as not loading.
 */
const pluginSkipped = new Map<string, Skipped & { name: string }>()
/**
 * Engrams marked not loading, by id: their drawing threw, drew nothing or ran
 * over its budget. Eidola draws their fallback and stops asking until the
 * plugin announces again (it reloaded) or /engrams reads the Engrams afresh.
 */
const faults = new Map<string, Fault>()

/** The built-in scene Eidola draws for an Engram: its own, or for an Engram plugin's the one it was remixed from. */
function builtInScene(engram: Engram): SceneName | undefined {
  if (!isSelfDrawn(engram)) {
    return engram.vessel.scene as SceneName
  }
  const base = engram.remixOf === undefined ? undefined : registry.get(engram.remixOf)
  return base && !isSelfDrawn(base) && (SCENE_IDS as readonly string[]).includes(base.vessel.scene) ? (base.vessel.scene as SceneName) : undefined
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A plugin.json or hooks.json, parsed; undefined when it can't be read. */
async function readJson($: EngineInterface, path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const value: unknown = JSON.parse((await $.fs.read(path)).replace(/^﻿/, ''))
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads an Engram plugin's engram.json from its folder, checks it, and adds
 * its Engram to the registry; the Engram awake when the session started is
 * woken if it announced late. Never rejects: what fails is in `issues`.
 */
async function adopt($: EngineInterface, root: string): Promise<EidolaAnnounced> {
  const dir = root.replace(/[\\/]+$/, '')
  const forget = () => {
    for (const [id, one] of plugged) {
      if (one.plugin?.root === dir) {
        plugged.delete(id)
        registry.delete(id)
      }
    }
  }
  const refuse = async (issues: Skipped['issues']): Promise<EidolaAnnounced> => {
    forget()
    pluginSkipped.set(dir, { folder: dir, issues, name })
    await update($, pluginsAtom, n => n + 1)
    return { contract: CONTRACT, engram: null, issues: issues.map(({ file, problem, fix }) => ({ file, problem, fix })) }
  }
  const manifest = await readJson($, `${dir}/.claude-plugin/plugin.json`)
  const name = typeof manifest?.['name'] === 'string' ? manifest['name'] : ''
  const hooks = await readJson($, `${dir}/hooks/hooks.json`)
  const first = Array.isArray(hooks?.['modules']) ? (hooks['modules'] as unknown[])[0] : undefined
  const module = typeof first === 'string' ? `hooks/${first.replace(/^\.\//, '')}` : 'hooks/register.tsx'
  let text: string
  try {
    text = await $.fs.read(`${dir}/${MANIFEST}`)
  } catch (error) {
    return refuse([
      {
        rule: 'manifest',
        file: MANIFEST,
        problem: `engram.json couldn't be read (${message(error)}).`,
        fix: "Put an engram.json at the top of the plugin's folder, beside .claude-plugin/ (docs/spec/engram-plugin.md).",
      },
    ])
  }
  let id: unknown
  try {
    id = (JSON.parse(text.replace(/^﻿/, '')) as { id?: unknown }).id
  } catch {
    id = undefined
  }
  const bundled = [...(await engramsOf($)).values()].filter(one => one.plugin === undefined).map(one => one.id)
  // An Engram plugin's folder is named by where it was installed, not by its id: the id stands alone.
  const report = validate({ folder: typeof id === 'string' ? id : 'engram', files: { [MANIFEST]: text } }, { scenes: [SELF_SCENE], reserved: bundled, thumbnails: false })
  if (report.errors.length) {
    return refuse(report.errors)
  }
  const engram: Engram = { ...withDefaults(JSON.parse(text.replace(/^﻿/, '')) as EngramJson), plugin: { name, root: dir, module } }
  const other = plugged.get(engram.id)
  if (other && other.plugin?.root !== dir) {
    return refuse([{ rule: 'id', file: MANIFEST, problem: `The Engram plugin ${other.plugin?.name || other.plugin?.root} already has the id ${engram.id}.`, fix: 'Give this one its own id.' }])
  }
  forget()
  plugged.set(engram.id, engram)
  registry.set(engram.id, engram)
  pluginSkipped.delete(dir)
  faults.delete(engram.id)
  for (const key of [...fileCache.keys()].filter(key => key.startsWith(`${engram.id}/`))) {
    fileCache.delete(key)
  }
  for (const key of [...thumbCache.keys()].filter(key => key.startsWith(`${engram.id}:`))) {
    thumbCache.delete(key)
  }
  await update($, pluginsAtom, n => n + 1)
  // Awake when the session started, before the plugin had announced: it wakes now.
  const stored = await $.store.get(STORE_KEY).catch(() => undefined)
  if (stored === engram.id && (await read($, engramAtom)) === null) {
    await update($, engramAtom, () => engram.id)
  }
  return { contract: CONTRACT, engram: engram.id, issues: [] }
}

/** What Eidola hands the awake Engram's plugin: the room it has, and the state it draws from. */
async function handoffOf($: EngineInterface, engram: Engram, where: EidolaWhere, columns: number, rows: number): Promise<EidolaHandoff> {
  return {
    contract: CONTRACT,
    engram: engram.id,
    where,
    columns,
    rows,
    mood: await read($, moodAtom),
    moodBefore: await read($, moodBeforeAtom),
    moodAt: await read($, moodAtAtom),
    ink: await read($, inkAtom),
    inkAt: await read($, inkAtAtom),
    epoch: await read($, epochAtom),
  }
}

/**
 * Judges what came back from the hand-off (handoff.ts), with any fault the
 * plugin reported meanwhile, and marks the Engram not loading on a fault.
 */
function verdictOf(engram: Engram, got: unknown, trace: Parameters<typeof judge>[0]['trace'], tookMs: number): Verdict {
  const reported = faults.get(engram.id)
  if (reported) {
    return { fault: reported }
  }
  const verdict = judge({ engram: engram.id, plugin: engram.plugin?.name ?? '', module: engram.plugin?.module ?? 'hooks/register.tsx', got, trace, tookMs })
  if ('fault' in verdict) {
    faults.set(engram.id, verdict.fault)
  }
  return verdict
}

/**
 * The drawing an Engram plugin's Engram gets, `cols` × `rows`: the plugin's
 * own; else its fallback (the Engram it was remixed from, a still of its
 * scene, or the resting sprite) in a slot a plugin above Eidola fills, or,
 * marked not loading, in a slot no plugin fills.
 */
async function slotFor(
  $: EngineInterface,
  els: Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>,
  isRich: boolean,
  engram: Engram,
  cols: number,
  rows: number,
  where: EidolaWhere,
  verdict: Verdict,
): Promise<RenderElement> {
  if ('tree' in verdict) {
    return verdict.tree
  }
  const { Box, Text, Svg } = els
  const key = 'fault' in verdict ? fallbackKey(engram.id) : slotKey(engram.id)
  const state = MOOD_STATE[await read($, moodAtom)]
  if (!isRich) {
    return (
      <Box key={key} width={cols} height={rows}>
        <Text>{FACES[state]}</Text>
      </Box>
    )
  }
  const width = Math.max(16, cols * PX_PER_COLUMN)
  const height = Math.max(16, rows * PX_PER_ROW)
  const scene = builtInScene(engram)
  if (scene) {
    const view = where === 'pane' && height > width * 1.1 ? 'pane' : 'band'
    const now = await $.clock.now()
    const svg = sceneFor(where, `fallback:${engram.id}:${scene}:${view}:${state}:${width}x${height}`, () => renderScene(SCENES[scene][view](state, width, height), now))
    return (
      <Box key={key} width={cols} height={rows} overflow="hidden">
        <Svg key={`fallback:${scene}`} source={svg} alt={`${engram.name}, drawn as the ${engram.remixOf} it was remixed from: ${LABELS[state]}`} width={width} height={height} isInteractive />
      </Box>
    )
  }
  const size = Math.max(16, Math.min(width, height, 160))
  return (
    <Box key={key} width={cols} height={rows} alignItems="center" justifyContent="center" backgroundColor={BACKDROP}>
      <Svg key={`fallback:sprite:${state}`} source={spriteSvg(state, size)} alt={`${engram.name}, drawn as the resting sprite: ${LABELS[state]}`} width={size} height={size} isInteractive />
    </Box>
  )
}

/** /eidola's lines on Engram plugins: those that didn't load, and those marked not loading. */
function pluginLines(): string[] {
  return [
    ...[...pluginSkipped.values()].flatMap(one => [`Engram plugin at ${one.folder} didn't load:`, ...one.issues.map(issue => `  ${issue.file}: ${issue.problem} ${issue.fix}`)]),
    ...[...faults].map(([id, fault]) => {
      const engram = plugged.get(id)
      return `Not loading: ${engram?.name ?? id}, from ${engram?.plugin?.name || engram?.plugin?.root || 'its plugin'}. ${faultLine(fault)} Eidola draws ${engram && builtInScene(engram) ? `the ${engram.remixOf} it was remixed from` : 'the resting sprite'} instead.`
    }),
  ]
}

/** Where a fault is: its file, and its line where it has one. */
function faultPlace(fault: Fault): string {
  return fault.line === undefined ? fault.file : `${fault.file}:${fault.line}`
}

/** An Engram plugin that didn't load, by name: its plugin's, else its folder's. */
function skippedName(one: Skipped & { name: string }): string {
  return one.name || one.folder.split(/[\\/]/).pop() || one.folder
}

/**
 * /eidola's Engrams line: how many are bundled, how many are yours (Engram
 * plugins, those that don't load included), and each of yours not loading,
 * with its file and line.
 */
function engramsLine(engrams: Map<string, Engram>): string {
  const all = [...engrams.values()]
  const bundled = all.filter(one => one.plugin === undefined).length
  const yours = all.length - bundled + pluginSkipped.size
  const broken = [
    ...[...faults].map(([id, fault]) => `${plugged.get(id)?.name ?? id} at ${faultPlace(fault)}`),
    ...[...pluginSkipped.values()].map(one => `${skippedName(one)} at ${one.issues[0]?.file ?? MANIFEST}`),
  ]
  return `Engrams: ${bundled} bundled, ${yours} yours${broken.length ? `, ${broken.length} not loading: ${broken.join('; ')}` : ''}.`
}

/** The built-in sprite for a state, at a size: the media test's control. */
function spriteSvg(state: VesselState, size: number): string {
  const key = `sprite:${state}:${size}`
  let svg = svgCache.get(key)
  if (svg === undefined) {
    svg = vesselSvg(state, SPRITE_PALETTE, size)
    svgCache.set(key, svg)
  }
  return svg
}

/** How much of the resting scene the veil hides while nothing is awake. */
const RESTING_DIM = 0.55

/** A scene dimmed under a veil of the dark: the resting Wisp's, while nothing is awake. */
function dimmed(svg: string): string {
  return svg.replace(/<\/svg>$/, `<rect width="100%" height="100%" fill="${VEIL}" opacity="${RESTING_DIM}"/></svg>`)
}

/**
 * A still sized to fill a `width` × `height` box edge to edge: kept in
 * proportion and centred, what overflows the box cut off, as a cover image.
 */
function filling(svg: string, width: number, height: number): string {
  return svg.replace(/^<svg\b[^>]*>/, tag =>
    tag
      .replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '')
      .replace(/>$/, ` width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">`),
  )
}

/** One probe, never rejecting: the line says what happened. */
async function probeLine($: EngineInterface, probe: NetProbe): Promise<string> {
  let timer: Timer | undefined
  const timeout = new Promise<Outcome>(resolve => {
    timer = $.clock.after(PROBE_TIMEOUT_MS, () => resolve({ kind: 'timeout' }))
  })
  const fetched = $.http
    .fetch(probe.url, { method: 'GET' })
    .then((res): Outcome => ({ kind: 'status', status: res.status }))
    .catch((error: unknown): Outcome => ({
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    }))
  const outcome = await Promise.race([fetched, timeout])
  timer?.cancel()
  return describeOutcome(probe, outcome)
}

function setStatus($: EngineInterface, text: string | undefined): void {
  $.ui.status(isStatusLineOn ? text : undefined)
}

/**
 * Where the awake Engram draws now (the resting one while nothing is awake),
 * from the surfaces setting and whether the pane is open.
 */
async function drawingNow($: EngineInterface, isPaneOpen: boolean): Promise<Drawing> {
  const engram = (await engramOf($, await read($, engramAtom))) ?? (await restingOf($))
  return whereItDraws(surfaces, engram, isPaneOpen)
}

/** An Engram that doesn't show in the pane: opened by hand, the pane draws its band view. */
function drawsBandViewInPane(engram: Engram | undefined): boolean {
  return engram !== undefined && whereItDraws(surfaces, engram, true).paneView === 'band'
}

async function show($: EngineInterface, view: VesselView): Promise<void> {
  const current = await read($, viewAtom)
  if (current.state === view.state && current.detail === view.detail) {
    return
  }
  await update($, viewAtom, () => view)
  const engram = await engramOf($, await read($, engramAtom))
  setStatus($, engram ? `${engram.name} · ${LABELS[view.state].toLowerCase()}` : undefined)
}

/** The sigil's size in cells: about 56 px square. */
const SIGIL_COLS = 7
const SIGIL_ROWS = 3
/**
 * Where the sigil's ring sits in its rows, in px from their top: from the
 * state label's cap height to the foot of the detail line under it, as
 * measured on the desktop, so it stands level with both lines of text.
 */
const SIGIL_SPAN = { top: 8, bottom: 52 }

/** How busy a HUD's recording runs in a state. */
function waveLevel(state: VesselState): 'idle' | 'working' | 'attention' {
  return state === 'attention' ? 'attention' : state === 'thinking' || state === 'working' || state === 'responding' || state === 'error' ? 'working' : 'idle'
}

/** The frame's brass: its brackets and its quieter lines. */
const FRAME_GOLD = BRASS

/**
 * The Vessel in a HUD frame: brackets at three corners, its state in its
 * colour with the detail under it, the Engram's name at the top right, and
 * a level meter in the bottom left.
 */
function framed(
  els: Pick<Elements['desktop'], 'Box' | 'Text' | 'Client' | 'Svg'>,
  tree: RenderElement,
  cols: number,
  rows: number,
  view: VesselView,
  awake: Engram | undefined,
): RenderElement {
  const { Box, Text, Client, Svg } = els
  const own = awake?.vessel.hud.colours[view.state]
  const look = { ...FRAME_STATES[view.state], colour: own?.label ?? FRAME_STATES[view.state].colour }
  const detailColour = own?.detail ?? FRAME_GREY
  const width = Math.max(4, cols - 6)
  const clip = (text: string) => (text.length > width ? text.slice(0, width - 1) + '…' : text)
  const detail = clip((view.detail || look.line).toLowerCase())
  const hud = awake?.vessel.hud
  const tag = (awake?.name ?? 'Eidola').toUpperCase()
  const isBottom = hud?.layout === 'bottom'
  const label = labelSvg(look.name, look.colour, hud?.label, isBottom ? 'small' : 'large')
  const at = (key: string, top: number, left: number, child: RenderElement) => (
    <Box key={key} position="absolute" top={top} left={left}>
      {child}
    </Box>
  )
  // A bracket is two thin bars of brass, the same length and weight each way:
  // drawn as Boxes, not glyphs, so no font can make them uneven.
  const brass = awake?.vessel.hud?.bracket ?? FRAME_GOLD
  const bracket = (key: string, top: number, left: number, isRight: boolean, isBottom: boolean) => {
    // A cell is 8 × 19 px: 8% of its height and 10% of its 2-cell width are both about 1.5 px.
    const across = <Box key="across" width="100%" height="8%" backgroundColor={brass} />
    const down = (
      <Box key="down" flexDirection="row" height="92%" justifyContent={isRight ? 'flex-end' : 'flex-start'}>
        <Box width="10%" height="100%" backgroundColor={brass} />
      </Box>
    )
    return at(
      key,
      top,
      left,
      <Box flexDirection="column" width={2} height={1}>
        {isBottom ? [down, across] : [across, down]}
      </Box>,
    )
  }
  return (
    <Box width={cols} height={rows}>
      {tree}
      {bracket('frame-tl', 0, 0, false, false)}
      {bracket('frame-tr', 0, cols - 2, true, false)}
      {bracket('frame-bl', rows - 1, 0, false, true)}
      {/* The bottom-right corner is the picker's triangle, drawn over every desktop pane. */}
      {/* The state and its detail: large at the top left, or small on the bottom row, the detail at its right. */}
      {isBottom
        ? // Both in the band's last two rows, centred in them: the water, under the waterline.
          at(
            'frame-state',
            rows - 2,
            3,
            <Box width={cols - 7} height={2} flexDirection="row" alignItems="center" justifyContent="space-between">
              <Svg key={`frame-label:${view.state}:${awake?.vessel.hud?.label ?? 'bold'}:s`} source={label.svg} alt={look.name} width={label.width} height={label.height} />
              <Text key="frame-detail" color={detailColour}>
                {detail}
              </Text>
            </Box>,
          )
        : [
            at(
              'frame-state',
              1,
              3,
              <Box width={Math.ceil(label.width / PX_PER_COLUMN)} height={2}>
                <Svg key={`frame-label:${view.state}:${awake?.vessel.hud?.label ?? 'bold'}:l`} source={label.svg} alt={look.name} width={label.width} height={label.height} />
              </Box>,
            ),
            at('frame-detail', 3, 3, <Text color={detailColour}>{detail}</Text>),
          ]}
      {cols >= 44 &&
        awake?.vessel.hud?.tag !== 'none' &&
        (awake?.vessel.hud?.tag === 'livecam'
          ? at('frame-tag', 1, cols - 23, <Client key="frame-cam" module="./frame-cam.tsx" props={{ name: tag, camera: awake.vessel.hud.camera ?? 'CAM 01' }} width={20} height={2} />)
          : awake?.vessel.hud?.tag === 'sigil'
            ? at(
                'frame-tag',
                1,
                cols - 3 - SIGIL_COLS,
                <Client key="frame-sigil" module="./frame-sigil.tsx" props={{ colour: look.colour, level: waveLevel(view.state), cols: SIGIL_COLS, rows: SIGIL_ROWS, ...SIGIL_SPAN }} width={SIGIL_COLS} height={SIGIL_ROWS} />,
              )
            : at('frame-tag', 1, cols - tag.length - 3, <Text color={FRAME_GOLD}>{tag}</Text>))}
      {rows >= 6 &&
        awake?.vessel.hud?.meter !== 'none' &&
        (awake?.vessel.hud?.meter === 'wave'
          ? at(
              'frame-wave',
              rows - 3,
              2,
              <Client key="frame-wave" module="./frame-wave.tsx" props={{ colour: look.colour, level: waveLevel(view.state), cols: cols - 4 }} width={cols - 4} height={3} />,
            )
          : awake?.vessel.hud?.meter === 'sparks'
            ? at(
                'frame-sparks',
                rows - 6,
                2,
                <Client key="frame-sparks" module="./frame-sparks.tsx" props={{ colour: look.colour, level: waveLevel(view.state), cols: cols - 4, rows: 5 }} width={cols - 4} height={5} />,
              )
          : at('frame-meter', rows - 2, 3, <Client key="frame-meter" module="./frame-meter.tsx" props={{ state: view.state, colour: look.colour }} width={12} height={1} />))}
    </Box>
  )
}

/** Something went wrong: count it, and when. */
async function bumpInk($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, inkAtom, n => n + 1)
  await update($, inkAtAtom, () => at)
}

// ── The bundled three's drawings ───────────────────────────────────────
//
// Each bundled Engram draws through its own drawing module,
// engrams/<id>/hooks/draw.tsx, given the hand-off an Engram plugin is given
// (hooks/drawing.ts). Eidola calls it directly: the code is its own. An
// Engram plugin exported from one (scripts/export-engram.mjs) calls the same
// module from its own hooks.

/** The bundled Engrams' drawing modules, by scene. */
const DRAWINGS: Record<SceneName, Draw> = { kraken: drawKraken, lich: drawLich, wisp: drawWisp }

/** What a drawing is given besides the hand-off: the name, the clock, and the pane's or band's backdrop cache. */
async function drawKit($: EngineInterface, engram: Engram, where: EidolaWhere): Promise<DrawKit> {
  return { name: engram.name, now: await $.clock.now(), memo: (key, build) => sceneFor(where, key, build) }
}

/** A bundled Engram's creature, `cols` × `rows`, drawn by its drawing module from the hand-off. */
async function drawBundled(
  $: EngineInterface,
  els: Elements['desktop'],
  engram: Engram,
  scene: SceneName,
  where: EidolaWhere,
  cols: number,
  rows: number,
): Promise<RenderElement> {
  return DRAWINGS[scene](els, await handoffOf($, engram, where, cols, rows), await drawKit($, engram, where))
}

/** A drawing with one more child after its own: the band's corner over a creature's strip. */
function withChild(tree: RenderElement, child: RenderElement): RenderElement {
  const own = (tree as { children?: unknown }).children
  const children = Array.isArray(own) ? own : own === undefined ? [] : [own]
  return { ...tree, children: [...children, child] } as RenderElement
}

/**
 * The rows a band drawing takes for a scene: the Lich's as tall as the band
 * allows up to twelve (fewer, and its face is a smear), the Wisp's tall
 * enough for sky, lanterns, boardwalk and water, the rest the band's own.
 * An Engram plugin's band gets its remixOf scene's, so a remix draws as tall
 * as the Engram it came from.
 */
function bandRows(scene: SceneName | undefined, hasSurvey: boolean, maxRows: number): number {
  if (scene === 'lich') {
    return hasSurvey ? BAND_ROWS : Math.max(BAND_ROWS, Math.min(LICH_BAND_ROWS, maxRows))
  }
  return scene === 'wisp' ? WISP_BAND_ROWS : BAND_ROWS
}

/**
 * The Wisp in its fen, `cols` wide and its band's rows tall, by its drawing
 * module, in its HUD when that is on. Drawn in the band, and in the pane when
 * the pane is opened by hand.
 */
async function fenView($: EngineInterface, els: Elements['desktop'], awake: Engram, cols: number, where: 'pane' | 'band'): Promise<RenderElement> {
  const rows = WISP_BAND_ROWS
  const tree = await drawBundled($, els, awake, 'wisp', where, cols, rows)
  return isFramed(await read($, frameAtom), awake) ? framed(els, tree, cols, rows, await read($, viewAtom), awake) : tree
}

/**
 * An Engram's band view, drawn in the pane for one that doesn't show there:
 * the Wisp's fen, or any other scene's band view as a still strip.
 */
async function bandView($: EngineInterface, els: Elements['desktop'], awake: Engram, cols: number, where: 'pane' | 'band'): Promise<RenderElement> {
  if (awake.vessel.scene === 'wisp') {
    return fenView($, els, awake, cols, where)
  }
  const { Svg } = els
  const state = MOOD_STATE[await read($, moodAtom)]
  const width = Math.max(96, cols * PX_PER_COLUMN - 4)
  const height = BAND_SCENE_PX
  const now = await $.clock.now()
  const views = SCENES[builtInScene(awake) ?? RESTING_SCENE]
  const scene = sceneFor(where, `band-view:${state}:${width}x${height}`, () => renderScene(views.band(state, width, height), now))
  return <Svg key="scene:band-view" source={scene} alt={`${awake.name}: ${LABELS[state]}`} width={width} height={height} isInteractive />
}

// Every hook goes through here, and nothing here may break a tool call or
// a turn: failures are swallowed and the Vessel just misses a beat.
async function signal($: EngineInterface, s: Signal): Promise<void> {
  try {
    const out = step(model, s)
    model = out.model
    generation += 1
    const mine = generation
    pending?.cancel()
    pending = undefined
    if ((await read($, moodAtom)) !== model.mood) {
      const mood = model.mood
      const at = await $.clock.now()
      const before = await read($, moodAtom)
      await update($, moodBeforeAtom, () => before)
      await update($, moodAtom, () => mood)
      await update($, moodAtAtom, () => at)
    }
    // Something went wrong: the live Kraken inks; the Lich is scorched.
    if ((s.kind === 'toolEnd' && !s.isOk) || (s.kind === 'turnEnd' && (s.reason === 'error' || s.reason === 'refusal'))) {
      await bumpInk($)
    }
    await show($, out.view)
    if (out.then) {
      const later = out.then.view
      pending = $.clock.after(out.then.ms, () => {
        if (generation === mine) {
          void show($, later).catch(() => undefined)
        }
      })
    }
  } catch {
    // The Vessel is decoration; never let it cost the session anything.
  }
}

async function setEngram($: EngineInterface, id: string | null): Promise<void> {
  await $.store.set(STORE_KEY, id)
  await update($, engramAtom, () => id)
  const engram = await engramOf($, id)
  setStatus($, engram ? `${engram.name} · awake` : undefined)
  // An open pane is retitled with the new name; a closed one stays closed.
  // One that doesn't show in the pane never keeps it open by itself: it closes.
  try {
    const panes = await $.ui.panes()
    if (panes.some(one => one.id === PANE)) {
      if (drawsBandViewInPane(engram)) {
        await update($, pickerAtom, () => false)
        await update($, pageAtom, () => null)
        await $.ui.close({ id: PANE })
      } else {
        await $.ui.open({ id: PANE, title: paneTitle(engram) })
      }
    }
  } catch {
    // The old title is only cosmetic.
  }
  // A different Engram may draw on different surfaces.
  $.ui.invalidate('ui.render')
}

/** The pane's title: the awake Engram's name, else Eidola. */
function paneTitle(engram: Engram | undefined): string {
  return engram ? engram.name : 'Eidola'
}

// With "hide the band while the pane is open" on, the band steps aside while
// the pane is placed. Every open and close redraws it to keep that true.
async function isPanePlaced($: EngineInterface): Promise<boolean> {
  try {
    const panes = await $.ui.panes()
    return panes.some(one => one.id === PANE && one.isPlaced)
  } catch {
    // Can't tell: show the band rather than risk showing no Vessel at all.
    return false
  }
}

async function openPane($: EngineInterface) {
  const opened = await $.ui.open({ id: PANE, title: paneTitle(await engramOf($, await read($, engramAtom))) })
  $.ui.invalidate('ui.render')
  return opened
}

function listText(engrams: Engram[], active: string | null): string {
  return engrams
    .map(one => {
      const mark = one.id === active ? ' (awake)' : ''
      return `${one.id}${mark}: ${one.description}`
    })
    .join('\n')
}

/** The status line's switch in `/eidola place` and on the Surfaces screen: its option, and what it does. */
const STATUS_OPTION = 'statusLine'
const STATUS_HELP = "the Engram's name and state in the status line"

/** `/eidola place`: the switches, and how to set one. */
function placeText(): string {
  const switches = SWITCHES.map(one => `  ${one} ${switchOf(surfaces, one) ? 'on' : 'off'}: ${SWITCH_HELP[one]}`).join('\n')
  const status = `  status ${isStatusLineOn ? 'on' : 'off'}: ${STATUS_HELP}`
  return `Surfaces: ${surfacesLine(surfaces)}.\n${switches}\n${status}\nSet one with /eidola place <switch> on|off, e.g. /eidola place band off.`
}

/** Each surfaces switch's field in the setting. */
const SWITCH_FIELDS: Record<Switch, keyof Surfaces> = { pane: 'pane', band: 'band', hide: 'hideBand' }

/**
 * Writes one switch, as the person's own /config choice: the same option
 * whether `/eidola place` or the Surfaces screen sets it. The engine reloads
 * the module with it; until then this load takes the new value too, so the
 * screen redraws with it at once. Resolves to the refusal, if any.
 */
async function writeSwitch($: EngineInterface, control: SurfacesControl, isOn: boolean): Promise<string | undefined> {
  const option = control === 'status' ? STATUS_OPTION : OPTION_KEYS[control]
  let written: Awaited<ReturnType<EngineInterface['config']['set']>>
  try {
    written = await $.config.set({ key: `eidola.${option}`, value: isOn })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  if ('deny' in written && written.deny !== undefined) {
    return written.deny
  }
  if (control === 'status') {
    isStatusLineOn = isOn
    const engram = await engramOf($, await read($, engramAtom))
    $.ui.status(isOn && engram ? `${engram.name} · ${LABELS[(await read($, viewAtom)).state].toLowerCase()}` : undefined)
  } else {
    surfaces = { ...surfaces, [SWITCH_FIELDS[control]]: isOn }
  }
  // The pane reads this count, so it redraws with the new value now.
  await update($, switchedAtom, n => n + 1)
  $.ui.invalidate('ui.render')
  return undefined
}

// ── The Eidola skill (skills/eidola-engram/SKILL.md) ────────────────────
//
// /eidola new, remix, edit, fix and publish each start the skill on that task,
// and so do the picker's and the Engram page's buttons (Create, Edit, Fix,
// Remix, Publish with Claude):
// the skill's own slash command, run with `$.command.run` (docs/spec/
// engram-plugin.md, Starting Claude from a pane button), not awaited, since
// it runs once the session is idle. Where the engine won't run it, the same
// command is put in the prompt box for the person to send.

/** The skill's folder name: a plugin's skill runs as /<plugin>:<skill>. */
const SKILL = 'eidola-engram'
const SKILL_COMMAND = `eidola:${SKILL}`

/** The tasks /eidola starts the skill on, and what each needs. */
const SKILL_TASKS = {
  new: { needs: 'nothing', what: 'make a new Engram from nothing' },
  remix: { needs: 'any', what: 'remix' },
  edit: { needs: 'yours', what: 'change' },
  fix: { needs: 'yours', what: 'fix' },
  publish: { needs: 'yours', what: 'publish' },
} as const

/** What a bundled Engram can't be, for edit, fix and publish. */
const IN_PLACE: Record<'edit' | 'fix' | 'publish', string> = { edit: 'changed', fix: 'fixed', publish: 'published' }
type SkillTask = keyof typeof SKILL_TASKS

function isSkillTask(value: string): value is SkillTask {
  return Object.hasOwn(SKILL_TASKS, value)
}

/** The skill's command as this session lists it: /eidola:eidola-engram, or the bare name where the engine lists it so. */
async function skillCommand($: EngineInterface): Promise<string> {
  try {
    const commands = await $.command.list()
    const found =
      commands.find(one => one.name === SKILL_COMMAND) ??
      commands.find(one => one.name === SKILL && (one.plugin === undefined || one.plugin === 'eidola')) ??
      commands.find(one => one.name.endsWith(`:${SKILL}`))
    if (found) {
      return found.name
    }
  } catch {
    // The list out of reach: the name a plugin's skill runs by.
  }
  return SKILL_COMMAND
}

/**
 * Starts the skill with `args`, once the session is idle. Never waits on it
 * and never rejects. The engine refuses `$.command.run` from inside a
 * `command.run` hook (it would wait on the turn that hook holds), so the run
 * is made from a timer, after /eidola has answered.
 */
async function startSkill($: EngineInterface, args: string): Promise<string> {
  const command = await skillCommand($)
  $.clock.after(0, () => {
    void $.command.run({ command, args }).catch(() => $.prompt.fill({ text: `/${command} ${args}` }).catch(() => undefined))
  })
  return command
}

/**
 * /eidola new|remix|edit|fix|publish: the skill started on that task, or why
 * not. Remix takes any Engram's id; edit, fix and publish only an Engram plugin's
 * (one of the person's), since a bundled Engram lives in Eidola's own folder.
 * Fix also takes an Engram plugin whose engram.json didn't load, by name or
 * folder, and passes its folder, as the picker's Fix with Claude does.
 */
async function skillTaskText($: EngineInterface, task: SkillTask, raw: string): Promise<string> {
  const [, given = '', ...rest] = raw.trim().split(/\s+/)
  const spec = SKILL_TASKS[task]
  if (spec.needs === 'nothing') {
    const command = await startSkill($, `new ${raw.trim().slice(task.length).trim()}`.trim())
    return `Starting the Eidola skill (/${command}) to ${spec.what}. Describe the creature when it asks.`
  }
  const id = given.toLowerCase()
  const engrams = await listed($)
  const list = listText(engrams, await read($, engramAtom))
  if (!id) {
    return `Say which Engram: /eidola ${task} <engram>.\n${list}`
  }
  const engram = engrams.find(one => one.id === id)
  // fix also takes an Engram plugin whose engram.json didn't load, as the picker's Fix does: it has no id, so its folder goes.
  const unread = !engram && task === 'fix' ? skippedNamed(raw.trim().slice(task.length).trim()) : undefined
  if (unread) {
    const command = await startSkill($, `fix ${folderArg(unread.folder)}`)
    return `Starting the Eidola skill (/${command}) to fix the Engram plugin at ${unread.folder}.`
  }
  if (!engram) {
    const skipped = task === 'fix' ? [...pluginSkipped.values()].map(one => `${skippedName(one)}: didn't load, at ${one.folder}`) : []
    return `No Engram called "${id}". Engrams:\n${list}${skipped.length ? `\nEngram plugins that didn't load (/eidola fix <name or folder>):\n${skipped.join('\n')}` : ''}`
  }
  if (spec.needs === 'yours' && engram.plugin === undefined) {
    return `${engram.name} is bundled with Eidola: it can't be ${IN_PLACE[task as keyof typeof IN_PLACE]} in place. /eidola remix ${id} makes one of your own from it.`
  }
  const command = await startSkill($, [task, id, ...rest].join(' '))
  return `Starting the Eidola skill (/${command}) to ${spec.what} ${engram.name}.`
}

/** Whether the session draws on the desktop app, where `/engrams` and `/eidola place` open their screens. */
async function isOnDesktop($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.surfaces()).includes('desktop')
  } catch {
    return false
  }
}

// ── The picker and an Engram's page ────────────────────────────────────

/**
 * Back from the picker (or a page) to the awake Engram: in the pane, or, for
 * one that doesn't show in the pane, back to the band, the pane closed.
 */
async function closePicker($: EngineInterface, awake: Engram | undefined): Promise<void> {
  await update($, pickerAtom, () => false)
  await update($, pageAtom, () => null)
  await update($, surfacesAtom, () => false)
  if (drawsBandViewInPane(awake)) {
    await $.ui.close({ id: PANE }).catch(() => undefined)
  }
}

/** Whether the pane shows one of the mod's screens: the picker, a page or Surfaces. */
async function isScreenOpen($: EngineInterface): Promise<boolean> {
  return (await read($, pickerAtom)) || (await read($, pageAtom)) !== null || (await read($, surfacesAtom))
}

/** Opens an Engram's page, its preview fresh: idle, nothing scorched. */
async function openPage($: EngineInterface, id: string): Promise<void> {
  await update($, previewAtom, () => FRESH_PREVIEW)
  await update($, surfacesAtom, () => false)
  await update($, pageAtom, () => id)
}

/** Back from a page: to the picker it was opened over, else to the awake Engram. */
async function closePage($: EngineInterface, awake: Engram | undefined): Promise<void> {
  if (await read($, pickerAtom)) {
    await update($, pageAtom, () => null)
  } else {
    await closePicker($, awake)
  }
}

/** The Surfaces button and link: the Surfaces screen opens over the screen they are on. */
async function showSurfaces($: EngineInterface): Promise<void> {
  await update($, surfacesAtom, () => true)
}

/** Back from Surfaces: to the page or picker under it, else to the awake Engram. */
async function closeSurfaces($: EngineInterface, awake: Engram | undefined): Promise<void> {
  if ((await read($, pickerAtom)) || (await read($, pageAtom)) !== null) {
    await update($, surfacesAtom, () => false)
  } else {
    await closePicker($, awake)
  }
}

/** A control on the Surfaces screen: its option written; a refusal said in a toast. */
async function setFromScreen($: EngineInterface, control: SurfacesControl, isOn: boolean): Promise<void> {
  const deny = await writeSwitch($, control, isOn)
  if (deny !== undefined) {
    $.ui.toast(`Couldn't change the ${control} switch here (${deny}). Set it in /config instead.`)
  }
}

/** The Surfaces screen, its controls wired. */
function surfacesScreen($: EngineInterface, kit: Kit, awake: Engram | undefined): RenderElement {
  return surfacesPage(kit, {
    surfaces,
    isStatusLineOn,
    back: { onPress: () => void closeSurfaces($, awake) },
    onSet: (control, isOn) => void setFromScreen($, control, isOn),
  })
}

/** A preview mood chip: the preview takes the mood; the session's is left alone. */
async function setPreviewMood($: EngineInterface, mood: Mood): Promise<void> {
  const at = await $.clock.now()
  await update($, previewAtom, was => ({ ...was, isError: false, mood, moodBefore: was.mood, moodAt: was.mood === mood ? was.moodAt : at }))
}

/** The preview's Error button: the preview shows the error and its Engram takes it; the session's ink is left alone. */
async function previewError($: EngineInterface): Promise<void> {
  const at = await $.clock.now()
  await update($, previewAtom, was => ({ ...was, isError: true, ink: was.ink + 1, inkAt: at }))
}

/** Which Engrams the picker lists: all, those that draw in a pane, those that draw in the band, yours. */
const PICKER_FILTERS = ['all', 'pane', 'band', 'yours'] as const
type PickerFilter = (typeof PICKER_FILTERS)[number]
const FILTER_LABELS: Record<PickerFilter, string> = { all: 'All', pane: 'Pane', band: 'Band', yours: 'Yours' }

/** Whether an Engram is one of the person's: an Engram plugin, not one bundled with Eidola. */
function isYours(engram: Engram): boolean {
  return engram.plugin !== undefined
}

/** Whether an Engram is listed under a filter: one that shows in both is listed under each. */
function isListed(engram: Engram, filter: PickerFilter): boolean {
  return filter === 'all' || (filter === 'yours' ? isYours(engram) : drawsIn(engram)[filter])
}

/**
 * A press that starts the Eidola skill on a task, as /eidola does: Create,
 * Edit, Fix, Remix and Publish with Claude. The pane stays as it is, so the
 * Engram shows live while Claude works on it.
 */
function withClaude($: EngineInterface, args: string): () => void {
  return () => void startSkill($, args).catch(() => undefined)
}

/** A folder, its slashes one way, no slash at its end, its case gone: Windows' folders ignore case. */
function sameFolder(folder: string): string {
  return folder.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * The Engram plugin that didn't load that `/eidola fix` names, by its
 * plugin's name, its folder's name or its folder, quoted or not: the
 * folder may hold a space. Its first word alone also names it: what follows
 * a name is dropped, since the skill takes only the folder.
 */
function skippedNamed(text: string): (Skipped & { name: string }) | undefined {
  const quoted = /^(["'])(.*?)\1/.exec(text)
  const tries = [quoted?.[2], text, text.split(/\s+/)[0]].filter((one): one is string => Boolean(one)).map(sameFolder)
  return [...pluginSkipped.values()].find(one => {
    const names = [one.name, one.folder.split(/[\\/]/).pop() ?? '', one.folder].filter(Boolean).map(sameFolder)
    return tries.some(tried => names.includes(tried))
  })
}

/** A folder as one argument to the skill: quoted where it holds a space. */
function folderArg(folder: string): string {
  return /\s/.test(folder) ? `"${folder}"` : folder
}

/** Back from the Yours view to the whole picker: "or remix one". */
function showAll($: EngineInterface): () => void {
  return () => void update($, pickerFilterAtom, () => 'all')
}

/** Thumbnails by Engram, view and size: a scene is costly to draw, so once each. */
const thumbCache = new Map<string, string>()

/**
 * A still of an Engram at rest, `width` × `height` px, as it looks where it
 * draws: its pane view for one that shows in a pane (or both), its band view
 * for one that shows only in the band: its own still for the view where it
 * ships one, else its scene drawing that view.
 */
async function thumbFor($: EngineInterface, engram: Engram, view: 'pane' | 'band', width: number, height: number): Promise<{ svg: string; width: number }> {
  // Its own still for the view, where it ships one, fitted to the box by its
  // viewBox: read from its package the first time it is shown, checked by the
  // thumbnail rules then, and its scene drawn in place of one that fails.
  const file = engram.vessel.thumbnails[view]
  if (file) {
    const at = `${engram.id}/${file}`
    if (!fileCache.has(at)) {
      try {
        // An Engram plugin's stills are in its own folder's vessel/.
        const folder = engram.plugin ? engram.plugin.root : `${$.plugin.root}/${ENGRAMS_DIR}/${engram.id}`
        const text = await $.fs.read(`${folder}/vessel/${file}`)
        fileCache.set(at, checkThumbnail(file, text).length ? null : text)
      } catch {
        fileCache.set(at, null)
      }
    }
    const still = fileCache.get(at)
    if (still) {
      return { svg: filling(still, width, height), width }
    }
  }
  const key = `${engram.id}:${view}:${width}x${height}`
  let svg = thumbCache.get(key)
  if (!svg) {
    // An Engram plugin's with no still: the scene it was remixed from, else the resting sprite.
    const scene = builtInScene(engram)
    svg = scene ? renderScene(SCENES[scene][view]('idle', width, height), await $.clock.now()) : filling(spriteSvg('idle', Math.min(width, height)), width, height)
    thumbCache.set(key, svg)
  }
  return { svg, width }
}

/**
 * A card's still: 16:9 across the card, in whole rows. A band view, short and
 * wide, is letterboxed in the same box: as wide as the card, a quarter as tall.
 */
function thumbBox(thumbW: number): { rows: number; bandHeight: number } {
  const rows = Math.max(3, Math.round((thumbW * 9) / 16 / PX_PER_ROW))
  return { rows, bandHeight: Math.min(rows * PX_PER_ROW, Math.round(thumbW / 4)) }
}

/** The awake strip's still: 8 cells by 3 rows. */
const STRIP_THUMB = { cols: 8, rows: 3 }

/** The view of an Engram a still shows: its pane view if it shows in a pane, else its band view. */
function stillView(engram: Engram): 'pane' | 'band' {
  return drawsIn(engram).pane ? 'pane' : 'band'
}

/**
 * The awake strip: a small still with the mood in amber, the "AWAKE" label,
 * the name, where it draws now, and Details and Sleep.
 */
async function awakeStrip($: EngineInterface, kit: Kit, awake: Engram): Promise<RenderElement> {
  const { Box, Text, Svg } = kit.els
  const state = MOOD_STATE[await read($, moodAtom)]
  const mood = FRAME_STATES[state].name
  let still: RenderElement | null = null
  if (kit.isRich) {
    const width = STRIP_THUMB.cols * PX_PER_COLUMN
    const height = STRIP_THUMB.rows * PX_PER_ROW
    const view = stillView(awake)
    const thumb = await thumbFor($, awake, view, width, height)
    still = (
      <Box key="strip-thumb" width={STRIP_THUMB.cols} height={STRIP_THUMB.rows} overflow="hidden" backgroundColor={THEME.void}>
        <Svg key={`strip-thumb:${awake.id}:${view}`} source={thumb.svg} alt={`${awake.name}, awake`} width={width} height={height} />
        <Box key="strip-mood" position="absolute" top={0} left={0}>
          <Text bold color={THEME.amber}>
            {mood}
          </Text>
        </Box>
      </Box>
    )
  }
  return (
    <Box key="strip" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" borderStyle="round" borderColor={THEME.line} backgroundColor={THEME.panel} paddingX={1}>
      <Box key="strip-left" flexDirection="row" alignItems="center" gap={1}>
        {still}
        <Box key="strip-text" flexDirection="column">
          <Box key="strip-labels" flexDirection="row" gap={1}>
            {label(kit, 'Awake', 'strip-label')}
            {kit.isRich ? null : (
              <Text key="strip-mood" bold color={THEME.amber}>
                {mood}
              </Text>
            )}
          </Box>
          <Text key="strip-name" bold color={THEME.white}>
            {awake.name}
          </Text>
          <Text key="strip-where" color={THEME.muted}>
            {`${LABELS[state]} · ${drawingLine(surfaces, awake)}`}
          </Text>
        </Box>
      </Box>
      <Box key="strip-actions" flexDirection="row" gap={1}>
        {secondaryButton(kit, 'strip-details', 'Details', () => void openPage($, awake.id))}
        {secondaryButton(kit, 'strip-sleep', 'Sleep', () => void setEngram($, null))}
      </Box>
    </Box>
  )
}

/** Edit with Claude's icon on a card of yours: a pencil. */
const EDIT_ICON = '✎'

/** An Engram of yours that doesn't load, as its card shows it. */
type Broken = {
  /** The card's key: the Engram's id, or its plugin's folder where its engram.json didn't load. */
  key: string
  name: string
  /** Where it broke and what: `file:line: problem`. */
  where: string
  /** The skill's arguments for Fix with Claude. */
  fix: string
  /** The Engram, where it was read: its still, and its card's body opens its page. */
  engram?: Engram
}

/**
 * The card of an Engram of yours that doesn't load: an ember outline, its
 * still dimmed under a "NOT LOADING" badge, the file and line where it broke
 * in place of its description, and Fix with Claude as its only button.
 */
async function notLoadingCard($: EngineInterface, kit: Kit, broken: Broken, cardCols: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Client } = kit.els as Elements['desktop']
  const { key, name, where, engram } = broken
  const fix = secondaryButton(kit, `fix:${key}`, 'Fix with Claude', withClaude($, broken.fix))
  if (!kit.isRich) {
    return (
      <Box key={`card:${key}`} flexDirection="column" width={cardCols} borderStyle="round" borderColor={THEME.ember} paddingX={1}>
        <Box key="name" flexDirection="row" gap={1}>
          {engram ? (
            <Button key={`open:${key}`} label={name} plain onPress={() => void openPage($, engram.id)} />
          ) : (
            <Text key="name-text" bold color={THEME.white}>
              {name}
            </Text>
          )}
          <Text key="broken-badge" bold color={THEME.errorText}>
            NOT LOADING
          </Text>
        </Box>
        <Text key="about" color={THEME.muted} wrap="wrap">
          {where}
        </Text>
        <Box key="foot" flexDirection="row" justifyContent="flex-end">
          {fix}
        </Box>
      </Box>
    )
  }
  const inner = cardCols - 2
  const thumbW = inner * PX_PER_COLUMN
  const box = thumbBox(thumbW)
  const view = engram ? stillView(engram) : 'pane'
  const thumbH = view === 'pane' ? box.rows * PX_PER_ROW : box.bandHeight
  // Its own still where it was read; else the resting sprite. Dimmed either way.
  const still = engram ? await thumbFor($, engram, view, thumbW, thumbH) : { svg: filling(spriteSvg('idle', Math.min(thumbW, thumbH)), thumbW, thumbH), width: thumbW }
  return (
    <Box key={`card:${key}`} flexDirection="column" width={cardCols} borderStyle="round" borderColor={THEME.ember} backgroundColor={THEME.card}>
      <Box key="thumb" width={inner} height={box.rows} alignItems="center" justifyContent="center" backgroundColor={THEME.void}>
        <Svg key={`thumb:${key}:${view}:${thumbW}x${thumbH}:dim`} source={dimmed(still.svg)} alt={`${name}, not loading`} width={Math.min(still.width, thumbW)} height={thumbH} />
        <Box key="broken-badge" position="absolute" top={0} left={1} backgroundColor={THEME.void} borderStyle="round" borderColor={THEME.ember}>
          <Text bold color={THEME.errorText}>
            NOT LOADING
          </Text>
        </Box>
      </Box>
      <Box key="name" flexDirection="row" paddingX={1}>
        <Text bold color={THEME.white}>
          {name}
        </Text>
      </Box>
      <Box key="about" height={2} overflow="hidden" paddingX={1}>
        <Text color={THEME.muted} wrap="wrap">
          {where}
        </Text>
      </Box>
      {divider(kit, 'foot-divider')}
      <Box key="foot" flexDirection="row" justifyContent="flex-end" paddingX={1}>
        {fix}
      </Box>
      {engram ? (
        <Box key="hit" position="absolute" top={0} left={0}>
          <Client key={`open:${key}`} module="./card-hit.tsx" props={{ id: engram.id }} width={inner} height={box.rows + 3} />
        </Box>
      ) : null}
    </Box>
  )
}

/**
 * An Engram's card: its still (with an "AWAKE" badge on the awake one), its
 * name, two lines of what it is, and a footer of the surfaces it can draw on,
 * where it shows, and Awaken or Sleep. The card's body opens its page; the
 * button acts at once. In text, the name is the way to the page.
 *
 * One of yours has a "YOURS" badge by its name, "Remix of …" under it, and
 * Edit with Claude, an icon button, before Awaken; one marked not loading is
 * drawn as such (`notLoadingCard`).
 */
async function engramCard($: EngineInterface, kit: Kit, engram: Engram, awake: Engram | undefined, cardCols: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Client } = kit.els as Elements['desktop']
  const id = engram.id
  const fault = faults.get(id)
  if (fault) {
    return notLoadingCard($, kit, { key: id, name: engram.name, where: faultLine(fault), fix: `fix ${id}`, engram }, cardCols)
  }
  const isAwake = awake?.id === id
  const isMine = isYours(engram)
  const awaken = isAwake
    ? secondaryButton(kit, `sleep:${id}`, 'Sleep', () => void setEngram($, null))
    : primaryButton(kit, `awaken:${id}`, 'Awaken', async () => {
        await setEngram($, id)
        await update($, pickerAtom, () => false)
      })
  // Edit with Claude: a square icon button, a pencil. A Button takes its label
  // alone, so the pencil is its label and its name.
  const button = isMine ? (
    <Box key="foot-buttons" flexDirection="row" gap={1}>
      {secondaryButton(kit, `edit:${id}`, EDIT_ICON, withClaude($, `edit ${id}`))}
      {awaken}
    </Box>
  ) : (
    awaken
  )
  const base = isMine && engram.remixOf !== undefined ? (registry.get(engram.remixOf)?.name ?? engram.remixOf) : undefined
  const remixLine =
    base === undefined ? null : (
      <Box key="remix-of" flexDirection="row" paddingX={kit.isRich ? 1 : 0}>
        <Text color={THEME.faint}>{`Remix of ${base}`}</Text>
      </Box>
    )
  const yoursBadge = isMine ? (
    <Text key="yours-badge" color={THEME.gold}>
      YOURS
    </Text>
  ) : null
  const can = drawsIn(engram)
  const isOn: Record<SurfaceIcon, boolean> = { pane: can.pane, band: can.band, shrine: engram.vessel.shows.includes('shrine') }
  const shows = (
    <Text key="foot-text" color={THEME.faint}>
      {showsLabel(engram)}
    </Text>
  )
  const border = isAwake ? THEME.amberLine : THEME.line
  if (!kit.isRich) {
    return (
      <Box key={`card:${id}`} flexDirection="column" width={cardCols} borderStyle="round" borderColor={border} paddingX={1}>
        <Box key="name" flexDirection="row" gap={1}>
          <Button key={`open:${id}`} label={engram.name} plain onPress={() => void openPage($, id)} />
          {isAwake ? (
            <Text key="awake-badge" bold color={THEME.amber}>
              AWAKE
            </Text>
          ) : null}
          {yoursBadge}
        </Box>
        {remixLine}
        <Text key="about" color={THEME.muted} wrap="wrap">
          {engram.description}
        </Text>
        <Box key="foot" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1}>
          {shows}
          {button}
        </Box>
      </Box>
    )
  }
  const inner = cardCols - 2
  const thumbW = inner * PX_PER_COLUMN
  const box = thumbBox(thumbW)
  const view = stillView(engram)
  const thumbH = view === 'pane' ? box.rows * PX_PER_ROW : box.bandHeight
  const thumb = await thumbFor($, engram, view, thumbW, thumbH)
  return (
    <Box key={`card:${id}`} flexDirection="column" width={cardCols} borderStyle="round" borderColor={border} backgroundColor={THEME.card} hover={{ borderColor: THEME.amberLine }}>
      <Box key="thumb" width={inner} height={box.rows} alignItems="center" justifyContent="center" backgroundColor={THEME.void}>
        <Svg key={`thumb:${id}:${view}:${thumbW}x${thumbH}`} source={thumb.svg} alt={`${engram.name}, ${view} view`} width={Math.min(thumb.width, thumbW)} height={thumbH} />
        {isAwake ? (
          <Box key="awake-badge" position="absolute" top={0} left={1} backgroundColor={THEME.void} borderStyle="round" borderColor={THEME.amberLine}>
            <Text bold color={THEME.amber}>
              AWAKE
            </Text>
          </Box>
        ) : null}
      </Box>
      <Box key="name" flexDirection="row" gap={1} paddingX={1}>
        <Text bold color={THEME.white}>
          {engram.name}
        </Text>
        {yoursBadge}
      </Box>
      {remixLine}
      <Box key="about" height={2} overflow="hidden" paddingX={1}>
        <Text color={THEME.muted} wrap="wrap">
          {engram.description}
        </Text>
      </Box>
      {divider(kit, 'foot-divider')}
      <Box key="foot" flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" paddingX={1}>
        <Box key="foot-shows" flexDirection="row" alignItems="center" gap={1}>
          <Box key="foot-icons" flexDirection="row">
            {SURFACE_ICONS.map(icon => surfaceIcon(kit, icon, isOn[icon] ? THEME.amber : THEME.iconOff, `card-icon:${icon}`))}
          </Box>
          {shows}
        </Box>
        {button}
      </Box>
      {/* The body, over the still, the name and the description: a click opens the page. */}
      <Box key="hit" position="absolute" top={0} left={0}>
        <Client key={`open:${id}`} module="./card-hit.tsx" props={{ id }} width={inner} height={box.rows + 3 + (remixLine ? 1 : 0)} />
      </Box>
    </Box>
  )
}

/** The round amber "+" of the New Engram tile and the empty Yours view. */
function plusMark(kit: Kit, key: string): RenderElement {
  const { Box, Text } = kit.els
  return (
    <Box key={key} borderStyle="round" borderColor={THEME.amber} paddingX={1}>
      <Text bold color={THEME.amber}>
        +
      </Text>
    </Box>
  )
}

/**
 * A dashed box, centred: the round amber "+", a title in bold white, one
 * muted line, Create with Claude, and "or remix one" back to the whole
 * picker. The New Engram tile at the head of the Yours view (`width` a
 * card's), and the empty Yours view (the picker's width).
 */
function makeTile($: EngineInterface, kit: Kit, key: string, title: string, line: string, width: number): RenderElement {
  const { Box, Text, Button } = kit.els
  return (
    <Box key={key} flexDirection="column" width={width} alignItems="center" justifyContent="center" gap={1} borderStyle="dashed" borderColor={THEME.line} paddingX={1} paddingY={1}>
      {plusMark(kit, `${key}-plus`)}
      <Box key={`${key}-words`} flexDirection="column" alignItems="center">
        <Text bold color={THEME.white}>
          {title}
        </Text>
        <Text color={THEME.muted} wrap="wrap">
          {line}
        </Text>
      </Box>
      {primaryButton(kit, `${key}-create`, 'Create with Claude', withClaude($, 'new'))}
      <Button key={`${key}-remix`} label="or remix one" plain onPress={showAll($)} />
    </Box>
  )
}

/** The Yours view's not-loading cards for Engram plugins whose engram.json didn't load: no Engram to read, so no page. */
function skippedBroken(): Broken[] {
  return [...pluginSkipped.values()].map(one => {
    const issue = one.issues[0]
    return {
      key: `plugin:${skippedName(one)}`,
      name: skippedName(one),
      where: issue ? `${issue.file}: ${issue.problem}` : `${MANIFEST}: it didn't load.`,
      fix: `fix ${folderArg(one.folder)}`,
    }
  })
}

/**
 * The picker: the header, the "Engrams" title with its count and rule, the
 * awake strip, the filter chips with their counts, and the Engrams as cards.
 * Opened and closed by the corner triangle. The Yours filter shows the New
 * Engram tile, then your Engrams, those not loading as such; with none of
 * yours, the empty state.
 */
async function picker($: EngineInterface, kit: Kit, rows: number, awake: Engram | undefined): Promise<RenderElement> {
  const { Box, Text } = kit.els
  const filter = await read($, pickerFilterAtom)
  const cols = kit.cols
  const perRow = cols >= 40 ? 2 : 1
  const gap = 2
  const cardCols = Math.floor((cols - 2 - gap * (perRow - 1)) / perRow)
  const all = await listed($)
  const bundled = all.filter(engram => !isYours(engram)).length
  // Yours: your Engram plugins, those whose engram.json didn't load included.
  const unread = skippedBroken()
  const yours = all.length - bundled + unread.length
  const counted = (one: PickerFilter) => (one === 'yours' ? yours : all.filter(engram => isListed(engram, one)).length)
  const engrams = all.filter(engram => isListed(engram, filter))
  const cards = await Promise.all(engrams.map(engram => engramCard($, kit, engram, awake, cardCols)))
  if (filter === 'yours') {
    // The New Engram tile first, then yours, then those that couldn't be read.
    cards.unshift(makeTile($, kit, 'new-engram', 'New Engram', 'Describe a creature; Claude makes it with you.', cardCols))
    cards.push(...(await Promise.all(unread.map(one => notLoadingCard($, kit, one, cardCols)))))
  }
  const lines: RenderElement[] = []
  for (let i = 0; i < cards.length; i += perRow) {
    lines.push(
      <Box key={`row:${i}`} flexDirection="row" gap={gap}>
        {cards.slice(i, i + perRow)}
      </Box>,
    )
  }
  return (
    <Box flexDirection="column" width={cols} minHeight={rows} paddingLeft={1} paddingRight={1} gap={1} backgroundColor={THEME.void}>
      {header(kit, { key: 'picker-back', onPress: () => void closePicker($, awake) }, surfaces, () => void showSurfaces($))}
      {titleBlock(kit, 'Engrams', `${bundled} bundled${yours ? ` · ${yours} yours` : ''}`)}
      {awake ? await awakeStrip($, kit, awake) : null}
      <Box key="filters" flexDirection="row" flexWrap="wrap" gap={1}>
        {PICKER_FILTERS.map(one => chip(kit, `filter:${one}`, `${FILTER_LABELS[one]} ${counted(one)}`, one === filter, () => void update($, pickerFilterAtom, () => one)))}
      </Box>
      {filter === 'yours' && !yours ? (
        makeTile($, kit, 'yours-empty', 'Make your own Engram', 'Describe a creature, or start from any Engram, and Claude makes it with you.', cols - 2)
      ) : lines.length ? (
        lines
      ) : (
        <Text key="none" color={THEME.muted}>
          {`No Engrams draw in the ${filter}.`}
        </Text>
      )}
    </Box>
  )
}

/** Preview backdrops by scene and size: drawn once each, as the pane's are. */
const previewCache = new Map<string, string>()

/**
 * An Engram's live scene for its page's preview, `cols` × `rows`: its
 * backdrop drawn once, its creature live over it at the preview's own mood
 * and ink, never the session's. A new mood reaches the Client as props.
 */
async function previewScene($: EngineInterface, els: Elements['desktop'], engram: Engram, cols: number, rows: number, preview: Preview): Promise<RenderElement> {
  const { Box, Svg, Client } = els
  const width = cols * PX_PER_COLUMN
  const height = overdrawn(rows)
  const now = await $.clock.now()
  // An Engram plugin's previews the scene it was remixed from, else the resting sprite.
  const scene = builtInScene(engram)
  if (scene === undefined) {
    const state = preview.isError ? 'error' : MOOD_STATE[preview.mood]
    const size = Math.max(16, Math.min(width, rows * PX_PER_ROW, 160))
    return (
      <Box key="preview-scene" width={cols} height={rows} alignItems="center" justifyContent="center" backgroundColor={BACKDROP}>
        <Svg key={`preview-sprite:${state}`} source={spriteSvg(state, size)} alt={`${engram.name}, previewed`} width={size} height={size} isInteractive />
      </Box>
    )
  }
  const key = `${scene}:${width}x${height}`
  let ground = previewCache.get(key)
  if (!ground) {
    ground = renderScene(
      scene === 'kraken' ? krakenWaterScene(width, height) : scene === 'lich' ? voidScene(width, height, 'pane') : fenScene(width, height, cols, rows),
      now,
    )
    previewCache.set(key, ground)
  }
  const live = { mood: preview.mood, cols, rows, ink: preview.ink }
  const creature =
    scene === 'kraken' ? (
      <Client key="preview-kraken" module="./kraken-live.tsx" props={live} width={cols} height={rows} />
    ) : scene === 'lich' ? (
      <Client
        key="preview-lich"
        module="./lich-live.tsx"
        props={{ ...live, epoch: await read($, epochAtom), moodAt: preview.moodAt, moodBefore: preview.moodBefore, inkAt: preview.inkAt }}
        width={cols}
        height={rows}
      />
    ) : (
      <Client key="preview-wisp" module="./wisp-live.tsx" props={live} width={cols} height={rows} />
    )
  return (
    <Box key="preview-scene" width={cols} height={rows} overflow="hidden" alignItems="flex-start">
      {/* Nothing here may change with the preview's mood, alt included: a changed prop reloads the drawing. */}
      <Svg key={`preview-ground:${scene}`} source={ground} alt={`${engram.name}, previewed`} width={width} height={height} isInteractive />
      <Box position="absolute" top={0} left={0}>
        {creature}
      </Box>
    </Box>
  )
}

/** An Engram's page, its buttons wired: the preview's chips change the preview alone. */
async function pageScreen($: EngineInterface, kit: Kit, engram: Engram, awake: Engram | undefined): Promise<RenderElement> {
  const preview = await read($, previewAtom)
  const scene = kit.isRich ? await previewScene($, kit.els as Elements['desktop'], engram, kit.cols - 2, previewRows(engram), preview) : null
  return engramPage(kit, {
    engram,
    isAwake: awake?.id === engram.id,
    surfaces,
    preview,
    scene,
    face: FACES[preview.isError ? 'error' : MOOD_STATE[preview.mood]],
    back: { onPress: () => void closePage($, awake) },
    onSurfaces: () => void showSurfaces($),
    onMood: mood => void setPreviewMood($, mood),
    onError: () => void previewError($),
    onAwaken: () => void setEngram($, engram.id),
    onSleep: () => void setEngram($, null),
    // Remix any Engram; publish only one of yours.
    onRemix: withClaude($, `remix ${engram.id}`),
    onPublish: isYours(engram) ? withClaude($, `publish ${engram.id}`) : undefined,
  })
}

/**
 * The picker's corner triangle, in a band's bottom-right corner, in the
 * awake Engram's brass: every Engram's band has one. A click opens the pane
 * on the picker, or closes the screen the pane shows.
 */
async function bandCorner($: EngineInterface, els: Elements['desktop'], cols: number, rows: number, awake: Engram): Promise<RenderElement> {
  const { Box, Client } = els
  const brass = awake.vessel.hud?.bracket ?? FRAME_GOLD
  return (
    <Box key="corner" position="absolute" top={rows - 2} left={cols - 3}>
      <Client key="band-corner" module="./frame-corner.tsx" props={{ colour: brass, isOpen: await isScreenOpen($) }} width={3} height={2} />
    </Box>
  )
}

export const register: Register = (on, options) => {
  surfaces = readSurfaces(options)
  isStatusLineOn = readStatusLine(options)

  // ── Engram plugins: the eidola noun (docs/spec/engram-plugin.md) ──────

  // $.eidola, for Engram plugins. The answers below are the floor: Eidola's
  // own hooks on the noun's events answer first, with a $ to read through.
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    return {
      ...built,
      eidola: {
        announce: async () => ({ contract: CONTRACT, engram: null, issues: [{ file: MANIFEST, problem: "Eidola couldn't read the Engram plugin.", fix: 'Run /engrams, or start a new session.' }] }),
        fault: async () => ({ isMarked: false }),
      },
    }
  })

  // An Engram plugin announcing itself, from its session.start: before or
  // after Eidola's own, whichever plugin loaded first.
  on('eidola.announce', async ($, e) => ({ value: await adopt($, e.root) }))

  // An Engram plugin's own drawing failed and it says where: marked not loading.
  on('eidola.fault', async ($, e) => {
    const engram = plugged.get(e.engram)
    if (!engram) {
      return { value: { isMarked: false } }
    }
    const line = e.line ?? lineOf(e.stack)
    faults.set(engram.id, { file: e.file ?? engram.plugin?.module ?? 'hooks/register.tsx', ...(line === undefined ? {} : { line }), problem: e.message })
    // Raised from inside a drawing, the write is refused; the next drawing reads the mark all the same.
    await update($, pluginsAtom, n => n + 1).catch(() => undefined)
    return { value: { isMarked: true } }
  })

  // The backup: a plugin loading after Eidola (installed or reloaded
  // mid-session) that calls $.eidola.announce is read here too, in case its
  // announce comes late or never. Never refuses a plugin.
  on('plugin.register', async ($, e, next) => {
    const result = await next(e)
    if (result.allow && e.name !== 'eidola' && e.uses.calls.includes('eidola.announce')) {
      void adopt($, e.root).catch(() => undefined)
    }
    return result
  }).catch(($, e, next) => next(e))

  // ── Session ────────────────────────────────────────────────────────────

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'eidola',
      description: 'Open the Eidola Vessel pane, or make an Engram with Claude: new, remix, edit, fix, publish',
      argumentHint: '[new | remix <engram> | edit <engram> | fix <engram> | publish <engram> | place | frame | mood | ink]',
    })
    await $.command.register({
      name: 'awaken',
      description: 'Awaken an Engram: its scene reacts to what Claude is doing',
      argumentHint: '<engram>',
    })
    await $.command.register({ name: 'sleep', description: 'Put the awake Engram to sleep' })
    await $.command.register({
      name: 'engrams',
      description: "Open the Engram picker, or one Engram's page, in the pane",
      argumentHint: '[engram]',
    })

    if (!(await read($, epochAtom))) {
      const now = await $.clock.now()
      await update($, epochAtom, () => now)
    }
    // Written, so an Engram plugin reading it finds the contract this Eidola keeps.
    await update($, contractAtom, () => CONTRACT)

    const frames = await $.store.get(FRAME_KEY)
    if (frames && typeof frames === 'object') {
      const kept = frames as Record<string, boolean>
      await update($, frameAtom, () => ({ ...kept }))
    }

    const stored = await $.store.get(STORE_KEY)
    // A removed Engram was awake: nothing is, from now on, and /eidola says why once.
    const removed = typeof stored === 'string' && Object.hasOwn(REMOVED, stored) ? REMOVED[stored] : undefined
    if (removed !== undefined) {
      await $.store.set(STORE_KEY, null)
      await $.store.set(REMOVED_KEY, removed)
    }
    // The bundled packages, read afresh: a package that fails is skipped, and
    // an awake id whose package didn't load wakes nothing this session.
    await loadRegistry($)
    const wanted = stored === undefined ? RESTING_ID : stored
    const id = typeof wanted === 'string' && registry.has(wanted) ? wanted : null
    await update($, engramAtom, () => id)

    if (!isStatusLineOn) {
      $.ui.status(undefined)
    }
    if ((await drawingNow($, false)).opensPane) {
      void openPane($).catch(() => undefined)
    }
    await signal($, { kind: 'session' })

    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const result = await next(e)
    if ((await drawingNow($, false)).opensPane) {
      void openPane($).catch(() => undefined)
    }
    return result
  })

  // ── Engine events → Vessel state ──────────────────────────────────────

  // A typed prompt moves the Vessel; the prompt itself passes on untouched.
  // Eidola adds nothing to the prompt or the system prompt.
  on('prompt.submit', async ($, e, next) => {
    await signal($, { kind: 'prompt' })
    return next(e)
  }).catch(($, e, next) => next(e))

  // turn.start carries no agentId: it fires for the main loop only.
  on('turn.start', async ($, e, next) => {
    await signal($, { kind: 'turnStart' })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await signal($, { kind: 'toolStart', tool: e.tool })
    let isOk = true
    try {
      const ran = await next(e)
      isOk = !(ran.deny === undefined && ran.isError === true)
      return ran
    } catch (error) {
      isOk = false
      throw error
    } finally {
      await signal($, { kind: 'toolEnd', tool: e.tool, isOk })
    }
  }).catch(($, e, next) => next(e))

  // A permission dialog actually put to the person. (tool.check's 'ask' is
  // not enough: in auto mode the mode settles most asks itself, and nobody
  // is waiting on the person at all.)
  on('classic.PermissionRequest', async ($, e, next) => {
    await signal($, { kind: 'ask', tool: e.tool_name })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.compact', async ($, e, next) => {
    await signal($, { kind: 'compact' })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await signal($, { kind: 'turnEnd', reason: e.reason as TurnEndReason })
    }
    return next(e)
  })

  // ── Commands ───────────────────────────────────────────────────────────

  // /eidola        diagnostics: surfaces, pane, band, network reach
  // /eidola media  toggles the media test in the pane
  // /eidola place  shows the surfaces switches, or sets one: /eidola place band off
  // /eidola mood   sets the mood by hand, until the next prompt
  // /eidola new | remix <id> | edit <id> | fix <id or folder> | publish <id>   starts the Eidola skill on that task
  on('command.run', { command: 'eidola' }, async ($, e) => {
    const [sub = '', value = '', onOff = ''] = e.args.trim().toLowerCase().split(/\s+/)

    // The Eidola skill, started on a task: /eidola new, remix <id>, edit <id>, fix <id or folder>, publish <id>.
    if (isSkillTask(sub)) {
      return { text: await skillTaskText($, sub, e.args) }
    }

    if (sub === 'place') {
      if (!value) {
        // On the desktop, the Surfaces screen in the pane; elsewhere, or with
        // the pane not placed, the switches as text.
        if (await isOnDesktop($)) {
          await update($, surfacesAtom, () => true)
          const opened = await openPane($)
          if (opened.isPlaced) {
            return { text: 'The Surfaces screen is open in the pane.' }
          }
          return { text: `The pane is not placed (${opened.reason}).\n${placeText()}` }
        }
        return { text: placeText() }
      }
      if (!isSwitch(value) && value !== 'status') {
        return { text: `"${value}" isn't a switch.\n${placeText()}` }
      }
      const isOn = readOnOff(onOff)
      if (isOn === undefined) {
        return { text: `Say on or off: /eidola place ${value} on, or /eidola place ${value} off.\n${placeText()}` }
      }
      // Written as the person's own /config choice; the module reloads with it.
      const deny = await writeSwitch($, value, isOn)
      if (deny !== undefined) {
        return { text: `Couldn't change the ${value} switch here (${deny}). Set it in /config instead.` }
      }
      return { text: `${value} ${isOn ? 'on' : 'off'}: ${value === 'status' ? STATUS_HELP : SWITCH_HELP[value]}.` }
    }

    if (sub === 'frame') {
      const awake = await engramOf($, await read($, engramAtom))
      if (!awake) {
        return { text: 'Nothing is awake to frame. /awaken an Engram first.' }
      }
      const frames = await read($, frameAtom)
      const isOn = !isFramed(frames, awake)
      const next = { ...frames, [awake.id]: isOn }
      await update($, frameAtom, () => next)
      await $.store.set(FRAME_KEY, next)
      return { text: isOn ? `Frame on for ${awake.name}.` : `Frame off for ${awake.name}.` }
    }

    if (sub === 'ink') {
      await bumpInk($)
      const awake = await engramOf($, await read($, engramAtom))
      const scene = awake?.vessel.scene
      return {
        text:
          scene === 'lich'
            ? 'The Lich is scorched.'
            : scene === 'wisp'
              ? 'The Wisp gutters, and a lantern goes out.'
              : scene === SELF_SCENE
                ? `${awake?.name ?? 'The Engram'} plays its error effect.`
                : 'The Kraken inks.',
      }
    }

    // A mood by hand, to watch a live Engram take it: it holds until the
    // session's next event (a prompt, a tool) sets the mood again.
    if (sub === 'mood') {
      const moods: Mood[] = ['idle', 'working', 'attention']
      if (!moods.includes(value as Mood)) {
        return { text: 'Usage: /eidola mood idle|working|attention. It holds until your next prompt.' }
      }
      const mood = value as Mood
      const before = await read($, moodAtom)
      const at = await $.clock.now()
      await update($, moodBeforeAtom, () => before)
      await update($, moodAtom, () => mood)
      await update($, moodAtAtom, () => at)
      await show($, { state: MOOD_STATE[mood], detail: 'by hand' })
      return { text: `Mood: ${mood}. It holds until your next prompt.` }
    }

    if (sub === 'live') {
      // Each run moves to the next mood; `off` ends it.
      const order: Mood[] = ['idle', 'working', 'attention']
      const was = await read($, liveAtom)
      const next = value === 'off' ? null : order[was === null ? 0 : (order.indexOf(was) + 1) % order.length]!
      await update($, liveAtom, () => next)
      const opened = await openPane($)
      if (next === null) {
        return { text: 'Live test off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Live test: ${next}.${where}\n` +
          'Run /eidola live again to move to the next mood. Watch the pane as you do:\n' +
          '  continuous: the disc glides to its new spot, the frame count keeps climbing\n' +
          '  restarted: a blink, and the frame count starts over\n' +
          '/eidola live off ends it.',
      }
    }

    if (sub === 'blend') {
      // Each run moves to the next mood; `off` ends it.
      const was = await read($, blendAtom)
      const next = value === 'off' ? null : was === null ? 0 : (was + 1) % BLEND_STEPS.length
      await update($, blendAtom, () => next)
      const opened = await openPane($)
      if (next === null) {
        return { text: 'Blend test off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Blend test: ${BLEND_STEPS[next]} (the drawing is ${next}px shorter; its source is unchanged).${where}\n` +
          'Run /eidola blend again to move to the next mood. Watch the pane as you do:\n' +
          '  blends: the disc glides, the colour shifts, the bar keeps filling\n' +
          '  reloads: a blink, and the bar and ring start over\n' +
          '/eidola blend off ends it.',
      }
    }

    if (sub === 'measure') {
      const isOn = !(await read($, measureAtom))
      await update($, measureAtom, () => isOn)
      const opened = await openPane($)
      if (!isOn) {
        return { text: 'Measure off.' }
      }
      const where = opened.isPlaced ? '' : `\nThe pane is not placed (${opened.reason}), so only the band shows.`
      return { text: MEASURE_HELP + where }
    }

    if (sub === 'media') {
      const isOn = !(await read($, mediaAtom))
      await update($, mediaAtom, () => isOn)
      const opened = await openPane($)
      if (!isOn) {
        return { text: 'Media test off.' }
      }
      const where = opened.isPlaced ? 'It is in the Eidola pane.' : `But the pane is not placed (${opened.reason}), so nothing draws.`
      return {
        text:
          `Media test on. ${where}\n` +
          'Three clips, each a square sliding across with frames numbered 1-8:\n' +
          '  A · GIF in SVG, sandboxed frame\n' +
          '  B · GIF in SVG, plain image\n' +
          '  C · WebM in SVG, sandboxed frame\n' +
          'Report which ones move. Run /eidola media again to turn it off.',
      }
    }

    const attached = await $.session.surfaces()
    const opened = await openPane($)
    const drawing = await drawingNow($, opened.isPlaced)
    const panes = await $.ui.panes()
    const mine = panes.find(one => one.id === PANE)
    const probes = await Promise.all(NET_PROBES.map(probe => probeLine($, probe)))
    // A removed Engram was awake when the session started: said once, then forgotten.
    // The store out of reach costs only the notice, never the diagnostics.
    const removed = await $.store.get(REMOVED_KEY).catch(() => undefined)
    if (typeof removed === 'string') {
      await $.store.delete(REMOVED_KEY).catch(() => undefined)
    }
    const lines = [
      ...(typeof removed === 'string' ? [`${removed} was removed in 0.7.0. Pick another with /awaken.`] : []),
      // How many are bundled and yours, and each of yours not loading, with its file and line.
      engramsLine(await engramsOf($)),
      // A package that didn't load: its folder, and each error's file, problem and fix.
      ...skipped.flatMap(one => [`Skipped Engram ${one.folder}:`, ...one.issues.map(issue => `  ${issue.file}: ${issue.problem} ${issue.fix}`)]),
      // Engram plugins that didn't load, and those whose drawing is marked not loading.
      ...pluginLines(),
      `Surfaces: ${attached.length ? attached.join(', ') : 'none attached'}`,
      opened.isPlaced ? 'Pane: placed.' : `Pane: not placed (${opened.reason})`,
      mine ? `Pane state: shown=${mine.isShown} placed=${mine.isPlaced}` : 'Pane state: not in the pane list',
      `Switches: ${surfacesLine(surfaces)}. Band: ${drawing.band ? 'showing' : 'hidden'}. Status line: ${isStatusLineOn ? 'on' : 'off'}.`,
      lastBand
        ? `Band hook last saw: ${lastBand.surface}, survey=${lastBand.hasSurvey}, working=${lastBand.isWorking}; drew ${lastBand.drew}.`
        : 'Band hook: not asked to draw since the mod loaded.',
      liveClocks.size
        ? `Live drawings' clocks: ${[...liveClocks].map(([k, v]) => `${k} ${v}`).join(', ')}.`
        : "Live drawings' clocks: none reported.",
      'Network, from where this session runs:',
      ...probes.map(line => `  ${line}`),
    ]
    return { text: lines.join('\n') }
  })

  // The person closing the pane brings the band back.
  // A live drawing reports, on starting, whether it keeps the shared clock.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { clock?: unknown } | null
    if (data && typeof data === 'object' && typeof data.clock === 'string') {
      liveClocks.set(e.element, data.clock)
      return {}
    }
    // The corner triangle, clicked: the picker opens, or closes. In the band it
    // opens the pane on the picker, or closes the pane if it is open on it.
    if ((e.element === 'frame-corner' || e.element === 'band-corner') && data && typeof data === 'object' && (data as { corner?: unknown }).corner === 'toggle') {
      const awake = await engramOf($, await read($, engramAtom))
      const isOpen = await isScreenOpen($)
      if (e.component === 'AbovePrompt' && !isOpen) {
        await update($, pickerAtom, () => true)
        await openPane($)
      } else if (isOpen) {
        await closePicker($, awake)
      } else {
        await update($, pickerAtom, () => true)
      }
      return {}
    }
    // A card's body, clicked: its Engram's page opens over the picker.
    const open = data && typeof data === 'object' ? (data as { open?: unknown }).open : undefined
    if (e.element.startsWith('open:') && typeof open === 'string') {
      await openPage($, open)
      return {}
    }
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE) {
      $.ui.invalidate('ui.render')
    }
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'awaken' }, async ($, e) => {
    const id = e.args.trim().toLowerCase() || RESTING_ID
    const engram = await engramOf($, id)
    if (!engram) {
      return { text: `No Engram called "${id}". Bundled Engrams:\n${listText(await listed($), await read($, engramAtom))}` }
    }
    await setEngram($, id)
    if (whereItDraws(surfaces, engram, false).opensPane) {
      void openPane($).catch(() => undefined)
    }
    return { text: `${engram.name} is awake.` }
  })

  on('command.run', { command: 'sleep' }, async $ => {
    const engram = await engramOf($, await read($, engramAtom))
    await setEngram($, null)
    return { text: engram ? `${engram.name} is asleep.` : 'Nothing was awake.' }
  })

  // The packages are read again, so a fixed or changed one shows without a restart.
  // With an id, that Engram's page opens in the pane. Without one, the picker
  // opens in the pane on the desktop; elsewhere the list prints.
  on('command.run', { command: 'engrams' }, async ($, e) => {
    // Read afresh: an Engram plugin marked not loading is asked to draw again.
    faults.clear()
    await loadRegistry($)
    $.ui.invalidate('ui.render')
    const engrams = await listed($)
    const id = e.args.trim().toLowerCase()
    if (id) {
      const engram = engrams.find(one => one.id === id)
      if (!engram) {
        return { text: `No Engram called "${id}". Bundled Engrams:\n${listText(engrams, await read($, engramAtom))}` }
      }
      await openPage($, id)
      const opened = await openPane($)
      return { text: opened.isPlaced ? `${engram.name}'s page is open in the pane.` : `${engram.name}'s page is ready, but the pane is not placed (${opened.reason}).` }
    }
    const list = engrams.length ? listText(engrams, await read($, engramAtom)) : 'No Engrams loaded. /eidola says why.'
    if (engrams.length && (await isOnDesktop($))) {
      await update($, pageAtom, () => null)
      await update($, surfacesAtom, () => false)
      await update($, pickerAtom, () => true)
      const opened = await openPane($)
      if (opened.isPlaced) {
        return { text: 'The Engram picker is open in the pane.' }
      }
      return { text: `The pane is not placed (${opened.reason}).\n${list}` }
    }
    return { text: list }
  })

  // ── The pane ───────────────────────────────────────────────────────────

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    // The hand-off: the awake Engram's plugin draws the creature, `cols` ×
    // `rows`, asked through `next` with the room and the state on
    // `e.props.eidola` (handoff.ts). Its drawing, or the fallback in a slot
    // a plugin above Eidola fills, goes inside Eidola's frame and corner.
    const handOff = async (engram: Engram, cols: number, rows: number): Promise<RenderElement> => {
      let verdict: Verdict
      const known = faults.get(engram.id)
      if (known) {
        verdict = { fault: known }
      } else {
        const eidola = await handoffOf($, engram, 'pane', cols, rows)
        // The whole chain's time; the judge counts the Engram's own hooks' from next.trace where it can.
        const started = await $.clock.now()
        let got: unknown
        try {
          got = await next({ ...e, props: { ...e.props, eidola } as typeof e.props })
        } catch {
          got = undefined
        }
        verdict = verdictOf(engram, got, next.trace, (await $.clock.now()) - started)
      }
      const els = $.ui.resolve(e) as unknown as Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>
      return slotFor($, els, e.surface === 'desktop', engram, cols, rows, 'pane', verdict)
    }

    const vessel = async () => {
    const id = await read($, engramAtom)
    const mood = await read($, moodAtom)
    const awake = await engramOf($, id)
    const engram = awake ?? (await restingOf($))
    const state: VesselState = awake ? MOOD_STATE[mood] : 'sleeping'

    // An Engram plugin's Engram, awake and no test running: its plugin draws it.
    if (awake && isSelfDrawn(awake) && !(await read($, measureAtom)) && (await read($, liveAtom)) === null && (await read($, blendAtom)) === null && !(await read($, mediaAtom))) {
      return handOff(awake, e.props.bodyColumns, Math.max(4, e.props.scroll.bodyRows - 1))
    }

    if (await read($, measureAtom)) {
      const columns = e.props.bodyColumns
      const rows = e.props.scroll.bodyRows
      const lines = paneReport(e.surface, e.props.placement, columns, rows)
      if (e.surface === 'terminal') {
        const { Box, Text } = $.ui.resolve(e)
        return <Box flexDirection="column">{lines.map(line => <Text key={line}>{line}</Text>)}</Box>
      }
      const { Box, Text, Svg } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" height="100%" backgroundColor={MEASURE_GROUND}>
          <Box flexDirection="column" width={columns} height={rows} borderStyle="single" borderColor={MEASURE_EDGE} gap={1}>
            {lines.map(line => (
              <Text key={line}>{line}</Text>
            ))}
            <Svg key="measure:ref" source={referenceSvg()} alt={`${REFERENCE_PX}px reference square`} width={REFERENCE_PX} height={REFERENCE_PX} />
          </Box>
        </Box>
      )
    }

    // No text: the pane's title names the Engram and the status line carries
    // the state, so the body repeats neither. The terminal draws the face.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{FACES[state]}</Text>
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)

    const live = await read($, liveAtom)
    if (live !== null && e.surface === 'desktop') {
      const surface = e.surface
      const { Client } = $.ui.resolve(e)
      // A row short of the body, so the drawing never asks the pane to scroll.
      const cols = e.props.bodyColumns
      const rows = Math.max(4, e.props.scroll.bodyRows - 1)
      return <Client key="live" module="./live-test.tsx" props={{ mood: live, cols, rows, surface }} width={cols} height={rows} />
    }

    const blend = await read($, blendAtom)
    if (blend !== null) {
      const { width, height } = sceneSize(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
      return <Svg key="blend" source={blendTestSvg(width, height)} alt={`Blend test: ${BLEND_STEPS[blend]}`} width={width} height={height - blend} isInteractive />
    }

    // The live Kraken, where a Client can draw (desktop): still water drawn
    // once as an SVG whose source never changes, the creature drawn live over
    // it. A new mood reaches the running Client as props: no reload, no cut.
    // The live Kraken, where a Client can draw (desktop, docked), by its
    // drawing module: still water drawn once as an SVG whose source never
    // changes, the creature drawn live over it. A new mood reaches the
    // running Client as props: no reload, no cut.
    if (awake?.vessel.scene === 'kraken' && e.surface === 'desktop' && e.props.placement === 'dock' && !(await read($, mediaAtom))) {
      const els = $.ui.resolve(e) as Elements['desktop']
      return drawBundled($, els, awake, 'kraken', 'pane', e.props.bodyColumns, Math.max(4, e.props.scroll.bodyRows - 1))
    }

    // The Lich live, the same way: the dark it hangs in drawn once, and it
    // drawn over that in glyphs, in four slices, top to bottom, that keep in step.
    if (awake?.vessel.scene === 'lich' && e.surface === 'desktop' && e.props.placement === 'dock' && !(await read($, mediaAtom))) {
      const els = $.ui.resolve(e) as Elements['desktop']
      return drawBundled($, els, awake, 'lich', 'pane', e.props.bodyColumns, Math.max(6, e.props.scroll.bodyRows - 1))
    }

    if (await read($, mediaAtom)) {
      return (
        <Box flexDirection="column" alignItems="center" gap={1}>
          <Text bold>Media test</Text>
          <Text dimColor>Which ones move? Frames are numbered 1-8.</Text>
          {mediaCases().map(one => (
            <Box key={`media:${one.key}`} flexDirection="column" alignItems="center">
              <Text>{one.label}</Text>
              <Svg key={one.key} source={one.source} alt={one.label} width={96} isInteractive={one.isInteractive} />
            </Box>
          ))}
          <Text dimColor>Control: the sprite below uses CSS animation, which is known to work.</Text>
          <Svg key={`control:${state}`} source={spriteSvg(state, 64)} alt={`Sprite: ${LABELS[state]}`} width={64} isInteractive />
          <Button key="media-off" label="End media test" onPress={() => update($, mediaAtom, () => false)} />
        </Box>
      )
    }

    // A scene fills the whole body: its pane view in a tall dock, its band
    // view in a short or inline one. With nothing awake, the resting Wisp's
    // scene, dimmed, a cell short each way, where its sleeping frame drew.
    const views = SCENES[builtInScene(engram) ?? RESTING_SCENE]
    const { width, height } = (awake ? sceneSize : stageSize)(e.props.bodyColumns, e.props.scroll.bodyRows, e.props.placement)
    const isDeep = e.props.placement === 'dock' && height > width * 1.1
    const now = await $.clock.now()
    const scene = sceneFor('pane', `${awake ? '' : 'resting:'}${isDeep ? 'deep' : 'surface'}:${state}:${width}x${height}`, () => {
      const svg = renderScene(isDeep ? views.pane(state, width, height) : views.band(state, width, height), now)
      return awake ? svg : dimmed(svg)
    })
    return <Svg key="scene:pane" source={scene} alt={`${engram.name}: ${LABELS[state]}`} width={width} height={height} isInteractive />
    }
    // Never a frame, a corner or the picker over a test.
    const isTest = (await read($, measureAtom)) || (await read($, blendAtom)) !== null || (await read($, liveAtom)) !== null || (await read($, mediaAtom))
    const awake = await engramOf($, await read($, engramAtom))
    const isPicking = await read($, pickerAtom)
    const pageId = await read($, pageAtom)
    const page = pageId === null ? undefined : await engramOf($, pageId)
    const isSurfaces = await read($, surfacesAtom)
    // Read so a switch written from here redraws the screens that show it,
    // and so an Engram plugin found or marked not loading redraws the pane.
    await read($, switchedAtom)
    await read($, pluginsAtom)
    const cols = e.props.bodyColumns
    const rows = Math.max(4, e.props.scroll.bodyRows - 1)
    if (isTest) {
      return vessel()
    }
    if (e.surface !== 'desktop') {
      // The terminal and mobile: the same picker and page, in plain text.
      if (!page && !isPicking && !isSurfaces) {
        return vessel()
      }
      const kit: Kit = { els: $.ui.resolve(e) as unknown as Els, isRich: false, cols }
      return isSurfaces ? surfacesScreen($, kit, awake) : page ? pageScreen($, kit, page, awake) : picker($, kit, rows, awake)
    }
    const els = $.ui.resolve(e) as Elements['desktop']
    const kit: Kit = { els, isRich: true, cols }
    const brass = awake?.vessel.hud?.bracket ?? FRAME_GOLD
    let body: RenderElement
    if (isSurfaces) {
      body = surfacesScreen($, kit, awake)
    } else if (page) {
      body = await pageScreen($, kit, page, awake)
    } else if (isPicking) {
      body = await picker($, kit, rows, awake)
    } else if (awake && drawsBandViewInPane(awake) && !isSelfDrawn(awake)) {
      // One that doesn't show in the pane, the pane opened by hand: its band
      // view, across the middle of the pane.
      const { Box } = els
      body = (
        <Box width={cols} height={rows} flexDirection="column" justifyContent="center" backgroundColor={BACKDROP}>
          {await bandView($, els, awake, cols, 'pane')}
        </Box>
      )
    } else {
      // The HUD frame over whatever the Vessel is, when it is on.
      const tree = await vessel()
      body = isFramed(await read($, frameAtom), awake)
        ? framed(els, tree, cols, rows, awake ? await read($, viewAtom) : { state: 'sleeping', detail: '' }, awake)
        : tree
    }
    if (cols < 8 || rows < 4) {
      return body
    }
    const { Box, Client } = els
    return (
      <Box width={cols} height={rows}>
        {body}
        <Box key="corner" position="absolute" top={rows - 2} left={cols - 3}>
          <Client key="frame-corner" module="./frame-corner.tsx" props={{ colour: brass, isOpen: isPicking || page !== undefined || isSurfaces }} width={3} height={2} />
        </Box>
      </Box>
    )
  })

  // ── The band above the prompt: where the surfaces setting says ───────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    lastBand = { surface: e.surface, hasSurvey: e.props.hasSurvey, isWorking: e.props.isWorking, drew: 'engine' }
    if (await read($, measureAtom)) {
      if (e.props.hasSurvey) {
        return next(e)
      }
      const lines = bandReport(e.surface, e.props.bodyColumns, e.props.maxRows, e.props.scroll.bodyRows)
      if (e.surface === 'terminal') {
        const { Box, Text } = $.ui.resolve(e)
        return <Box flexDirection="column">{lines.map(line => <Text key={line}>{line}</Text>)}</Box>
      }
      const { Box, Text, Svg } = $.ui.resolve(e)
      // Yellow: bodyColumns wide, 4 rows tall; the square under it.
      return (
        <Box flexDirection="column" gap={1} backgroundColor={MEASURE_GROUND}>
          <Box flexDirection="column" width={e.props.bodyColumns} height={4} borderStyle="single" borderColor={MEASURE_EDGE}>
            {lines.map(line => (
              <Text key={line}>{line}</Text>
            ))}
          </Box>
          <Svg key="measure:band-ref" source={referenceSvg()} alt={`${REFERENCE_PX}px reference square`} width={REFERENCE_PX} height={REFERENCE_PX} />
        </Box>
      )
    }
    if (!(await drawingNow($, surfaces.hideBand && (await isPanePlaced($)))).band) {
      return next(e)
    }
    // Read so an Engram plugin found or marked not loading redraws the band.
    await read($, pluginsAtom)
    const awake = await engramOf($, await read($, engramAtom))
    const mood = await read($, moodAtom)
    const engram = awake ?? (await restingOf($))
    const state: VesselState = awake ? MOOD_STATE[mood] : 'sleeping'
    // The tool's detail lives in the status line; the band redraws only on a mood change.
    const detail = awake ? '' : 'No Engram awake'
    const line = `${engram.name} · ${LABELS[state]}${detail ? ` · ${detail}` : ''}`

    // What the hooks beneath draw in the band goes with the strip. A survey
    // (a question the engine or the app asks here) keeps the slot too: the
    // strip stays and the survey draws under it, rather than the Vessel
    // vanishing whenever a turn ends on a question. Anything else beneath
    // (a plugin's row of its own, such as a job's progress bar) draws above
    // the strip; with nothing there, the strip draws alone, unmoved.
    // `beneath` is what `next` already gave, where it was asked (the hand-off).
    const withSurvey = async (strip: RenderElement, beneath?: { tree: unknown }): Promise<RenderElement> => {
      const { Box } = $.ui.resolve(e)
      if (e.props.hasSurvey) {
        const below = beneath ? beneath.tree : await next(e)
        lastBand = { ...lastBand!, drew: 'strip+survey' }
        return (
          <Box flexDirection="column" gap={1}>
            {strip}
            {below as RenderElement}
          </Box>
        )
      }
      // Nothing beneath that answers, or a failure there: the strip alone.
      const below = beneath ? beneath.tree : await next(e).catch(() => undefined)
      if (isBlank(below)) {
        lastBand = { ...lastBand!, drew: 'strip' }
        return strip
      }
      lastBand = { ...lastBand!, drew: 'beneath+strip' }
      return (
        <Box flexDirection="column" gap={1}>
          {below as RenderElement}
          {strip}
        </Box>
      )
    }

    // An Engram plugin's Engram: its plugin draws the creature, as in the
    // pane (the hand-off there), inside Eidola's frame with the corner.
    if (awake && isSelfDrawn(awake)) {
      const cols = e.props.bodyColumns
      const rows = e.surface === 'desktop' ? bandRows(builtInScene(awake), e.props.hasSurvey, e.props.maxRows) : Math.max(1, Math.min(BAND_ROWS, e.props.maxRows))
      let verdict: Verdict
      // What the hooks beneath drew besides the creature: drawn with the frame, as with any strip.
      let beneath: { tree: unknown } | undefined
      const known = faults.get(awake.id)
      if (known) {
        verdict = { fault: known }
      } else {
        const eidola = await handoffOf($, awake, 'band', cols, rows)
        // The whole chain's time; the judge counts the Engram's own hooks' from next.trace where it can.
        const started = await $.clock.now()
        let got: unknown
        try {
          got = await next({ ...e, props: { ...e.props, eidola } as typeof e.props })
        } catch {
          got = undefined
        }
        // A plugin between may have wrapped the drawing in a row of its own: the drawing is judged, the rest drawn above the frame.
        const { found, rest } = splitAt(got, sceneKey(awake.id))
        verdict = verdictOf(awake, found ?? got, next.trace, (await $.clock.now()) - started)
        // The band is asked again, plainly, where what came back can't be what is beneath: marked not
        // loading just now (it may be the plugin's own), under a survey (the plugin may have answered in its
        // place), or the drawing alone (the plugin answered without passing on, so a plugin under it wasn't asked).
        beneath = 'fault' in verdict || e.props.hasSurvey || rest === undefined ? undefined : { tree: rest }
      }
      const slot = await slotFor($, $.ui.resolve(e) as unknown as Pick<Elements['desktop'], 'Box' | 'Text' | 'Svg'>, e.surface === 'desktop', awake, cols, rows, 'band', verdict)
      if (e.surface !== 'desktop') {
        return withSurvey(slot, beneath)
      }
      const els = $.ui.resolve(e) as Elements['desktop']
      const { Box } = els
      const body = isFramed(await read($, frameAtom), awake) ? framed(els, slot, cols, rows, await read($, viewAtom), awake) : slot
      return withSurvey(
        <Box width={cols} height={rows}>
          {body}
          {await bandCorner($, els, cols, rows, awake)}
        </Box>,
        beneath,
      )
    }

    // The terminal draws the face alone; the line stays as the Svg's alt text.
    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)
      return withSurvey(<Text>{FACES[state]}</Text>)
    }

    // The live Kraken in the band, where a Client can draw (desktop): still
    // water under the creature, framed for a wide strip. As in the pane,
    // nothing here changes with the mood but the Client's props.
    if (awake?.vessel.scene === 'kraken' && e.surface === 'desktop') {
      const els = $.ui.resolve(e) as Elements['desktop']
      const cols = e.props.bodyColumns
      const rows = bandRows('kraken', e.props.hasSurvey, e.props.maxRows)
      const strip = await drawBundled($, els, awake, 'kraken', 'band', cols, rows)
      return withSurvey(withChild(strip, await bandCorner($, els, cols, rows, awake)))
    }

    // The Wisp in its fen: the fen drawn once, the spirit and its lanterns live
    // over it, in a HUD of its own whose corner opens the picker in the pane.
    // A row taller than its rows, clipped to them, so the HUD meets its edges.
    if (awake?.vessel.scene === 'wisp' && e.surface === 'desktop') {
      const els = $.ui.resolve(e) as Elements['desktop']
      const { Box } = els
      const cols = e.props.bodyColumns
      const rows = WISP_BAND_ROWS
      const body = await fenView($, els, awake, cols, 'band')
      return withSurvey(
        <Box width={cols} height={rows}>
          {body}
          {await bandCorner($, els, cols, rows, awake)}
        </Box>,
      )
    }

    // The Lich in the band: a strip across its face, over the dark, as tall
    // as the band allows up to twelve rows: fewer, and its face is a smear.
    if (awake?.vessel.scene === 'lich' && e.surface === 'desktop') {
      const els = $.ui.resolve(e) as Elements['desktop']
      const cols = e.props.bodyColumns
      const rows = bandRows('lich', e.props.hasSurvey, e.props.maxRows)
      const strip = await drawBundled($, els, awake, 'lich', 'band', cols, rows)
      return withSurvey(withChild(strip, await bandCorner($, els, cols, rows, awake)))
    }

    // A scene Engram fills the band edge to edge, no text: the status line
    // under the prompt names the state.
    if (awake) {
      const views = SCENES[builtInScene(awake) ?? RESTING_SCENE]
      const { Svg } = $.ui.resolve(e)
      const width = Math.max(96, e.props.bodyColumns * PX_PER_COLUMN - 4)
      const height = BAND_SCENE_PX
      const now = await $.clock.now()
      const scene = sceneFor('band', `${state}:${width}x${height}`, () => renderScene(views.band(state, width, height), now))
      return withSurvey(<Svg key="scene:band" source={scene} alt={line} width={width} height={height} isInteractive />)
    }

    // Nothing awake: a status strip, the resting Wisp's scene dimmed on a
    // small square, and its name and state beside it.
    const { Box, Svg, Text } = $.ui.resolve(e)
    const size = BAND_STAGE_PX
    const now = await $.clock.now()
    const resting = sceneFor('band', `resting:${state}:${size}x${size}`, () => dimmed(renderScene(SCENES[builtInScene(engram) ?? RESTING_SCENE].band(state, size, size), now)))
    return withSurvey(
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg key="scene:band-resting" source={resting} alt={line} width={size} height={size} isInteractive />
        <Box flexDirection="column">
          <Text bold>{`${engram.name} · ${LABELS[state]}`}</Text>
          {detail ? (
            <Text dimColor wrap="truncate-end">
              {detail}
            </Text>
          ) : null}
        </Box>
      </Box>,
    )
  })
}
