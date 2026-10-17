// Engram spec v2 (docs/spec/engram-format.md): the shape of a package's
// engram.json, and the registry's Engram, the same with every default
// filled in. Pure: no `$`, nothing from 'claude-code'. The lists here are
// what hooks/validate.ts checks against, and what the schema is tested
// against.

import type { VesselState } from '../types'

/** The `spec` an engram.json must carry. */
export const SPEC_VERSION = 2

/** The scenes built into the mod (hooks/scenes.ts), which `vessel.scene` may name. */
export const SCENE_IDS = ['kraken', 'lich', 'wisp'] as const
export type SceneName = (typeof SCENE_IDS)[number]

/**
 * The scene an Engram plugin's engram.json names: its creature is drawn by
 * the plugin itself (docs/spec/engram-plugin.md), not by the mod.
 */
export const SELF_SCENE = 'self'
export type SelfScene = typeof SELF_SCENE

/** Every value `vessel.scene` can take: a built-in scene, or `self` in an Engram plugin. */
export const SCENE_NAMES = [...SCENE_IDS, SELF_SCENE] as const

/** The places an Engram can draw: the pane, the band above the prompt, the local Shrine. */
export const SHOW_PLACES = ['pane', 'band', 'shrine'] as const
export type ShowPlace = (typeof SHOW_PLACES)[number]

/** Where an Engram is made to draw: at least one place, each once. */
export type Shows = ShowPlace[]

/** The creator's word on the Engram: they made it, or they may share it. */
export const RIGHTS = ['original', 'licensed'] as const
export type Rights = (typeof RIGHTS)[number]

/** The views a picker thumbnail can be for. */
export const THUMB_VIEWS = ['pane', 'band'] as const
export type ThumbView = (typeof THUMB_VIEWS)[number]

export const HUD_METERS = ['bars', 'wave', 'sparks', 'none'] as const
export const HUD_TAGS = ['name', 'livecam', 'sigil', 'none'] as const
export const HUD_LAYOUTS = ['top', 'bottom'] as const
export const HUD_LABELS = ['bold', 'serif', 'pixel'] as const

/** The resolver's nine states, which key `vessel.hud.colours`. */
export const VESSEL_STATES = [
  'idle',
  'thinking',
  'working',
  'waiting',
  'responding',
  'success',
  'error',
  'attention',
  'sleeping',
] as const satisfies readonly VesselState[]

/** A state's own colours in the HUD: its label, and the detail under it. */
export type HudColour = { label: string; detail: string }

/** The HUD frame over the Vessel, as an engram.json gives it: every field optional. */
export type Hud = {
  /** On until the person toggles it (`/eidola frame`). */
  show?: boolean
  /** `bars`, a level meter in the corner; `wave`, a recording scrolling along the bottom; `sparks`, rising sparks; `none`. */
  meter?: (typeof HUD_METERS)[number]
  /** The corner tag: the Engram's `name`; a `livecam` stamp; a turning `sigil`; `none`. */
  tag?: (typeof HUD_TAGS)[number]
  /** The camera's name on a `livecam` tag. */
  camera?: string
  /** The state large at the `top` left, or small along the `bottom`. */
  layout?: (typeof HUD_LAYOUTS)[number]
  /** The state label's face. */
  label?: (typeof HUD_LABELS)[number]
  /** The corner brackets' colour, hex. */
  bracket?: string
  /** Its own colours per state, hex. */
  colours?: Partial<Record<VesselState, HudColour>>
}

/** A package's engram.json, as the spec gives it. */
export type EngramJson = {
  /** Editors' hint; the mod ignores it. */
  $schema?: string
  spec: typeof SPEC_VERSION
  /** Slug, 2-32 of a-z 0-9 -, equal to the folder's name. */
  id: string
  /** Up to 32 characters. */
  name: string
  /** Semver. */
  version: string
  author: string
  /** Up to 160 characters. */
  description: string
  rights: Rights
  /**
   * An Engram plugin's: the id of the Engram it was remixed from. Eidola draws
   * that one's scene while the plugin's own drawing can't (it throws, draws
   * nothing or runs over its budget); the resting sprite when left out.
   */
  remixOf?: string
  vessel: {
    /** A built-in scene; `self` in an Engram plugin, which draws its own. */
    scene: SceneName | SelfScene
    /** Where it draws; all three when left out. */
    shows?: Shows
    /** Picker stills, file names in `vessel/`; the scene's own when left out. */
    thumbnails?: Partial<Record<ThumbView, string>>
    hud?: Hud
  }
  /** A free namespace: kept as it is, never read. */
  extensions?: Record<string, unknown>
}

/** The HUD with every default filled in, but `camera` (`CAM 01` where drawn) and per-state colours (the mod's own). */
export type FilledHud = Required<Omit<Hud, 'camera' | 'colours'>> & {
  camera?: string
  colours: Partial<Record<VesselState, HudColour>>
}

/** The frame's brass: the brackets' colour when an Engram names none. */
export const BRASS = '#b8913a'

export const HUD_DEFAULTS: Readonly<Required<Omit<Hud, 'camera' | 'colours'>>> = {
  show: false,
  meter: 'bars',
  tag: 'name',
  layout: 'top',
  label: 'bold',
  bracket: BRASS,
}

/**
 * Where an Engram plugin lives, as Eidola found it: its plugin.json name,
 * its folder, and its hooks module (for a "not loading" line).
 */
export type EngramPlugin = { name: string; root: string; module: string }

/** An Engram in the registry: its engram.json with every default filled in. */
export type Engram = {
  id: string
  name: string
  version: string
  author: string
  description: string
  rights: Rights
  /** An Engram plugin's: the Engram it was remixed from, drawn while its own drawing can't be. */
  remixOf?: string
  /** Set for an Engram plugin's Engram: the plugin that draws it. */
  plugin?: EngramPlugin
  vessel: {
    scene: SceneName | SelfScene
    shows: Shows
    thumbnails: Partial<Record<ThumbView, string>>
    hud: FilledHud
  }
  extensions: Record<string, unknown>
}

/** The registry's Engram for a manifest that has passed validation. */
export function withDefaults(json: EngramJson): Engram {
  const hud = json.vessel.hud ?? {}
  const filled: FilledHud = {
    show: hud.show ?? HUD_DEFAULTS.show,
    meter: hud.meter ?? HUD_DEFAULTS.meter,
    tag: hud.tag ?? HUD_DEFAULTS.tag,
    layout: hud.layout ?? HUD_DEFAULTS.layout,
    label: hud.label ?? HUD_DEFAULTS.label,
    bracket: hud.bracket ?? HUD_DEFAULTS.bracket,
    colours: { ...hud.colours },
  }
  if (hud.camera !== undefined) {
    filled.camera = hud.camera
  }
  const remix = json.remixOf === undefined ? {} : { remixOf: json.remixOf }
  return {
    id: json.id,
    name: json.name,
    version: json.version,
    author: json.author,
    description: json.description,
    rights: json.rights,
    ...remix,
    vessel: {
      scene: json.vessel.scene,
      shows: [...(json.vessel.shows ?? SHOW_PLACES)],
      thumbnails: { ...json.vessel.thumbnails },
      hud: filled,
    },
    extensions: { ...json.extensions },
  }
}

/** True for an Engram whose creature its own plugin draws (`vessel.scene: "self"`). */
export function isSelfDrawn(engram: Engram | undefined): boolean {
  return engram?.vessel.scene === SELF_SCENE
}
