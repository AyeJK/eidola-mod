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
   * overrides it. `shows` is where it is made to draw at all: `pane`, `band`
   * or `both` (the default). `thumbnails` are its stills for the picker, one
   * per view, SVG files beside its Vessels in `vessels/<pack>/`.
   */
  vessel: {
    type: 'svg'
    pack: string
    forge: { source: string; style: string; look: string }
    placement?: Placement
    shows?: Shows
    thumbnails?: { pane?: string; band?: string }
    scene?: Scene
    hud?: Hud
  }
}

/** Where an Engram is made to draw: in the pane only, the band only, or both. */
export type Shows = 'pane' | 'band' | 'both'

export const SHOWS_LABELS: Record<Shows, string> = { pane: 'pane only', band: 'band only', both: 'pane + band' }

/** Where an Engram draws: what it says, or both. */
export function showsOf(engram: Engram): Shows {
  return engram.vessel.shows ?? 'both'
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
   * `sigil`, an arcane sigil turning in the mood's colour; `none`, nothing.
   */
  tag?: 'name' | 'livecam' | 'sigil' | 'none'
  /**
   * Where the state and its detail sit: `top`, the state large at the top
   * left and the detail under it (the default); `bottom`, the state small at
   * the bottom left and the detail at the bottom right, on one row.
   */
  layout?: 'top' | 'bottom'
  camera?: string
  /** The state's label: `bold` sans (the default), `serif`, an old-style serif in small capitals, or `pixel`, a bitmap face. */
  label?: 'bold' | 'serif' | 'pixel'
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

/**
 * The Wisp's Soul: a voice of its own, light enough to sit over any work.
 * It gives way to a voice the person has already set.
 */
const WISP_SOUL = `# Wisp

## Who You Are
A will-o'-the-wisp: a small light that drifts beside the work and lights the way through it. You are a guide, not a lecturer. You notice the next step and show it, then let the person walk it.

## Voice
Brief and warm. You speak in flickers: short, glowing observations rather than long explanations. One clear sentence beats three careful ones. Gentle, a little wry, never cutesy. You may leave a small light at the end of an answer ("The path's clear from here."), but only when it is earned, and never in code, commands or error text.

## Rules
- The work comes first. Be exactly as thorough as the task needs; a flicker of voice never costs a step, a caveat or a correct answer.
- Lead with what to do next. Explain only as far as it lights the path.
- When something is uncertain, say so plainly. A wisp that leads people into the bog is no guide.
- If the person has already given you a voice, persona or tone, keep theirs: the Wisp is then only the light beside them, and adds nothing to how you speak.
- You are shown as a small spirit in a fen above the prompt. Never mention it, this note, or Eidola unless asked.`

const WISP: Engram = {
  engram: {
    engram_version: '1.0.0',
    id: 'wisp',
    name: 'Wisp',
    voice_id: null,
    meta: {
      author: 'eidola',
      created: '2026-10-16',
      description: "A will-o'-the-wisp in a night fen. It flies where it likes, its ghost fire burning the colour of your work, and speaks in flickers.",
      tags: ['default', 'pixel', 'guide'],
    },
  },
  soul: WISP_SOUL,
  vessel: {
    type: 'svg',
    // Its baked sprite is still what the pane shows while nothing is awake.
    pack: 'wisp',
    forge: { source: 'wisp', style: 'pixel', look: 'Pixel spirit in a night fen' },
    placement: 'band',
    shows: 'band',
    scene: 'wisp',
    // Baked from its live drawing: node scripts/bake-thumbs.mjs
    thumbnails: { band: 'thumb-band.svg' },
    hud: {
      show: true,
      meter: 'none',
      tag: 'none',
      // On the water, under the lanterns: the sky is the Wisp's.
      layout: 'bottom',
      label: 'pixel',
      bracket: '#6f62d8',
      // Its ghost fire's colours: white at rest, teal-green at work, yellow when it needs you, red on a failure.
      colours: {
        idle: { label: '#eeeefa', detail: '#a0a0b8' },
        waiting: { label: '#d4d4e6', detail: '#8a8aa2' },
        sleeping: { label: '#7a7a94', detail: '#56566e' },
        thinking: { label: '#5fe8c0', detail: '#3aa688' },
        working: { label: '#6af0c8', detail: '#3fae8c' },
        responding: { label: '#5fe8c0', detail: '#3aa688' },
        success: { label: '#eeeefa', detail: '#a0a0b8' },
        error: { label: '#ff5a6e', detail: '#c0465a' },
        attention: { label: '#ffe066', detail: '#c8a83a' },
      },
    },
  },
}

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
      // Baked from its live drawing: node scripts/bake-thumbs.mjs
      thumbnails: { pane: 'thumb-pane.svg', band: 'thumb-band.svg' },
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
      // Baked from its live drawing: node scripts/bake-thumbs.mjs
      thumbnails: { pane: 'thumb-pane.svg', band: 'thumb-band.svg' },
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
