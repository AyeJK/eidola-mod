// The Lich's look: its glyphs and colours, how the pane and the band frame
// it, the dark it hangs in (a still backdrop), and its field scenes for
// surfaces that cannot draw it live (one pose a state, from the same model).

import type { VesselState } from '../types'
import { EMPTY, hash } from './field'
import type { FieldScene, LayerStyle } from './field'
import { BONE, CROWN, FIRE, FLAME, GEM, MANTLE, RUNE, buildModel, sampleModel } from './lich3d'
import type { Camera, Pose } from './lich3d'

export type View = 'pane' | 'band'

/** Each layer's colours, dark to bright: ember gold, the alchemist's palette; purple eyes, green arcane flame. */
export const COLOURS: string[][] = [
  [],
  ['#1c0e06', '#3a1e0c', '#5e3414', '#8a4e1e', '#b8702c', '#e0973e', '#f6c063', '#ffe6a8'],
  ['#3a2606', '#6e4a10', '#a8781c', '#d8a830', '#ffd65a', '#fff2b0'],
  ['#2a0d0a', '#43150f', '#5f1e15', '#80291b', '#a53622', '#c8502c'],
  ['#2a0a3a', '#5a1a7a', '#9a3ad0', '#c97cff', '#f0d8ff'],
  ['#5a3a10', '#c08a2c', '#ffd27a', '#fff2c8'],
  ['#5a0a18', '#b0182c', '#ff4a5a', '#ffc0c8'],
  ['#0a3a12', '#1a7a2a', '#3ad04a', '#8cff7a', '#e0ffd0'],
]

/** Arcane fire: what kindles across its signs while it works, and its gem burns. */
export const ARCANE = ['#0a3a12', '#1a7a2a', '#3ad04a', '#8cff7a', '#e0ffd0']

/** Its eyes when it needs you: witchlight, a pale violet gone almost white. */
export const WITCHLIGHT = ['#3a1a5a', '#7a4ab0', '#c49aff', '#ead8ff', '#ffffff']

/** Scorched: everything gone to red, for a moment, when something went wrong. */
export const SCORCHED = ['#1a0404', '#3a0808', '#6a1010', '#a01c14', '#d0301c', '#ff5a3a', '#ff9a7a', '#ffd0c0']

/**
 * Each layer's glyphs, from dim to dense, a few to a step so the bone
 * shimmers. Only characters that keep to one cell in common monospace fonts.
 */
export const GLYPHS: string[][][] = [
  [],
  [['∙', ':'], ['∴', '∵', '+'], ['+', '×', '☿'], ['×', '♂', '♀', '☿'], ['▲', '▼', '♁', '●']],
  [['·'], [':'], ['▲', '▼'], ['▲', '♁'], ['▲', '●']],
  [['·', '∙'], [':', '∙'], ['∴', '∵', ':'], ['+', '∴', '×'], ['×', '+']],
  [['∙'], [':', '∴'], ['▲'], ['●'], ['●']],
  [['☿'], ['♀'], ['♂'], ['♁'], ['☽']],
  [['∙'], ['●'], ['●'], ['●'], ['●']],
  [['∙'], [':', '∴'], ['▲'], ['▲', '●'], ['●']],
]

/** A glyph for a layer at a brightness, picked by place and time so the bone shimmers. */
export function glyphFor(layer: number, v: number, x: number, y: number, t: number): string {
  const steps = GLYPHS[layer] ?? GLYPHS[BONE]!
  const set = steps[Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)))]!
  if (set.length === 1) {
    return set[0]!
  }
  const k = Math.floor(hash(x, y) * set.length * 7 + t * (0.5 + hash(y, x) * 1.5))
  return set[k % set.length]!
}

/** Its layers for the field engine: the same glyphs and colours. */
export function lichLayers(): LayerStyle[] {
  return COLOURS.map((shades, i) => ({
    chars: i === 0 ? ' ' : ' ' + (GLYPHS[i] ?? []).map(step => step[0]).join(''),
    shades: shades.length ? shades : ['#000'],
    fill: i === 0 ? 'none' : (shades[Math.floor(shades.length * 0.7)] ?? '#888'),
    isGlowing: i === FIRE || i === GEM || i === RUNE || i === FLAME,
  }))
}

/** The head's size in the band: as in a tall pane, so the band shows the pane's face. */
const BAND_HEAD = 258

/** How a view frames it: the camera, the head's size, and where the head sits. */
export function framing(view: View, W: number, H: number): { cam: Camera; s: number; home: [number, number] } {
  if (view === 'band') {
    // A strip across its face at the pane's own scale, the same signs the same
    // size, its eyes on the middle row.
    const s = BAND_HEAD
    return { cam: { cx: W / 2, cy: H / 2, f: 1850 }, s, home: [0.5, (H / 2 - 0.12 * s) / H] }
  }
  return { cam: { cx: W / 2, cy: H * 0.42, f: H * 1.3 }, s: Math.min(W * 0.62, H * 0.28), home: [0.5, 0.26] }
}

