// The Kraken as a field scene, for any ink. The pane is deep water with the
// Kraken spread across it; the band is the sea just under the surface, a
// hull above and arms rising out of the dark. Light falls in soft shafts
// that sway; runes and eyes glow; the arms sway through the frames.

import type { VesselState } from '../types'
import { EMPTY, clamp01, hash, noise, smoothstep } from './field'
import type { Cell, FieldScene, LayerStyle } from './field'

type Pt = [number, number]
const TAU = Math.PI * 2

// Layers, in drawing order.
const WATER = 1
export const BODY = 2
export const DETAIL = 3
export const GLOW = 4
const BUBBLE = 5
/** The iris up close: a palette of its own, from a deep teal rim to a pale centre. */
export const IRIS = 6

export function layers(isAngry: boolean): LayerStyle[] {
  const glow = isAngry ? '#ff5a4a' : '#5ff6ff'
  return [
    { chars: ' ', shades: [], fill: 'none' },
    // The water's motes and the bubbles are particles; the Kraken is pixels.
    { chars: " .'`:-~", shades: ['#0d3442', '#16495a', '#246475', '#3b8594'], fill: '#8fe3ec', opacity: 0.5, ink: 'particle' },
    {
      chars: ' .:;+x*%#@',
      shades: ['#0c161b', '#15242b', '#20353e', '#2f4a54', '#43636d', '#5f8189', '#87a7ae', '#b4cdd2'],
      fill: 'url(#skin)',
    },
    { chars: 'oO@', shades: ['#3c5860', '#9db7bb', '#d6e6e8'], fill: '#d2e4e7' },
    {
      chars: '+*#',
      shades: isAngry ? ['#5a1008', '#b8281a', '#ff5a4a', '#ffd2c8'] : ['#0b5c66', '#1fb2c0', '#5ff6ff', '#dcffff'],
      fill: glow,
      isGlowing: true,
    },
    { chars: '°oO', shades: ['#3b8594', '#8fd6df', '#d8f6fa'], fill: '#c9f3ff', opacity: 0.8, ink: 'particle' },
    { chars: '.:+*#', shades: ['#062a30', '#0a434c', '#0f5e68', '#178089', '#24a3ab', '#4cc6c9', '#93e4e0', '#d9fbf6'], fill: '#4cc6c9', isGlowing: true },
  ]
}

// ── Arms ───────────────────────────────────────────────────────────────

export type Arm = { pts: Pt[]; w: number[]; len: number; box: [number, number, number, number] }

type ArmSpec = { x: number; y: number; angle: number; len: number; curl: number; amp: number; k: number; w0: number }

function buildArm(a: ArmSpec, phase: number, n = 14): Arm {
  const pts: Pt[] = [[a.x, a.y]]
  let x = a.x
  let y = a.y
  const step = a.len / n
  for (let i = 1; i <= n; i += 1) {
    const s = i / n
    const theta = a.angle + a.curl * s * s * s + a.amp * Math.sin(TAU * a.k * s - phase) * s
    x += Math.cos(theta) * step
    y += Math.sin(theta) * step
    pts.push([x, y])
  }
  const w = pts.map((_, i) => Math.max(1.5, a.w0 * Math.pow(1 - i / n, 0.8)))
  const pad = a.w0
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  return { pts, w, len: a.len, box: [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad] }
}

/** Where a point falls on an arm: t along it, side across it (-1 to 1, signed), or undefined if off it. */
function onArm(arm: Arm, x: number, y: number): { t: number; side: number } | undefined {
  const [x0, y0, x1, y1] = arm.box
  if (x < x0 || x > x1 || y < y0 || y > y1) {
    return undefined
  }
  let best: { t: number; side: number } | undefined
  let bestD = Infinity
  const n = arm.pts.length - 1
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = arm.pts[i]!
    const [bx, by] = arm.pts[i + 1]!
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy || 1
    const u = clamp01(((x - ax) * dx + (y - ay) * dy) / l2)
    const px = ax + dx * u
    const py = ay + dy * u
    const d = Math.hypot(x - px, y - py)
    const half = (arm.w[i]! + (arm.w[i + 1]! - arm.w[i]!) * u) / 2
    if (d <= half && d < bestD) {
      bestD = d
      const cross = dx * (y - ay) - dy * (x - ax)
      best = { t: (i + u) / n, side: (cross < 0 ? -1 : 1) * (d / half) }
    }
  }
  return best
}

