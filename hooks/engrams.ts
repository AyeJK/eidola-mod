// Bundled Engrams. Each mirrors the Engram format (engram.yaml + SOUL.md +
// vessel.yaml). Their Vessels are baked in the Vessel Forge: one SVG per
// state, shipped under vessels/<pack>/. The prototype inlines the rest;
// loading Engram folders from disk is Phase 11 (plan Q5).

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
  vessel: { type: 'svg'; pack: string; forge: { source: string; style: string; look: string }; placement?: Placement; scene?: Scene }
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
    vessel: { type: 'svg', pack: 'kraken', forge: { source: 'kraken', style: 'scene', look: 'Pixel Kraken in particle water' }, scene: 'kraken' },
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
