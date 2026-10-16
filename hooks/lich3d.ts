// The Lich in three dimensions, for the live drawing: a crowned skull with
// soul-fire in its sockets, a high collar rising behind it, a mantle over
// bony shoulders, robes whose ragged hem frays into ash. Seen close through the glass, in perspective;
// each point takes whatever is nearest.
//
// World: x right, y down, z away from the glass, in pixels; the glass is
// z 0. The skull and crown are one distance field, the body another, each
// marched per point; the fire, its flames and the ash are points on the glass.

import { clamp01, hash, noise } from './field'
import type { Cell } from './field'

export type V3 = [number, number, number]
const TAU = Math.PI * 2

// Layers.
export const BONE = 1
export const CROWN = 2
export const MANTLE = 3
export const FIRE = 4
export const RUNE = 5
export const GEM = 6
/** The flame its eyes stream when it works: arcane fire, apart from the eyes themselves. */
export const FLAME = 7

/** Where perspective converges, and how strongly. */
export type Camera = { cx: number; cy: number; f: number }

/** Everything the live drawing animates about the Lich. */
export type Pose = {
  /** The skull's centre, in world pixels. */
  pos: V3
  /** The head's size: about half the skull's width, in world pixels. */
  s: number
  /** The head: turned (+ to our right), nodded (+ down), tilted (+ clockwise). */
  yaw: number
  pitch: number
  roll: number
  /** The shoulders' own turn. */
  bodyYaw: number
  /** 0 shut, 1 open. */
  jaw: number
  /** The soul-fire: 0 embers, 1 burning, more flares. */
  eyes: number
  /** Where the fire looks, within the sockets: -1 to 1 each way. */
  look: [number, number]
  /** Flame streaming up from the sockets, 0 to 1. */
  flame: number
  /** The runes about its head: how many show (0 to 1), and how far round they are (radians). */
  runes: number
  spin: number
  /** Seconds. */
  t: number
  /** How much light reaches it, 0 to 1. */
  light: number
  /** Each arm, its left then its right (our right, then our left): how far raised and how far flung out. */
  arms: [ArmPose, ArmPose]
}

/**
 * An arm: 0 hanging at its side, hand down; `raise` 1 bent up before the
 * chest, hand up; `spread` 1 flung out wide, palm up.
 */
export type ArmPose = { raise: number; spread: number }

/** Arms at rest: down at its sides. */
export const ARMS_DOWN: [ArmPose, ArmPose] = [
  { raise: 0, spread: 0 },
  { raise: 0, spread: 0 },
]

type Mat = [V3, V3, V3]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1))

/** A rotation: yaw about y, then pitch about x, then roll about z. */
function rotation(yaw: number, pitch: number, roll: number): Mat {
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)]
  const rz: Mat = [
    [cr, -sr, 0],
    [sr, cr, 0],
    [0, 0, 1],
  ]
  const rx: Mat = [
    [1, 0, 0],
    [0, cp, -sp],
    [0, sp, cp],
  ]
  const ry: Mat = [
    [cy, 0, -sy],
    [0, 1, 0],
    [sy, 0, cy],
  ]
  return matMul(ry, matMul(rx, rz))
}

function matMul(a: Mat, b: Mat): Mat {
  const row = (i: number): V3 => [0, 1, 2].map(j => a[i]![0] * b[0]![j]! + a[i]![1] * b[1]![j]! + a[i]![2] * b[2]![j]!) as V3
  return [row(0), row(1), row(2)]
}

const apply = (m: Mat, v: V3): V3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)]
const applyT = (m: Mat, v: V3): V3 => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]]

function project(cam: Camera, p: V3): { x: number; y: number; z: number; k: number } {
  const k = cam.f / (cam.f + Math.max(-cam.f * 0.95, p[2]))
  return { x: cam.cx + (p[0] - cam.cx) * k, y: cam.cy + (p[1] - cam.cy) * k, z: p[2], k }
}

// ── Distance fields, in the head's or the body's own units ────────────────

/** An ellipsoid's distance, near enough to march by. */
function ell(px: number, py: number, pz: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): number {
  const x = (px - cx) / rx
  const y = (py - cy) / ry
  const z = (pz - cz) / rz
  const k0 = Math.sqrt(x * x + y * y + z * z)
  const k1 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2)
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)