// ── The Kraken ─────────────────────────────────────────────────────────

export type Runes = 'faint' | 'calm' | 'pulse' | 'bright'
const RUNE_LEVEL: Record<Runes, number> = { faint: 0.25, calm: 0.55, pulse: 0.8, bright: 1 }

export type Pose = {
  cx: number
  cy: number
  /** Mantle width. */
  s: number
  /** 1 lit by the surface, toward 0 lost in the dark. */
  depth: number
  runes: Runes
  /** The runes' glow, 0 to 1, in place of `runes`' level: what a live drawing eases. */
  runeLevel?: number
  isAngry?: boolean
  /** 0 open, 1 shut. */
  lid?: number
  /** Pupils: -1 left, 1 right. */
  look?: number
  /** Whether it has arms of its own. */
  hasArms: boolean
  reach?: number
  sway: number
}

const ARM_ANGLES = [-28, 14, 48, 76, 104, 132, 166, 208]

export function krakenArms(p: Pose, phase: number): Arm[] {
  if (!p.hasArms) {
    return []
  }
  return ARM_ANGLES.map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const h = hash(i, 7)
    return buildArm(
      {
        x: p.cx + Math.cos(a) * p.s * 0.34,
        y: p.cy + p.s * 0.3 + Math.sin(a) * p.s * 0.1,
        angle: a + (h - 0.5) * 0.3,
        len: p.s * (p.reach ?? 2.8) * (0.8 + hash(i, 3) * 0.4),
        curl: (i % 2 ? 1 : -1) * (1.8 + h * 1.6),
        amp: p.sway * (0.8 + hash(i, 5) * 0.4),
        k: 0.6 + hash(i, 9) * 0.3,
        w0: p.s * 0.4,
      },
      phase + i * 0.9,
    )
  })
}

/** The Kraken at a point: its body, suckers, runes and eyes. */
export function krakenAt(p: Pose, arms: Arm[], x: number, y: number, frame: number): Cell | undefined {
  const { cx, cy, s } = p
  const lvl = p.runeLevel ?? RUNE_LEVEL[p.runes]

  // Eyes.
  for (const side of [-1, 1]) {
    const ex = cx + side * s * 0.44
    const ey = cy + s * 0.1
    const er = s * 0.1
    const d = Math.hypot(x - ex, (y - ey) * 1.2)
    if (d < er) {
      const lid = p.lid ?? 0
      if (y - ey < -er + 2 * er * lid) {
        return [BODY, 0.45 * p.depth]
      }
      const px = ex + (p.look ?? 0) * er * 0.3
      if (Math.abs(y - ey) < er * 0.2 && Math.abs(x - px) < er * 0.62) {
        return [BODY, 0.02]
      }
      return [GLOW, 0.75 + 0.25 * (1 - d / er)]
    }
    if (d < er * 1.7) {
      return [BODY, (0.7 + 0.2 * (1 - d / (er * 1.7))) * p.depth]
    }
  }

  // Mantle: a sack swept up from a wide rim.
  const u = (x - cx) / s
  const v = (y - cy) / s
  const sack = (u / 0.62) ** 2 + ((v + 0.42) / 0.78) ** 2
  const rim = (u / 0.6) ** 2 + ((v - 0.12) / 0.3) ** 2
  if (sack < 1 || rim < 1) {
    const top = smoothstep(0.2, -0.9, v) // lighter toward the crown
    const edge = Math.min(1, Math.max(sack, rim < 1 ? 0 : 1))
    const mottle = 0.82 + 0.25 * noise(x / (s * 0.12), y / (s * 0.12))
    const rimLight = smoothstep(0.75, 1, sack) * smoothstep(0, -0.7, v) * 0.35
    return [BODY, clamp01((0.28 + 0.5 * top + rimLight) * mottle * (1 - 0.15 * edge) * p.depth)]
  }

  // Arms.
  for (const arm of arms) {
    const hit = onArm(arm, x, y)
    if (!hit) {
      continue
    }
    const { t, side } = hit
    const along = t * arm.len
    // Ringed suckers down the underside.
    if (side < -0.38 && side > -0.92 && t < 0.88) {
      const spacing = Math.max(6, arm.w[Math.floor(t * (arm.w.length - 1))]! * 0.45)
      const ph = (along / spacing) % 1
      if (ph < 0.5) {
        return [DETAIL, (0.55 + 0.4 * (1 - Math.abs(ph - 0.25) * 4)) * p.depth]
      }
    }
    // Runes down the spine.
    if (Math.abs(side) < 0.16 && t > 0.05 && t < 0.8) {
      const mark = Math.floor(along / 9) % 6
      if (mark === 0 || mark === 2 || mark === 3) {
        return [GLOW, lvl * 0.9]
      }
    }
    // Lit along the top, shadowed underneath, dark at the edges.
    const lit = 0.3 + 0.45 * clamp01(side * 0.6 + 0.5)
    const edgeDark = Math.abs(side) > 0.88 ? 0.55 : 1
    const mottle = 0.85 + 0.2 * noise(x / 14, y / 14)
    return [BODY, clamp01(lit * edgeDark * mottle * (1 - 0.35 * t) * p.depth)]
  }
  return undefined
}

