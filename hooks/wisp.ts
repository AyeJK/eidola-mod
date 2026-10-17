// The Wisp's fen: a marsh at night, seen side on across the band. Indigo sky
// and a few stars, a far line of trees in the mist, still black water, reeds,
// and a boardwalk running the length of it. The fen is drawn once and never
// changes; the Wisp, its glow and its reflection are drawn live over it
// (wisp-live.tsx), on a grid both share through fenLayout.

import type { VesselState } from '../types'
import { EMPTY, hash } from './field'
import type { FieldScene, LayerStyle } from './field'
import { PX_H, PX_W } from './live-pixels'

/**
 * Where things lie on the live drawing's pixel grid (8 × 9.5 px, two rows a
 * cell row), for a band `cols` × `rows` cells: the row the water starts on,
 * and the boardwalk's row above it.
 */
export function fenLayout(_cols: number, rows: number): { water: number; deck: number; height: number } {
  const height = rows * 2
  const water = height - 4
  const deck = water - 1
  return { water, deck, height }
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** The fen's layers: none move in the field; it is all markup and CSS. */
function fenLayers(): LayerStyle[] {
  return [{ chars: ' ', shades: ['#000'], fill: '#000' }]
}

/**
 * The fen alone, `W` × `H` px, for a band `cols` × `rows` cells: the same
 * whatever the mood, so it never reloads. Its motion is CSS: stars twinkle,
 * the mist drifts, the reeds sway, light shivers on the water.
 */
export function fenScene(W: number, H: number, cols: number, rows: number): FieldScene {
  const { water, deck } = fenLayout(cols, rows)
  const waterY = water * PX_H
  const deckY = deck * PX_H
  const horizon = waterY - PX_H * 2.2
  const defs = [
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090818"/><stop offset=".6" stop-color="#16133a"/><stop offset="1" stop-color="#2a2152"/></linearGradient>`,
    `<linearGradient id="pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140f2e"/><stop offset="1" stop-color="#040309"/></linearGradient>`,
    `<radialGradient id="haze" cx=".5" cy="1" r=".8"><stop offset="0" stop-color="#6b5bd6" stop-opacity=".18"/><stop offset="1" stop-color="#6b5bd6" stop-opacity="0"/></radialGradient>`,
    `<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>`,
  ]

  // Stars: tiny, in the upper sky, each twinkling on its own clock.
  const stars = Array.from({ length: Math.round(W / 22) }, (_, i) => {
    const x = hash(i, 11) * W
    const y = hash(i, 12) * horizon * 0.8
    const t = r1(2 + hash(i, 13) * 4)
    return `<rect x="${r1(x)}" y="${r1(y)}" width="${hash(i, 14) < 0.2 ? 2 : 1}" height="${hash(i, 14) < 0.2 ? 2 : 1}" style="animation:tw ${t}s ${r1(-hash(i, 15) * t)}s ease-in-out infinite alternate"/>`
  }).join('')

  // The far trees: a ragged dark line on the horizon, stepped as pixel art.
  let trees = `M0 ${r1(horizon + 6)}`
  for (let x = 0; x <= W; x += PX_W) {
    const crown = hash(Math.floor(x / 40), 21) < 0.35 ? 10 + hash(Math.floor(x / 40), 22) * 16 : 0
    const h = 4 + hash(x, 23) * 5 + crown * (1 - Math.abs(((x % 40) - 20) / 20))
    trees += `V${r1(horizon - h)}h${PX_W}`
  }
  trees += `V${r1(waterY)}H0Z`

  // Mist: soft bands low over the water, drifting slowly side to side.
  const mist = [0, 1, 2]
    .map(i => {
      const y = horizon - 4 + i * PX_H * 0.7
      const t = 18 + i * 7
      return `<ellipse cx="${r1(W * (0.25 + i * 0.25))}" cy="${r1(y)}" rx="${r1(W * 0.45)}" ry="${r1(PX_H * 0.9)}" fill="#8d84c8" fill-opacity="${0.07 + i * 0.02}" filter="url(#soft)" style="animation:mist ${t}s ${-i * 5}s ease-in-out infinite alternate"/>`
    })
    .join('')

  // The boardwalk: one plank's depth on the deck row, posts down into the water.
  const posts = Array.from({ length: Math.ceil(W / 64) }, (_, i) => `<rect x="${i * 64 + 20}" y="${r1(deckY + PX_H)}" width="${PX_W}" height="${r1(PX_H * 2.2)}"/>`).join('')
  const deckMarkup =
    `<rect x="0" y="${r1(deckY)}" width="${W}" height="${r1(PX_H)}" fill="#1c1630"/>` +
    `<rect x="0" y="${r1(deckY)}" width="${W}" height="2" fill="#3a2f5e"/>` +
    `<g fill="#120e22">${posts}</g>`

  // Light on the water: thin lines that shiver, under the drawing's reflections.
  const glints = Array.from({ length: Math.round(W / 30) }, (_, i) => {
    const x = hash(i, 31) * W
    const y = waterY + PX_H * 1.2 + hash(i, 32) * (H - waterY - PX_H * 1.5)
    const t = r1(1.5 + hash(i, 33) * 2.5)
    return `<rect x="${r1(x)}" y="${r1(y)}" width="${8 + Math.round(hash(i, 34) * 16)}" height="1" style="animation:glint ${t}s ${r1(-hash(i, 35) * t)}s ease-in-out infinite alternate"/>`
  }).join('')

  // Reeds: clumps of thin dark blades rising out of the water near the
  // front, each swaying from its root.
  const reeds = Array.from({ length: Math.round(W / 46) }, (_, i) => {
    const x = hash(i, 41) * W
    const blades = 2 + Math.floor(hash(i, 42) * 3)
    const t = r1(3 + hash(i, 43) * 3)
    const root = H - hash(i, 44) * PX_H
    const parts = Array.from({ length: blades }, (_, k) => {
      const bx = x + (k - blades / 2) * 3
      const tall = PX_H * (2.2 + hash(i * 7 + k, 45) * 2.4)
      return `<rect x="${r1(bx)}" y="${r1(root - tall)}" width="2" height="${r1(tall)}"/>`
    }).join('')
    return `<g style="transform-origin:${r1(x)}px ${r1(root)}px;animation:sway ${t}s ${r1(-hash(i, 46) * t)}s ease-in-out infinite alternate">${parts}</g>`
  }).join('')

  const css = [
    '@keyframes tw{from{opacity:.25}to{opacity:.9}}',
    '@keyframes mist{from{transform:translateX(-30px)}to{transform:translateX(30px)}}',
    '@keyframes glint{from{opacity:.05}to{opacity:.35}}',
    '@keyframes sway{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}',
    '@media (prefers-reduced-motion:reduce){rect,ellipse,g{animation:none!important}}',
  ]

  return {
    width: W,
    height: H,
    layers: fenLayers(),
    ink: 'pixel',
    period: 6,
    under:
      `<rect width="${W}" height="${r1(waterY)}" fill="url(#sky)"/>` +
      `<g fill="#d8d2ff">${stars}</g>` +
      `<rect y="${r1(horizon - PX_H * 3)}" width="${W}" height="${r1(PX_H * 4)}" fill="url(#haze)"/>` +
      `<path d="${trees}" fill="#0c0a1c"/>` +
      mist +
      `<rect y="${r1(waterY)}" width="${W}" height="${r1(H - waterY)}" fill="url(#pool)"/>` +
      `<g fill="#a99cff">${glints}</g>` +
      deckMarkup,
    over: `<g fill="#07060f">${reeds}</g>`,
    defs,
    css,
    sample() {
      return EMPTY
    },
  }
}

/** The fen as a scene for a state, for anything that draws a scene by state: the state changes nothing in it. */
export function fenStateScene(_state: VesselState, W: number, H: number): FieldScene {
  return fenScene(W, H, Math.round(W / PX_W), Math.max(4, Math.round(H / (PX_H * 2))))
}
