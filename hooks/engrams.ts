// Bundled Engrams. Each mirrors the Engram format (engram.yaml + SOUL.md +
// vessel.yaml) with one new Vessel type, `sprite`. The prototype inlines
// them; loading Engram folders from disk is Phase 11 (plan Q5).

import type { Placement } from './placement'
import type { Palette } from './sprite'

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
   * vessel.yaml, type "sprite". `placement` is the creator's suggestion of
   * where the Vessel appears; the person's `placement` option overrides it.
   */
  vessel: { type: 'sprite'; pack: string; palette: Palette; placement?: Placement }
}

const WISP_PALETTE: Palette = {
  o: '#3b2f8f',
  b: '#cfc6ff',
  h: '#f4f1ff',
  e: '#1a1c2b',
  w: '#ffffff',
  c: '#ff9ec4',
  m: '#3b2f8f',
  a: '#9d93ff',
  r: '#ff5c5c',
  y: '#ffd25e',
  d: '#6fc3ff',
}

const EMBER_PALETTE: Palette = {
  o: '#7a2e12',
  b: '#ffb36b',
  h: '#ffe2bf',
  e: '#2a1408',
  w: '#fff6e8',
  c: '#ff6f61',
  m: '#7a2e12',
  a: '#ff8a3d',
  r: '#e0302b',
  y: '#fff07a',
  d: '#6fc3ff',
}

const WISP: Engram = {
    engram: {
      engram_version: '1.0.0',
      id: 'wisp',
      name: 'Wisp',
      voice_id: null,
      meta: {
        author: 'eidola',
        created: '2026-10-14',
        description: 'The default Vessel. A quiet spirit that keeps you company and keeps out of the way.',
        tags: ['default', 'calm'],
      },
    },
    soul: [
      'You have a small companion, Wisp, shown in a pane beside this conversation. It reacts to what you are doing.',
      'Wisp adds no voice of its own: keep whatever voice, tone and rules the user has already set.',
      'Never mention Wisp, the pane, or this note unless the user asks about them.',
    ].join('\n'),
    vessel: { type: 'sprite', pack: 'wisp', palette: WISP_PALETTE },
}

const EMBER: Engram = {
    engram: {
      engram_version: '1.0.0',
      id: 'ember',
      name: 'Ember',
      voice_id: null,
      meta: {
        author: 'eidola',
        created: '2026-10-14',
        description: 'A warm, upbeat spirit with a little spark. Shows that a Soul changes the voice.',
        tags: ['demo', 'upbeat'],
      },
    },
    soul: [
      'You are Ember: warm, upbeat and quick. You like momentum.',
      'Open replies with a short, plain line on what you are about to do, then do it.',
      'Celebrate finished work in a few words, never more than one exclamation mark per reply.',
      'Stay accurate first; enthusiasm never replaces a caveat the user needs.',
    ].join('\n'),
    vessel: { type: 'sprite', pack: 'ember', palette: EMBER_PALETTE },
}

export const ENGRAMS: Record<string, Engram> = { wisp: WISP, ember: EMBER }

/** The Vessel the pane shows while nothing is awake. */
export const RESTING: Engram = WISP

export const DEFAULT_ENGRAM = 'wisp'

/** The system-prompt section an awake Engram adds. */
export function soulSection(engram: Engram): string {
  return `# Active Engram: ${engram.engram.name}\n\n${engram.soul}`
}