// ── Water ──────────────────────────────────────────────────────────────

type Shaft = { x: number; w: number; slope: number; sway: number; strength: number }

function shaftsFor(W: number, count: number, seed: number): Shaft[] {
  return Array.from({ length: count }, (_, i) => ({
    x: W * ((i + 0.5) / count) + (hash(i, seed) - 0.5) * W * 0.12,
    w: W * (0.025 + hash(i, seed + 1) * 0.04),
    slope: 0.12 + hash(i, seed + 2) * 0.12,
    sway: W * 0.02,
    strength: 0.5 + hash(i, seed + 3) * 0.5,
  }))
}

/** Soft light shafts, caustic shimmer near the surface, specks and bubbles. */
function waterAt(W: number, H: number, shafts: Shaft[], x: number, y: number, phase: number, dim: number, surfaceY: number): Cell {
  let light = 0
  for (const [i, sh] of shafts.entries()) {
    const centre = sh.x + sh.slope * (y - surfaceY) + Math.sin(phase + i * 1.7) * sh.sway
    const across = (x - centre) / sh.w
    light += Math.exp(-across * across) * sh.strength
  }
  const fall = Math.exp(-(y - surfaceY) / (H * 0.45))
  let v = light * fall * (0.55 + 0.45 * noise(x / 18 + phase * 0.3, y / 26))
  // Caustics: a band of shimmer just below the surface.
  const band = Math.exp(-(((y - surfaceY) / (H * 0.035)) ** 2))
  v += band * smoothstep(0.45, 0.8, noise(x / 11 + phase * 0.6, y / 7)) * 0.9
  // Specks.
  if (hash(Math.floor(x / 5), Math.floor(y / 5)) > 0.985) {
    v = Math.max(v, 0.35)
  }
  v *= dim
  return v > 0.14 ? [WATER, v] : EMPTY
}

/** Bubbles rising through the frames: a column of small rings. */
function bubbleAt(x: number, y: number, cx: number, spread: number, bottom: number, height: number, frame: number, frames: number): Cell | undefined {
  for (let i = 0; i < 14; i += 1) {
    const bx = cx + (hash(i, 31) - 0.5) * spread + Math.sin(frame * 1.3 + i) * 4
    const travel = ((hash(i, 37) + frame / frames) % 1) * height
    const by = bottom - travel
    const br = 3 + hash(i, 41) * 4
    if (Math.hypot(x - bx, y - by) < br) {
      return [BUBBLE, 0.35 + hash(i, 43) * 0.65]
    }
  }
  return undefined
}

function backdrop(W: number, H: number, top: string, mid: string, defs: string[]): string {
  defs.push(
    `<linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".35" stop-color="${mid}"/><stop offset="1" stop-color="#02070b"/></linearGradient>`,
    `<linearGradient id="skin" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#d4e8eb"/><stop offset="1" stop-color="#7c9ba2"/></linearGradient>`,
    `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>`,
  )
  return `<rect width="${W}" height="${H}" rx="12" fill="url(#deep)"/>`
}