function capsule(px: number, py: number, pz: number, a: V3, b: V3, r: number): number {
  const ba = sub(b, a)
  const pa: V3 = [px - a[0], py - a[1], pz - a[2]]
  const h = clamp01(dot(pa, ba) / dot(ba, ba))
  return len(sub(pa, mul(ba, h))) - r
}

/** The sockets: centre and radii, mirrored about x. */
const SOCKET = { x: 0.19, y: 0.08, z: -0.44, rx: 0.15, ry: 0.13, rz: 0.18 }
/** The soul-fire's place within each socket. */
const EMBER = { x: 0.19, y: 0.1, z: -0.36 }

/** The skull: about 1 wide and 1.3 tall; x right, y down, z back. */
function skull(px: number, py: number, pz: number, jaw: number): number {
  const ax = Math.abs(px)
  let d = ell(px, py, pz, 0, -0.15, 0.08, 0.52, 0.5, 0.6)
  d = smin(d, ell(px, py, pz, 0, 0.18, -0.12, 0.42, 0.42, 0.42), 0.12)
  d = smin(d, ell(ax, py, pz, 0.31, 0.17, -0.22, 0.14, 0.12, 0.14), 0.08)
  d = smin(d, ell(px, py, pz, 0, 0.43, -0.27, 0.24, 0.12, 0.2), 0.08)
  const drop = jaw * 0.1
  const mandible = smin(ell(px, py, pz, 0, 0.63 + drop, -0.17 + drop * 0.3, 0.27, 0.1, 0.23), ell(ax, py, pz, 0.27, 0.45 + drop * 0.5, -0.02, 0.07, 0.2, 0.09), 0.06)
  d = jaw > 0.05 ? Math.min(d, mandible) : smin(d, mandible, 0.04)
  d = smax(d, -ell(ax, py, pz, SOCKET.x, SOCKET.y, SOCKET.z, SOCKET.rx, SOCKET.ry, SOCKET.rz), 0.04)
  d = smax(d, -ell(px, py, pz, 0, 0.3, -0.45, 0.06, 0.09, 0.13), 0.03)
  d = smax(d, -ell(ax, py, pz, 0.57, 0.1, -0.06, 0.13, 0.16, 0.14), 0.06)
  return d
}

/** Seven points, the front one tallest: how high the crown rises at an angle round it (0 at the front). */
function crownTop(theta: number): number {
  const k = (theta / TAU) * 7 + 0.5
  const tooth = Math.pow(1 - Math.abs(k - Math.floor(k) - 0.5) * 2, 1.6)
  const front = Math.cos(theta) > 0 ? 1 + 0.5 * Math.cos(theta) ** 8 : 1
  return -0.43 - 0.3 * tooth * front
}

/** The crown: a thin band round the brow that flares as it rises into its points. */
function crown(px: number, py: number, pz: number): number {
  const x = px / 0.5
  const z = (pz - 0.08) / 0.57
  const theta = Math.atan2(x, -z)
  const flare = 1 + 0.35 * Math.max(0, -0.3 - py)
  const shell = Math.abs(Math.hypot(x, z) - flare) * 0.5 - 0.025
  return Math.max(shell, crownTop(theta) - py, py + 0.28)
}

/** The head: skull and crown, and which of them is nearer. */
function head(px: number, py: number, pz: number, jaw: number): { d: number; isCrown: boolean } {
  const a = skull(px, py, pz, jaw)
  const b = crown(px, py, pz)
  return b < a ? { d: b, isCrown: true } : { d: a, isCrown: false }
}

/**
 * The body from the base of the neck: a cultist's robe. Shoulders, a chest,
 * the robe falling long below; a high collar behind the head; arms bent at
 * the elbow in wide bell sleeves; bony hands raised from the cuffs; a cord
 * knotted at the waist with two tassels hanging.
 */
function body(px: number, py: number, pz: number): number {
  return Math.min(robe(px, py, pz), sleeves(px, py, pz), hands(px, py, pz), cord(px, py, pz))
}