/** A still pose for a state: for the field scenes. */
export function restingPose(state: VesselState, view: View, W: number, H: number, t = 0): Pose {
  const { s, home } = framing(view, W, H)
  const base: Pose = { pos: [W * home[0], H * home[1], 0], s, yaw: 0, pitch: 0.1, roll: 0, bodyYaw: 0, jaw: 0, eyes: 0.55, look: [0, 0], flame: 0.15, runes: 0.5, spin: t * 0.15, t, light: 0.75 }
  switch (state) {
    case 'thinking':
    case 'working':
    case 'responding':
      return { ...base, pitch: -0.04, eyes: 1.1, flame: 1, runes: 1, spin: t * 0.9, light: 1 }
    case 'attention':
      return { ...base, pos: [W * home[0], H * home[1], view === 'band' ? -90 : -380], eyes: 1.6, flame: 0.5, runes: 0.6, jaw: 0.2, light: 1 }
    case 'error':
      return { ...base, eyes: 1.4, flame: 0.8, jaw: 0.5, roll: 0.12 }
    case 'sleeping':
      return { ...base, pitch: 0.3, eyes: 0.1, flame: 0, runes: 0, light: 0.5 }
    default:
      return base
  }
}

/**
 * The dark it hangs in, drawn once as a still SVG: near black, a faint
 * ember glow behind the head, and embers rising. All its motion is CSS,
 * so it never reloads.
 */
export function voidScene(W: number, H: number, view: View): FieldScene {
  const r = (n: number) => Math.round(n * 10) / 10
  const isBand = view === 'band'
  const defs = [
    `<radialGradient id="dark" cx=".5" cy="${isBand ? '.5' : '.27'}" r="${isBand ? '.7' : '.9'}"><stop offset="0" stop-color="#2a0f08"/><stop offset=".45" stop-color="#120606"/><stop offset="1" stop-color="#050203"/></radialGradient>`,
    `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>`,
    `<radialGradient id="ember"><stop offset="0" stop-color="#ffd27a"/><stop offset=".4" stop-color="#ff7a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>`,
  ]
  const embers = Array.from({ length: isBand ? 16 : 22 }, (_, i) => {
    const rise = r(9 + hash(i, 91) * 10)
    return (
      `<g style="animation:rise ${rise}s ${r(-hash(i, 92) * rise)}s linear infinite">` +
      `<circle cx="${r(hash(i, 93) * W)}" cy="${r(H + 6)}" r="${r(1.5 + hash(i, 94) * 2.5)}" fill="url(#ember)" style="animation:flick ${r(0.8 + hash(i, 95))}s ${r(-hash(i, 96))}s ease-in-out infinite alternate"/></g>`
    )
  }).join('')
  const css =
    `@keyframes rise{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}100%{transform:translate(${r(W * 0.06)}px,${r(-H - 20)}px);opacity:0}}` +
    '@keyframes flick{from{opacity:.35}to{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){g,circle{animation:none!important}}'
  return {
    width: W,
    height: H,
    layers: lichLayers(),
    ink: 'glyph',
    period: 6,
    under: `<rect width="${W}" height="${H}" rx="12" fill="url(#dark)"/><g>${embers}</g>`,
    over: `<rect width="${W}" height="${H}" rx="12" fill="url(#vig)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="none" stroke="#ffcf8a" stroke-opacity=".1" stroke-width="2"/>`,
    defs,
    css: [css],
    sample() {
      return EMPTY
    },
  }
}

/** The Lich as a field scene, in glyphs: one pose a state, a little motion through the frames. */
function lichScene(view: View, state: VesselState, W: number, H: number): FieldScene {
  const backdrop = voidScene(W, H, view)
  const { cam } = framing(view, W, H)
  const models = new Map<number, ReturnType<typeof buildModel>>()
  const period = state === 'working' || state === 'thinking' ? 3 : 6
  return {
    ...backdrop,
    period,
    sample(x, y, frame, frames) {
      let m = models.get(frame)
      if (!m) {
        m = buildModel(restingPose(state, view, W, H, (frame / frames) * period), cam)
        models.set(frame, m)
      }
      return sampleModel(m, x, y)?.cell ?? EMPTY
    },
  }
}

export const lichPaneScene = (state: VesselState, W: number, H: number) => lichScene('pane', state, W, H)
export const lichBandScene = (state: VesselState, W: number, H: number) => lichScene('band', state, W, H)

export { BONE, CROWN, FIRE, FLAME, GEM, MANTLE, RUNE }