const OVER = (W: number, H: number) =>
  `<rect width="${W}" height="${H}" rx="12" fill="url(#vig)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11" fill="none" stroke="#bfefff" stroke-opacity=".12" stroke-width="2"/>`

// ── Scenes ─────────────────────────────────────────────────────────────

function deepPose(state: VesselState, W: number, H: number): Pose {
  const s = Math.min(W * 0.44, H * 0.26)
  const base = { cx: W * 0.5, cy: H * 0.42, s, depth: 1, hasArms: true, sway: 0.3 }
  switch (state) {
    case 'idle':
      return { ...base, cx: W * 0.55, cy: H * 0.74, depth: 0.45, runes: 'faint', sway: 0.2 }
    case 'sleeping':
      return { ...base, cy: H * 0.82, depth: 0.3, runes: 'faint', lid: 1, sway: 0.12 }
    case 'thinking':
      return { ...base, runes: 'pulse', look: 0.4 }
    case 'working':
      return { ...base, cx: W * 0.45, cy: H * 0.38, depth: 0.9, runes: 'bright', look: 0.5, sway: 0.45 }
    case 'responding':
      return { ...base, runes: 'calm', look: -0.3, sway: 0.35 }
    case 'waiting':
      return { ...base, cy: H * 0.56, depth: 0.75, runes: 'faint', lid: 0.5, look: -0.5, sway: 0.2 }
    case 'attention':
      return { ...base, cx: W - s * 0.12, cy: H * 0.4, s: s * 1.35, runes: 'bright', look: -1, hasArms: false }
    case 'success':
      return { ...base, runes: 'bright', sway: 0.4 }
    case 'error':
      return { ...base, cy: H * 0.45, runes: 'bright', isAngry: true, sway: 0.6 }
  }
}

/** Arms that belong to the scene rather than the body: tips round the edge while it peeks. */
function sceneArms(state: VesselState, pose: Pose, W: number, H: number, phase: number): Arm[] {
  if (state === 'attention') {
    // Tips curling round the right edge, below the peering head.
    return [0, 1, 2].map(i =>
      buildArm(
        { x: W + 10, y: H * (0.58 + i * 0.12), angle: Math.PI + (i - 1) * 0.25, len: pose.s * 1.1, curl: (i % 2 ? 1 : -1) * 2.6, amp: 0.3, k: 0.8, w0: pose.s * 0.22 },
        phase + i,
      ),
    )
  }
  return []
}

/** The pane: deep water, the Kraken spread across it. */
export function krakenPaneScene(state: VesselState, W: number, H: number): FieldScene {
  const pose = deepPose(state, W, H)
  const shafts = shaftsFor(W, 5, 11)
  const armsByFrame = new Map<number, Arm[]>()
  const defs: string[] = []
  const under = backdrop(W, H, '#1d6170', '#0a2e3b', defs)
  const busy = state === 'working' || state === 'error'
  return {
    width: W,
    height: H,
    layers: layers(!!pose.isAngry),
    ink: 'pixel',
    period: busy ? 3.2 : state === 'sleeping' ? 10 : 6,
    under,
    over: OVER(W, H),
    defs,
    css: [],
    sample(x, y, frame, frames, want) {
      if (want.has(BODY)) {
        let arms = armsByFrame.get(frame)
        if (!arms) {
          arms = [...sceneArms(state, pose, W, H, (frame / frames) * TAU), ...krakenArms(pose, (frame / frames) * TAU)]
          armsByFrame.set(frame, arms)
        }
        return krakenAt(pose, arms, x, y, frame) ?? EMPTY
      }
      return bubbleAt(x, y, pose.cx, W * 0.7, Math.min(H, pose.cy + pose.s * 0.4), H * 0.6, frame, frames) ?? EMPTY
    },
    still(x, y, want) {
      if (want.has(BODY)) {
        return EMPTY
      }
      return waterAt(W, H, shafts, x, y, 0, state === 'sleeping' ? 0.4 : 1, 0)
    },
  }
}

