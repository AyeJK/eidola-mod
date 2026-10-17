// The stage: the Vessel set in a scene the size of the pane body, so the
// pane reads as a place rather than a small image in a large box. A glow
// and a wash in the state's colour, a soft floor shadow, motes rising at
// the state's tempo. Every layer fades to transparent before the edge, so
// an estimate a few pixels off never shows a seam, in either theme.

import type { VesselState } from '../types'

// Measured on Claude Code Desktop with /eidola measure (2026-10-16): a
// 52 × 76 cell dock body drew 412 × 1443 px, a 95-column band 756 px.
export const PX_PER_COLUMN = 8
export const PX_PER_ROW = 19

/** The dark behind a band view drawn across the middle of the pane. */
export const BACKDROP = '#07090c'

/** The veil drawn over the resting scene while nothing is awake. */
export const VEIL = '#000'

/** The Svg element's limit on `source`. */
export const SVG_LIMIT = 131072

/**
 * The band's square stage, in CSS pixels. Desktop draws the band at least
 * about 170px tall whatever its tree, so this fills it rather than float.
 */
export const BAND_STAGE_PX = 140

/** Inline the pane fits its tree, so the stage asks for no more than this. */
const INLINE_ROWS = 10

export type StageSize = { width: number; height: number }

export const ACCENTS: Record<VesselState, string> = {
  idle: '#8fa3bf',
  thinking: '#8c7bff',
  working: '#ffb547',
  attention: '#ffd84a',
  success: '#5fd38d',
  responding: '#4fd1c5',
  error: '#ff5c5c',
  waiting: '#b39ddb',
  sleeping: '#4a5a80',
}

/** Seconds per glow breath. */
const BREATH: Record<VesselState, number> = {
  idle: 6,
  thinking: 3,
  working: 1.6,
  attention: 1.2,
  success: 2.4,
  responding: 2.4,
  error: 1,
  waiting: 4,
  sleeping: 9,
}

/** Seconds for a mote to rise; busier states rise faster. */
const RISE: Record<VesselState, number> = {
  idle: 14,
  thinking: 9,
  working: 5,
  attention: 7,
  success: 6,
  responding: 8,
  error: 10,
  waiting: 12,
  sleeping: 22,
}

const MOTES = 18

/** The pane body in CSS pixels, a cell short each way so it never overflows. */
export function stageSize(columns: number, rows: number, placement: 'dock' | 'inline'): StageSize {
  const usable = placement === 'inline' ? Math.min(rows, INLINE_ROWS) : rows
  return {
    width: Math.max(96, (columns - 1) * PX_PER_COLUMN),
    height: Math.max(96, (usable - 1) * PX_PER_ROW),
  }
}

/** A scene band's height: it fills the band's own minimum height. */
export const BAND_SCENE_PX = 140

/**
 * The whole pane body in CSS pixels, for a scene that fills it edge to edge.
 * The measured dock body was 4px under columns × 8 and 2px under rows × 19.
 */
export function sceneSize(columns: number, rows: number, placement: 'dock' | 'inline'): StageSize {
  const usable = placement === 'inline' ? Math.min(rows, INLINE_ROWS) : rows
  return {
    width: Math.max(96, columns * PX_PER_COLUMN - 4),
    height: Math.max(96, usable * PX_PER_ROW - 2),
  }
}

type Box = { x: number; y: number; w: number; h: number }

function viewBoxOf(svg: string): Box | undefined {
  const m = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(svg)
  if (!m) {
    return undefined
  }
  const [x, y, w, h] = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number]
  return w > 0 && h > 0 ? { x, y, w, h } : undefined
}

/** A fixed sequence in [0, 1): the motes sit in the same places every draw. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * The Vessel's SVG set on a stage of `size`, or undefined when it can't be:
 * no viewBox to place it by, or the result past the Svg limit. The caller
 * then draws the Vessel alone.
 */
