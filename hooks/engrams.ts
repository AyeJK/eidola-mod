// Bundled Engrams. Each mirrors the Engram format (engram.yaml + SOUL.md +
// vessel.yaml). Their Vessels are baked in the Vessel Forge: one SVG per
// state, shipped under vessels/<pack>/. The prototype inlines the rest;
// loading Engram folders from disk is Phase 11 (plan Q5).

import type { VesselState } from '../types'
import type { Placement } from './placement'
import type { SceneId } from './scenes'

export type Engram = {
  /** engram.yaml */
  engram: {
    engram_version: string
    id: string
    name: string
    voice_id: null
    meta: { author: string; created: string; description: string; tags: string[] }
  }
  /** SOUL.md */
  soul: string
  /**
   * vessel.yaml, type "svg": `vessels/<pack>/<state>.svg` in the mod, and the
   * Forge style and look that made them. `placement` is the creator's
   * suggestion of where the Vessel appears; the person's `placement` option
   * overrides it.
   */
  vessel: { type: 'svg'; pack: string; forge: { source: string; style: string; look: string }; placement?: Placement; scene?: Scene; hud?: Hud }
}

/**
 * The HUD frame an Engram ships with: whether it is on until the person
 * toggles it (`/eidola frame`), and the meter in its corner.
 */
export type Hud = {
  show?: boolean
  /**
   * `bars`, a level meter in the corner (the default); `wave`, a recording
   * scrolling along the bottom; `sparks`, arcane sparks rising from it;
   * `none`, no meter.
   */
  meter?: 'bars' | 'wave' | 'sparks' | 'none'
  /**
   * The corner tag: `name` (the default); `livecam`, a camera feed's stamp,
   * a blinking recording dot, LIVE and `camera`, the name and the time; or
   * `sigil`, an arcane sigil turning in the mood's colour.
   */
  tag?: 'name' | 'livecam' | 'sigil'
  camera?: string
  /** The state's label: `bold` sans (the default), or `serif`, an old-style serif in small capitals. */
  label?: 'bold' | 'serif'
  /** The corner brackets' colour (the default is brass). */
  bracket?: string
  /** Its own colours for each state's label and the detail under it: shades of its moods. */
  colours?: Partial<Record<VesselState, { label: string; detail: string }>>
}

/**
 * A scene the mod draws at the size of its slot, filling the pane or band,
 * in place of baked per-state SVGs (see scenes.ts). Code for now; a
 * data-only scene format comes once the presets show what one needs.
 */
export type Scene = SceneId

/** A Soul that adds no voice: these Engrams are visual only. */
function quietSoul(name: string): string {
  return [
    `You have a small companion, ${name}, shown in a pane beside this conversation. It reacts to what you are doing.`,
    `${name} adds no voice of its own: keep whatever voice, tone and rules the user has already set.`,
    `Never mention ${name}, the pane, or this note unless the user asks about them.`,
  ].join('\n')
}

function visual(
  id: string,
  name: string,
  description: string,
  tags: string[],
  forge: Engram['vessel']['forge'],
): Engram {
  return {
    engram: {
      engram_version: '1.0.0',
      id,
      name,
      voice_id: null,
      meta: { author: 'eidola', created: '2026-10-15', description, tags },
    },
    soul: quietSoul(name),
    vessel: { type: 'svg', pack: id, forge },
  }
}

const WISP = visual(
  'wisp',
  'Wisp',
  'The default Vessel. A quiet spirit that keeps you company and keeps out of the way.',
  ['default', 'calm'],
  { source: 'wisp', style: 'pixel', look: 'Classic' },
)

export const ENGRAMS: Record<string, Engram> = {
  wisp: WISP,
  spirit: visual('spirit', 'Spirit', 'The first Eidola Vessel: a figure of drifting gold dust.', ['particle'], {
    source: 'spirit',
    style: 'particle',
    look: 'Shrine dust',
  }),
  skull: visual('skull', 'Skull', 'A grinning skull in chunky dithered bone.', ['pixel'], {
    source: 'skull',
    style: 'pixel',
    look: 'Dithered, bone palette, 40 px',
  }),
  moon: visual('moon', 'Moon', 'A sleepy crescent moon drawn in frosted scanlines.', ['pixel'], {
    source: 'moon',
    style: 'pixel',
    look: 'Scanline',
  }),
  sigil: visual('sigil', 'Sigil', 'A spell circle of sparks whose wheels turn faster as work picks up.', ['particle'], {
    source: 'sigil',
    style: 'particle',
    look: 'Embers',
  }),
  kraken: {
    engram: {
      engram_version: '1.0.0',
      id: 'kraken',
      name: 'Kraken',
      voice_id: null,
      meta: {
        author: 'eidola',
        created: '2026-10-16',
        description: 'Something vast in the deep water beside your work. It surfaces when there is work to do.',
        tags: ['scene', 'ocean'],
      },
    },
    soul: quietSoul('Kraken'),
    vessel: {
      type: 'svg',
      pack: 'kraken',
      forge: { source: 'kraken', style: 'scene', look: 'Pixel Kraken in particle water' },
      scene: 'kraken',
      hud: {
        show: true,
        meter: 'none',
        tag: 'livecam',
        camera: 'DEEPCAM 02',
        bracket: '#3c9aa6',
        // Its eyes' colours: cyan at rest, red at work, gold when it needs you.
        colours: {
          idle: { label: '#5ff6ff', detail: '#3c9aa6' },
          waiting: { label: '#4fd8e8', detail: '#3a8e98' },
          success: { label: '#8ff0f6', detail: '#4fa8b0' },
          sleeping: { label: '#2f7f8a', detail: '#255f68' },
          thinking: { label: '#ff7466', detail: '#b8453c' },
          working: { label: '#ff3a40', detail: '#b8282c' },
          responding: { label: '#ff9a80', detail: '#c0604c' },
          error: { label: '#ff1f2e', detail: '#a8141e' },
          attention: { label: '#ffcf3a', detail: '#c49a2a' },
        },
      },
    },
  },
  lich: {
    engram: {
      engram_version: '1.0.0',
      id: 'lich',
      name: 'Lich',
      voice_id: null,
      meta: {
        author: 'eidola',
        created: '2026-10-16',
        description: 'A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.',
        tags: ['scene', 'glyph'],
      },
    },
    soul: quietSoul('Lich'),
    vessel: {
      type: 'svg',
      pack: 'lich',
      forge: { source: 'lich', style: 'scene', look: 'Glyph lich in ember gold' },
      scene: 'lich',
      hud: {
        show: true,
        meter: 'sparks',
        tag: 'sigil',
        label: 'serif',
        bracket: '#9a3c28',
        // Its robe's colours: embers at rest, violet at work, emerald when it needs you.
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
  },
  starfield: visual('starfield', 'Starfield', 'Stars streaming past at warp, quicker when busy.', ['particle'], {
    source: 'stars',
    style: 'particle',
    look: 'Starfall',
  }),
}

/** The Vessel the pane shows while nothing is awake. */
export const RESTING: Engram = WISP

export const DEFAULT_ENGRAM = 'wisp'

/** The system-prompt section an awake Engram adds. */
export function soulSection(engram: Engram): string {
  return `# Active Engram: ${engram.engram.name}\n\n${engram.soul}`
}