/** The band: just under the surface, a hull above, arms rising from below. */
export function krakenBandScene(state: VesselState, W: number, H: number): FieldScene {
  const surfaceY = H * 0.14
  const shafts = shaftsFor(W, 8, 23)
  const hx = W * 0.68
  const hl = Math.min(W * 0.09, H * 0.6)
  const isAngry = state === 'error'
  const depth = state === 'idle' ? 0.4 : state === 'sleeping' ? 0.25 : 1
  const runes: Runes = state === 'working' || state === 'error' ? 'bright' : state === 'thinking' ? 'pulse' : 'faint'
  const rising: Array<[number, number, number, number]> =
    state === 'working'
      ? [
          [0.42, 0.35, 1.25, 2.6],
          [0.53, 0.15, 1.35, -2.2],
          [0.6, 0.05, 1.2, 2.4],
          [0.82, -0.35, 1.2, -2.6],
        ]
      : state === 'thinking' || state === 'responding' || state === 'success' || state === 'error'
        ? [
            [0.26, 0.25, 1.05, 2.4],
            [0.4, -0.2, 0.95, -2.2],
          ]
        : state === 'idle'
          ? [[0.12, 0.3, 0.8, 2.2]]
          : []
  const pose: Pose = { cx: W * 0.2, cy: H * 0.7, s: H * 0.55, depth: 1, runes: 'bright', look: -1, hasArms: false, sway: 0, lid: state === 'waiting' ? 0.5 : 0 }
  const showHead = state === 'attention' || state === 'waiting'
  if (state === 'waiting') {
    pose.cy = H * 0.86
  }
  const armsByFrame = new Map<number, Arm[]>()
  const defs: string[] = []
  const under =
    backdrop(W, H, '#3f9aa8', '#0f4757', defs) +
    `<path d="M0 0H${W}V${Math.round(surfaceY)}H0Z" fill="#a8e8f0" fill-opacity=".35"/>` +
    `<path d="M${Math.round(hx - hl)} ${Math.round(surfaceY - 2)}Q${Math.round(hx)} ${Math.round(surfaceY + H * 0.22)} ${Math.round(hx + hl)} ${Math.round(surfaceY - 2)}Z" fill="#051a22"/>`
  return {
    width: W,
    height: H,
    layers: layers(isAngry),
    ink: 'pixel',
    period: state === 'working' || state === 'error' ? 3.2 : 6,
    under,
    over: OVER(W, H),
    defs,
    css: [],
    sample(x, y, frame, frames, want) {
      if (!want.has(BODY)) {
        return bubbleAt(x, y, W * 0.45, W * 0.8, H + 4, H * 0.9, frame, frames) ?? EMPTY
      }
      const phase = (frame / frames) * TAU
      let arms = armsByFrame.get(frame)
      if (!arms) {
        arms = rising.map(([px, lean, reach, curl], i) =>
          buildArm({ x: W * px, y: H + 14, angle: -Math.PI / 2 + lean, len: H * reach, curl, amp: 0.3, k: 0.7, w0: H * 0.3 }, phase + i * 1.3, 12),
        )
        armsByFrame.set(frame, arms)
      }
      const armPose: Pose = { ...pose, depth, runes, isAngry, hasArms: true }
      const k = krakenAt(showHead ? { ...pose, isAngry } : { ...armPose, cx: -1e4, cy: -1e4 }, arms, x, y, frame)
      return k ?? EMPTY
    },
    still(x, y, want) {
      if (want.has(BODY)) {
        return EMPTY
      }
      // Nothing drawn over the hull.
      const hy = surfaceY + H * 0.22 * (1 - ((x - hx) / hl) ** 2) * 0.5
      if (Math.abs(x - hx) < hl && y < hy) {
        return EMPTY
      }
      // The surface overhead: bright, its edge rippling.
      const edge = surfaceY + Math.sin(x / 26) * 2.5 + Math.sin(x / 9) * 1.2
      if (y < edge) {
        return [WATER, 0.75 + 0.25 * noise(x / 8, y / 4)]
      }
      return waterAt(W, H, shafts, x, y, 0, state === 'sleeping' ? 0.4 : 1, surfaceY)
    },
  }
}