/** Shoulders, chest and the long robe, and the collar rising behind the head. */
function robe(px: number, py: number, pz: number): number {
  const ax = Math.abs(px)
  let d = capsule(ax, py, pz, [0, 0.05, 0.25], [0, 0.4, 0.3], 0.17)
  d = smin(d, capsule(ax, py, pz, [0.05, 0.42, 0.32], [0.58, 0.58, 0.34], 0.2), 0.25)
  d = smin(d, ell(ax, py, pz, 0.6, 0.6, 0.32, 0.24, 0.24, 0.28), 0.1)
  d = smin(d, ell(px, py, pz, 0, 1.15, 0.42, 0.56, 0.72, 0.42), 0.3)
  d = smin(d, ell(px, py, pz, 0, 2.4, 0.5, 0.66, 1.4, 0.5), 0.3)
  // The collar: a thin shell behind the head, open at the front, its rim scalloped.
  let collar = Math.abs(ell(px, py, pz, 0, -0.4, 0.5, 0.72, 0.95, 0.38)) - 0.03
  collar = Math.max(collar, 0.2 - pz)
  collar = Math.max(collar, py - 0.3)
  collar = Math.max(collar, -1.15 - 0.12 * Math.abs(Math.sin(px * 7)) - py)
  return Math.min(d, collar)
}

/** The distance to a box (centre, half sizes): never more than the distance to anything inside it. */
function boxDistance(px: number, py: number, pz: number, c: V3, h: V3): number {
  const qx = Math.max(Math.abs(px - c[0]) - h[0], 0)
  const qy = Math.max(Math.abs(py - c[1]) - h[1], 0)
  const qz = Math.max(Math.abs(pz - c[2]) - h[2], 0)
  return Math.hypot(qx, qy, qz)
}

/** The shoulder, where each arm hangs from (on the side x > 0; the other mirrors it). */
const SHOULDER: V3 = [0.6, 0.62, 0.3]

/** An arm's joints for a pose: elbow, wrist, the way its fingers point, and its sleeve's bell. */
type Joints = { elbow: V3; wrist: V3; up: V3; side: V3; bell: V3; palm: V3; box: [V3, V3] }

/** Three poses an arm moves between: hanging, raised before the chest, flung out wide. */
const POSES = {
  down: { elbow: [0.74, 1.15, 0.32] as V3, wrist: [0.72, 1.62, 0.26] as V3, up: [0.02, 1, 0] as V3 },
  raised: { elbow: [0.74, 1.12, 0.02] as V3, wrist: [0.46, 0.86, -0.36] as V3, up: [-0.12, -1, -0.12] as V3 },
  spread: { elbow: [0.98, 0.94, 0.16] as V3, wrist: [1.18, 0.7, 0.0] as V3, up: [0.22, -1, -0.12] as V3 },
}

const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

/** Where an arm's joints are, for its pose. */
function jointsFor(a: ArmPose): Joints {
  const r = clamp01(a.raise)
  const sp = clamp01(a.spread)
  const pick = (k: 'elbow' | 'wrist' | 'up') => lerp3(lerp3(POSES.down[k], POSES.raised[k], r), POSES.spread[k], sp)
  const elbow = pick('elbow')
  const wrist = pick('wrist')
  const up = norm(pick('up'))
  // Across the hand: square to the way it points, in the plane of the glass.
  const side = norm([up[1], -up[0], 0])
  // The bell hangs below the forearm, nearer the cuff.
  const mid = lerp3(elbow, wrist, 0.6)
  const bell: V3 = [mid[0], mid[1] + 0.16, mid[2]]
  const palm = add(wrist, mul(up, 0.15))
  const reach = 0.42
  return { elbow, wrist, up, side, bell, palm, box: [palm, [reach, reach, reach]] }
}

/** This frame's arms, [x < 0, x > 0]: set from the model before its body is marched. */
let ARMS: [Joints, Joints] = [jointsFor(ARMS_DOWN[0]), jointsFor(ARMS_DOWN[1])]