export function stageSvg(vessel: string, state: VesselState, size: StageSize): string | undefined {
  const box = viewBoxOf(vessel)
  if (!box) {
    return undefined
  }
  const { width: W, height: H } = size
  const accent = ACCENTS[state]

  // A tall dock seats the Vessel above centre, leaving room for its shadow.
  const isTall = H > W * 1.2
  const scale = Math.min((W * 0.72) / box.w, (H * (isTall ? 0.42 : 0.78)) / box.h)
  const vw = box.w * scale
  const vh = box.h * scale
  const cx = W / 2
  const cy = isTall ? H * 0.42 : H / 2
  const vx = cx - vw / 2
  const vy = cy - vh / 2
  const reach = Math.max(vw, vh)
  // The wash is an ellipse that ends at the nearest edge on each axis, and
  // the glow a circle inside it, so neither tints an edge into a seam.
  const rx = Math.max(1, Math.min(cx, W - cx))
  const ry = Math.max(1, Math.min(cy, H - cy))
  const glowR = Math.min(reach * 0.95, rx, ry)

  const random = seeded(7)
  const rise = Math.round(Math.min(H * 0.55, reach * 2.2))
  const motes: string[] = []
  for (let i = 0; i < MOTES; i += 1) {
    const x = r1(cx + (random() - 0.5) * Math.min(W * 0.85, reach * 2))
    const y = r1(cy + vh * 0.2 + random() * vh * 0.5)
    const r = r1(0.8 + random() * 1.6)
    const dur = r1(RISE[state] * (0.7 + random() * 0.6))
    const delay = r1(-random() * dur)
    motes.push(`<circle class="eds-mote" cx="${x}" cy="${y}" r="${r}" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`)
  }

  // The Vessel nested at its place: its own width/height dropped, the slot's set.
  const nested = vessel.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    const kept = attrs.replace(/\s(width|height|x|y|preserveAspectRatio)="[^"]*"/g, '')
    return `<svg x="${r1(vx)}" y="${r1(vy)}" width="${r1(vw)}" height="${r1(vh)}" preserveAspectRatio="xMidYMid meet"${kept}>`
  })

  const css =
    `.eds-glow{animation:eds-breath ${BREATH[state]}s ease-in-out infinite alternate}` +
    '@keyframes eds-breath{from{opacity:.6}to{opacity:1}}' +
    `.eds-mote{fill:${accent};opacity:0;animation-name:eds-rise;animation-timing-function:linear;animation-iteration-count:infinite}` +
    `@keyframes eds-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.75}80%{opacity:.4}100%{transform:translateY(-${rise}px);opacity:0}}` +
    '@media (prefers-reduced-motion:reduce){.eds-glow,.eds-mote{animation:none}.eds-mote{opacity:.35}}'

  const out =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<style>${css}</style>` +
    '<defs>' +
    `<radialGradient id="eds-wash" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" ` +
    `gradientTransform="translate(${r1(cx)} ${r1(cy)}) scale(${r1(rx)} ${r1(ry)})">` +
    `<stop offset="0" stop-color="${accent}" stop-opacity=".14"/><stop offset=".45" stop-color="${accent}" stop-opacity=".07"/>` +
    `<stop offset=".75" stop-color="${accent}" stop-opacity=".02"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="eds-glow" gradientUnits="userSpaceOnUse" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(glowR)}">` +
    `<stop offset="0" stop-color="${accent}" stop-opacity=".42"/><stop offset=".35" stop-color="${accent}" stop-opacity=".2"/>` +
    `<stop offset=".65" stop-color="${accent}" stop-opacity=".06"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>` +
    '<radialGradient id="eds-floor"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    `<rect width="${W}" height="${H}" fill="url(#eds-wash)"/>` +
    `<rect class="eds-glow" width="${W}" height="${H}" fill="url(#eds-glow)"/>` +
    `<ellipse cx="${r1(cx)}" cy="${r1(vy + vh * 1.04)}" rx="${r1(vw * 0.45)}" ry="${r1(Math.max(3, vh * 0.05))}" fill="url(#eds-floor)"/>` +
    `<g>${motes.join('')}</g>` +
    nested +
    '</svg>'

  return out.length <= SVG_LIMIT ? out : undefined
}