// ── Live ───────────────────────────────────────────────────────────────

/**
 * The deep water alone, the same whatever the mood: drawn once as an SVG
 * whose source never changes, under the live Kraken. Since it never
 * reloads, its motion is all CSS and runs on unbroken: soft light sways
 * down from the surface, bubbles rise and wobble, specks of snow drift.
 */
export function krakenWaterScene(W: number, H: number): FieldScene {
  const defs: string[] = []
  const r = (n: number) => Math.round(n * 10) / 10

  // Open water: nothing blocks the light, so no shafts; it only fades with
  // depth, a little brighter toward the surface.
  defs.push(
    `<radialGradient id="glow" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#bff4ff" stop-opacity=".18"/><stop offset="1" stop-color="#bff4ff" stop-opacity="0"/></radialGradient>`,
  )
  const under = backdrop(W, H, '#1d6170', '#0a2e3b', defs) + `<rect width="${W}" height="${r(H * 0.55)}" fill="url(#glow)"/>`

  // Bubbles: some in streams from below, some loose, each rising the whole height.
  const vents = [W * 0.18, W * 0.62, W * 0.84]
  const bubbles = Array.from({ length: 30 }, (_, i) => {
    const inStream = i < 18
    const x = inStream ? vents[i % vents.length]! + (hash(i, 51) - 0.5) * 14 : hash(i, 52) * W
    const size = 1.5 + hash(i, 53) * 4
    const rise = r(7 + hash(i, 54) * 9)
    const wobble = r(1.2 + hash(i, 55) * 1.6)
    return (
      `<g style="animation:rise ${rise}s ${r(-hash(i, 56) * rise)}s linear infinite">` +
      `<circle cx="${r(x)}" cy="${r(H + 8)}" r="${r(size)}" style="animation:wobble ${wobble}s ${r(-hash(i, 57) * wobble)}s ease-in-out infinite alternate"/></g>`
    )
  }).join('')

  // Marine snow at three depths: far specks tiny, dim and slow, near ones
  // larger, brighter and quicker. The parallax gives the water its depth.
  const depths = [
    { count: 55, size: 0.5, spread: 0.5, fall: [34, 52], opacity: 0.35, seed: 61 },
    { count: 30, size: 0.9, spread: 0.7, fall: [20, 32], opacity: 0.55, seed: 81 },
    { count: 12, size: 1.6, spread: 1, fall: [11, 18], opacity: 0.75, seed: 91 },
  ] as const
  const snow = depths
    .map(d => {
      const specks = Array.from({ length: d.count }, (_, i) => {
        const fall = r(d.fall[0] + hash(i, d.seed) * (d.fall[1] - d.fall[0]))
        return `<circle cx="${r(hash(i, d.seed + 1) * W)}" cy="${r(hash(i, d.seed + 2) * H * 0.9)}" r="${r(d.size + hash(i, d.seed + 3) * d.spread)}" style="animation:snow ${fall}s ${r(-hash(i, d.seed + 4) * fall)}s linear infinite"/>`
      }).join('')
      return `<g fill-opacity="${d.opacity}">${specks}</g>`
    })
    .join('')

  const css =
    `@keyframes rise{from{transform:translateY(0)}to{transform:translateY(${r(-H - 20)}px)}}` +
    '@keyframes wobble{from{transform:translateX(-5px)}to{transform:translateX(5px)}}' +
    `@keyframes snow{0%{transform:translate(0,0);opacity:0}12%{opacity:.7}88%{opacity:.5}100%{transform:translate(14px,${r(H * 0.4)}px);opacity:0}}` +

    '@media (prefers-reduced-motion:reduce){g,circle,path{animation:none!important}}'

  return {
    width: W,
    height: H,
    layers: layers(false),
    ink: 'particle',
    period: 6,
    under,
    over:
      `<g fill="#d9f2ff">${snow}</g>` +
      `<g fill="none" stroke="#c9f3ff" stroke-opacity=".65" stroke-width="1">${bubbles}</g>` +
      OVER(W, H),
    defs,
    css: [css],
    sample() {
      return EMPTY
    },
  }
}