/** Arms bent at the elbow, in sleeves that hang in a wide bell below the forearm. */
function sleeves(px: number, py: number, pz: number): number {
  const ax = Math.abs(px)
  const a = ARMS[px < 0 ? 0 : 1]
  let d = capsule(ax, py, pz, SHOULDER, a.elbow, 0.15)
  d = smin(d, capsule(ax, py, pz, a.elbow, a.wrist, 0.12), 0.08)
  // The bell: cloth hanging from the forearm, widest and lowest at the cuff.
  return smin(d, ell(ax, py, pz, a.bell[0], a.bell[1], a.bell[2], 0.26, 0.34, 0.2), 0.14)
}

/** Bony hands from the cuffs, fingers a little spread, thumbs out. */
function hands(px: number, py: number, pz: number): number {
  const ax = Math.abs(px)
  const a = ARMS[px < 0 ? 0 : 1]
  // Far from the hand, the distance to its box is near enough, and cheap.
  const box = boxDistance(ax, py, pz, a.box[0], a.box[1])
  if (box > 0.1) {
    return box
  }
  let d = ell(ax, py, pz, a.palm[0], a.palm[1], a.palm[2], 0.09, 0.09, 0.06)
  for (let f = 0; f < 4; f += 1) {
    const across = (f - 1.5) * 0.05
    const length = f === 1 || f === 2 ? 0.24 : 0.19
    const root = add(add(a.wrist, mul(a.up, 0.2)), mul(a.side, across))
    const tip = add(add(root, mul(a.up, length)), mul(a.side, across * 0.5))
    d = Math.min(d, capsule(ax, py, pz, root, tip, 0.028))
  }
  const thumb = add(add(a.wrist, mul(a.up, 0.1)), mul(a.side, 0.09))
  return Math.min(d, capsule(ax, py, pz, thumb, add(add(thumb, mul(a.up, 0.08)), mul(a.side, 0.1)), 0.03))
}

/** The cord round the waist, its knot at the front, two tassels hanging from it. */
function cord(px: number, py: number, pz: number): number {
  const box = boxDistance(px, py, pz, [0, 1.62, 0.2], [0.65, 0.4, 0.5])
  if (box > 0.1) {
    return box
  }
  const ring = (Math.hypot(px / 0.55, (pz - 0.42) / 0.43) - 1) * 0.5
  let d = Math.hypot(ring, py - 1.32) - 0.035
  d = Math.min(d, ell(px, py, pz, 0, 1.34, -0.03, 0.07, 0.06, 0.05))
  const ax = Math.abs(px)
  d = Math.min(d, capsule(ax, py, pz, [0.04, 1.36, -0.04], [0.08, 1.82, -0.07], 0.025))
  return Math.min(d, ell(ax, py, pz, 0.085, 1.9, -0.07, 0.04, 0.09, 0.04))
}

/** The robe's ragged hem, by its x, shifting slowly. */
const hemAt = (px: number, t: number) => 2.3 + 0.2 * noise(px * 5 + 3, t * 0.3) + 0.08 * Math.sin(px * 9)

function normalOf(f: (x: number, y: number, z: number) => number, px: number, py: number, pz: number, e: number): V3 {
  const a = f(px + e, py - e, pz - e)
  const b = f(px - e, py - e, pz + e)
  const c = f(px - e, py + e, pz - e)
  const d = f(px + e, py + e, pz + e)
  return norm([a - b - c + d, -a - b + c + d, -a + b - c + d])
}

// ── The model: everything placed for this frame ───────────────────────────

/** A point of light on the glass: a socket's fire, a lick of its flame, a rune. */
export type Spark = { x: number; y: number; z: number; r: number; v: number; layer: number; glyph?: string }

export type Model = {
  cam: Camera
  pose: Pose
  R: Mat
  B: Mat
  /** The base of the neck. */
  base: V3
  sparks: Spark[]
  /** The vertebrae under the jaw: centres and radii on the glass. */
  neck: Array<{ x: number; y: number; z: number; r: number }>
  headBox: [number, number, number, number]
  /** Its arms' joints this frame. */
  arms: [Joints, Joints]
}

/** The runes, drawn as themselves: planets and metals of the old work. */
export const RUNES = ['☿', '♀', '♂', '♁', '☽', '∴']

export function buildModel(p: Pose, cam: Camera): Model {
  const s = p.s
  const R = rotation(p.yaw, p.pitch, p.roll)
  const B = rotation(p.bodyYaw, 0.04, p.roll * 0.3)
  const H = (x: number, y: number, z: number): V3 => add(p.pos, mul(apply(R, [x, y, z]), s))
  const base = add(p.pos, [0, s * 0.75, s * 0.15])
  const Bw = (x: number, y: number, z: number): V3 => add(base, mul(apply(B, [x, y, z]), s))
  const sparks: Spark[] = []

  // The fire in each socket, and the flame it streams upward when it burns.
  for (const side of [-1, 1]) {
    const at = H(side * EMBER.x + p.look[0] * 0.035, EMBER.y + p.look[1] * 0.03, EMBER.z)
    const pr = project(cam, at)
    sparks.push({ x: pr.x, y: pr.y, z: at[2], r: s * (0.05 + 0.025 * p.eyes) * pr.k, v: Math.min(1, 0.45 + 0.55 * p.eyes), layer: FIRE })
    const licks = Math.round(9 * p.flame)
    for (let k = 1; k <= licks; k += 1) {
      const u = k / 10
      const sway = Math.sin(p.t * 5 - k * 0.9 + side) * 0.05 * k
      // Streaming up past the brow and back over the crown, in front of the bone.
      const q = add(H(side * (EMBER.x + 0.03 * u) + sway, EMBER.y - 0.12 * k, EMBER.z - 0.12 + 0.05 * k * u), [0, 0, -s * 0.12])
      const fr = project(cam, q)
      sparks.push({ x: fr.x, y: fr.y, z: q[2], r: s * 0.06 * (1 - u * 0.8) * fr.k, v: (1 - u) * p.flame, layer: FLAME })
    }
  }

  // The gem at the crown's front.
  const gem = project(cam, H(0, -0.5, -0.56))
  sparks.push({ x: gem.x, y: gem.y, z: gem.z - 2, r: s * 0.05 * gem.k, v: 0.6 + 0.4 * p.eyes * 0.6, layer: GEM, glyph: '●' })

  // The robe frays at its hem into ash, drifting down and thinning to nothing.
  for (let i = 0; i < 34; i += 1) {
    const x0 = (hash(i, 101) * 2 - 1) * 0.62
    const phase = (p.t * (0.05 + 0.06 * hash(i, 102)) + hash(i, 103)) % 1
    const x = x0 + Math.sin(p.t * 0.7 + i) * 0.05 + phase * (hash(i, 104) - 0.5) * 0.3
    const q = Bw(x, hemAt(x0, p.t) - 0.05 + phase * 0.8, 0.1)
    const pr = project(cam, q)
    sparks.push({ x: pr.x, y: pr.y, z: q[2], r: 1, v: (1 - phase) * 0.6 * p.light, layer: MANTLE, glyph: phase < 0.3 ? '∴' : phase < 0.6 ? ':' : phase < 0.85 ? '∙' : '·' })
  }

  const neck = [0, 1, 2].map(i => {
    const pr = project(cam, Bw(0, -0.05 + i * 0.13, 0.05))
    return { x: pr.x, y: pr.y, z: pr.z, r: s * 0.1 * pr.k }
  })

  const c = project(cam, p.pos)
  const reach = s * 1.05 * c.k
  return { cam, pose: p, R, B, base, sparks, neck, headBox: [c.x - reach, c.y - reach * 1.2, c.x + reach, c.y + reach * 1.1], arms: [jointsFor(p.arms[0]), jointsFor(p.arms[1])] }
}

/** Where on the glass it could draw anything, side to side and from the top. */
export function modelBounds(m: Model): [number, number, number, number] {
  const c = project(m.cam, m.pose.pos)
  const reach = m.pose.s * 1.6 * c.k
  return [c.x - reach, c.y - reach, c.x + reach, Infinity]
}

// ── What the viewer sees at a point ───────────────────────────────────────

/** [layer, brightness], how near, and the glyph it insists on, if any. */
type Hit = { z: number; cell: Cell; glyph?: string }

/** From above and in front, a little to the left: the light the fire throws up is separate. */
const KEY = norm([-0.35, -0.7, -0.6])

function headHit(m: Model, X: number, Y: number): Hit | undefined {
  const [x0, y0, x1, y1] = m.headBox
  if (X < x0 || X > x1 || Y < y0 || Y > y1) {
    return undefined
  }
  const { cam, pose, R } = m
  const s = pose.s
  const O: V3 = [cam.cx, cam.cy, -cam.f]
  const D = norm([X - cam.cx, Y - cam.cy, cam.f])
  const o = mul(applyT(R, sub(O, pose.pos)), 1 / s)
  const d = applyT(R, D)
  const oc = sub(o, [0, -0.05, 0.05])
  const b = dot(oc, d)
  const c = dot(oc, oc) - 1.05 * 1.05
  const disc = b * b - c
  if (disc < 0) {
    return undefined
  }
  let t = Math.max(0, -b - Math.sqrt(disc))
  const tEnd = -b + Math.sqrt(disc)
  for (let i = 0; i < 56 && t < tEnd; i += 1) {
    const px = o[0] + d[0] * t
    const py = o[1] + d[1] * t
    const pz = o[2] + d[2] * t
    const h = head(px, py, pz, pose.jaw)
    if (h.d < 0.004) {
      const z = O[2] + D[2] * t * s
      return { z, cell: h.isCrown ? shadeCrown(m, px, py, pz) : shadeSkull(m, px, py, pz) }
    }
    t += h.d * 0.75
  }
  return undefined
}

function shadeSkull(m: Model, px: number, py: number, pz: number): Cell {
  const pose = m.pose
  const field = (x: number, y: number, z: number) => skull(x, y, z, pose.jaw)
  const n = normalOf(field, px, py, pz, 0.004)
  const nw = apply(m.R, n)
  const ax = Math.abs(px)
  if (ell(ax, py, pz, SOCKET.x, SOCKET.y, SOCKET.z, SOCKET.rx * 1.05, SOCKET.ry * 1.05, SOCKET.rz * 1.05) < 0) {
    return [BONE, clamp01(0.02 + 0.1 * pose.eyes * Math.max(0, -n[2]))]
  }
  const bite = 0.52 + pose.jaw * 0.05
  if (pz < -0.2 && ax < 0.21 && py > 0.44 && py < 0.6 + pose.jaw * 0.1) {
    if (Math.abs(py - bite) < 0.018 + pose.jaw * 0.05) {
      return [BONE, 0.02]
    }
    const gap = (ax + 0.035) / 0.07
    if (Math.abs(gap - Math.round(gap)) < 0.13) {
      return [BONE, 0.1]
    }
  }
  const lambert = Math.max(0, dot(nw, KEY))
  const rim = Math.pow(1 - Math.abs(nw[2]), 3) * 0.3
  const ao = clamp01(field(px + n[0] * 0.07, py + n[1] * 0.07, pz + n[2] * 0.07) / 0.07)
  // The fire's own glow round the sockets and up the brow.
  const glow = pose.eyes * 0.3 * Math.max(0, 1 - (Math.hypot(ax - SOCKET.x, py - SOCKET.y) - 0.12) / 0.16)
  return [BONE, clamp01((0.05 + 0.8 * lambert * (0.35 + 0.65 * ao) + rim) * pose.light + glow)]
}

function shadeCrown(m: Model, px: number, py: number, pz: number): Cell {
  const n = normalOf(crown, px, py, pz, 0.006)
  const nw = apply(m.R, n)
  const lambert = Math.abs(dot(nw, KEY))
  const theta = Math.atan2(px / 0.5, -(pz - 0.08) / 0.57)
  // Brighter toward the points; a dark band of filigree round the base.
  const height = clamp01((-0.3 - py) / 0.4)
  const band = py > -0.36 && py < -0.33 ? 0.4 : 1
  return [CROWN, clamp01((0.2 + 0.6 * lambert + 0.25 * height) * band * m.pose.light * (0.75 + 0.25 * Math.cos(theta)))]
}

function bodyHit(m: Model, X: number, Y: number): Hit | undefined {
  const { cam, pose, B, base } = m
  const s = pose.s
  const O: V3 = [cam.cx, cam.cy, -cam.f]
  const D = norm([X - cam.cx, Y - cam.cy, cam.f])
  const o = mul(applyT(B, sub(O, base)), 1 / s)
  const d = applyT(B, D)
  // Only the stretch of the line of sight inside the body's box is marched.
  let t = 0
  let tEnd = Infinity
  for (const [lo, hi, k] of [
    [-1.6, 1.6, 0],
    [-1.7, 3.1, 1],
    [-0.75, 1.05, 2],
  ] as const) {
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < lo || o[k] > hi) {
        return undefined
      }
      continue
    }
    const a = (lo - o[k]) / d[k]
    const b = (hi - o[k]) / d[k]
    t = Math.max(t, Math.min(a, b))
    tEnd = Math.min(tEnd, Math.max(a, b))
  }
  if (t >= tEnd) {
    return undefined
  }
  for (let i = 0; i < 64 && t < tEnd; i += 1) {
    const px = o[0] + d[0] * t
    const py = o[1] + d[1] * t
    const pz = o[2] + d[2] * t
    const dist = body(px, py, pz)
    if (dist < 0.006) {
      return robeAt(m, px, py, pz, O[2] + D[2] * t * s)
    }
    t += dist * 0.85
  }
  return undefined
}

/**
 * The robes: folds that run down them, lit from above and darker where the
 * cloth folds in, thinning toward a ragged hem that shifts slowly and frays
 * into the ash below it; the hands bone, the cord a lighter rope.
 */
function robeAt(m: Model, px: number, py: number, pz: number, z: number): Hit | undefined {
  const { pose } = m
  const n = normalOf(body, px, py, pz, 0.006)
  const nw = apply(m.B, n)
  const lambert = Math.max(0, dot(nw, KEY))
  const rim = Math.pow(1 - Math.abs(nw[2]), 3) * 0.35
  // The hands are bone, lit as the skull is.
  if (hands(px, py, pz) < 0.012) {
    return { z, cell: [BONE, clamp01((0.15 + 0.7 * lambert + rim) * pose.light)] }
  }
  // The cord is rope, a lighter red than the cloth it binds.
  if (cord(px, py, pz) < 0.012) {
    return { z, cell: [MANTLE, clamp01((0.45 + 0.4 * lambert) * pose.light)] }
  }
  // The cloth darkens where it folds in: under the arms, inside the bells.
  const shade = 0.45 + 0.55 * clamp01(body(px + n[0] * 0.09, py + n[1] * 0.09, pz + n[2] * 0.09) / 0.09)
  const fold = 0.85 + 0.15 * Math.sin(px * 14 + py * 1.5)
  const fade = clamp01((hemAt(px, pose.t) - py) / 0.85)
  const v = (0.12 + 0.6 * lambert * fold + rim) * shade * pose.light * fade
  return v < 0.07 ? undefined : { z, cell: [MANTLE, clamp01(v)] }
}

/** What the viewer sees at a point on the glass: the nearest part of the Lich, if any, and a glyph if it insists on one. */
export function sampleModel(m: Model, X: number, Y: number): { cell: Cell; glyph?: string } | undefined {
  ARMS = m.arms
  let best = headHit(m, X, Y)
  let glyph: string | undefined
  const consider = (hit: Hit | undefined) => {
    if (hit && (!best || hit.z < best.z)) {
      best = hit
      glyph = hit.glyph
    }
  }
  consider(bodyHit(m, X, Y))
  for (const n of m.neck) {
    const d = Math.hypot(X - n.x, Y - n.y)
    if (d < n.r) {
      consider({ z: n.z, cell: [BONE, 0.25 + 0.3 * (1 - d / n.r)] })
    }
  }
  for (const sp of m.sparks) {
    // A spark with a glyph of its own is one cell: the drawing places it.
    if (sp.glyph) {
      continue
    }
    const d = Math.hypot(X - sp.x, (Y - sp.y) * 0.8)
    if (d < sp.r) {
      consider({ z: sp.z, cell: [sp.layer, clamp01(sp.v * (0.6 + 0.4 * (1 - d / sp.r)))] })
    }
  }
  return best ? { cell: best.cell, glyph } : undefined
}
