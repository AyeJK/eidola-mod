// The Kraken in three dimensions, for the live drawing. A mantle that is an
// ellipsoid, eight arms that are tapering tubes bent and waved in 3D, eyes
// on the mantle's sides; all seen in perspective through the glass, lit from
// the surface above and fogged with distance. Each pixel takes whatever is
// nearest the viewer, so arms pass behind the mantle and in front of it.
//
// World: x right, y down, z away from the glass, in pixels; the glass is
// z 0. The Kraken's own frame is its axis (from the arm roots up through
// the mantle), the way it faces, and the side between them.

import { clamp01, hash, noise } from './field'
import type { Cell } from './field'
import { BODY, DETAIL, GLOW, IRIS } from './kraken'

export type V3 = [number, number, number]
const TAU = Math.PI * 2

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])
export const norm3 = (a: V3): V3 => {
  const l = len3(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** `v` turned `angle` about the unit `axis` (Rodrigues). */
function rotate(v: V3, axis: V3, angle: number): V3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)))
}

/** Where perspective converges, and how strongly: a longer `f` flattens it. */
export type Camera = { cx: number; cy: number; f: number }

/** A point's place on the glass and its scale there. */
function project(cam: Camera, p: V3): { x: number; y: number; k: number } {
  const k = cam.f / (cam.f + Math.max(-cam.f * 0.95, p[2]))
  return { x: cam.cx + (p[0] - cam.cx) * k, y: cam.cy + (p[1] - cam.cy) * k, k }
}

/** Everything the live drawing animates about the Kraken. */
export type Body = {
  /** The ring where the arms join, in world pixels. */
  pos: V3
  /** Unit: from the arm roots up through the mantle. */
  axis: V3
  /** The way the eyes look; kept square to the axis. */
  facing: V3
  /** Mantle width in world pixels. */
  s: number
  /** Stretch along the axis, the squeeze of a jet stroke. */
  squash: number
  /** 0 arms spread wide, 1 drawn together, trailing. */
  gather: number
  /** The arms' wave, in radians of its cycle. */
  phase: number
  sway: number
  /** Pupils: -1 to 1, across. */
  look: number
  /** 0 open, 1 shut. */
  lid: number
  /** The runes' glow, 0 to 1. */
  rune: number
  /** How much light reaches it, 0 to 1. */
  light: number
  /** Each arm's own state, when it has one: arms that move on their own. */
  arms?: ArmPose[]
}

/**
 * One arm's own pose: what makes the eight move independently rather than
 * as one. Each is a multiplier or an offset on the body's own values.
 */
export type ArmPose = {
  /** Its own wave, in radians of its own cycle. */
  phase: number
  /** How drawn-in it is: its own lagging share of the body's gather. */
  gather: number
  /**
   * How its tip curls, against the arm's own built curl: 1 as built (out
   * and up), more coils it, 0 straightens it, negative curls it inward,
   * back toward the body and under it.
   */
  curl: number
  /** A curl to one side or the other, about the body's axis: tips sweeping sideways. */
  sweep: number
  /** Its length: 1 as built. */
  reach: number
  /** Radians further out (negative) or down (positive) than the rest. */
  splay: number
  /** Its wave's strength: 1 as the body's. */
  wave: number
  /** How far it bends toward the glass, 0 to 1: a tip coming at you. */
  toward: number
  /** A fast shiver along it, 0 to 1. */
  twitch: number
}

type Vert = { x: number; y: number; z: number; w: number }
type Arm = { v: Vert[]; len: number; box: [number, number, number, number] }
type Eye = { x: number; y: number; z: number; r: number; facing: number }
/** An ellipsoid of the head: its centre and its radii along the axis, side and facing. */
type Blob = { C: V3; ru: number; rr: number; rf: number; k0: number }
/** The membrane between two neighbouring arms near their roots, as quads on the glass. */
type Web = { quads: Array<[Vert, Vert, Vert, Vert]>; box: [number, number, number, number] }

export type Model = {
  cam: Camera
  body: Body
  /** The mantle sack's centre: what the eyes face out from. */
  centre: V3
  u: V3
  r: V3
  f: V3
  /** The head: a great round mantle sack, and the face below it where the eyes are. */
  blobs: Blob[]
  arms: Arm[]
  webs: Web[]
  eyes: Eye[]
}

/** From the surface, a little toward the glass. */
const LIGHT = norm3([0.25, -1, -0.45])

/** Fog: the further back, the less of it reaches the eye. */
function fog(z: number): number {
  return Math.max(0.28, Math.min(1, 1.08 - z / 1500))
}

/** The Kraken's own frame: its axis, the way it faces, and the side between. */
function frame(axis: V3, facing: V3): { u: V3; f: V3; r: V3 } {
  const u = norm3(axis)
  let f = sub(facing, mul(u, dot(facing, u)))
  if (len3(f) < 0.05) {
    f = Math.abs(u[2]) < 0.9 ? sub([0, 0, -1], mul(u, -u[2])) : [1, 0, 0]
  }
  f = norm3(f)
  return { u, f, r: cross(u, f) }
}

/** The face, from the arm ring: its centre's offset, and its radii. */
const FACE = { up: 0.18, forward: 0.12, ru: 0.42, rr: 0.58, rf: 0.5 }
/** Which way an eye looks out from the face's centre: up a little, forward, and to one side. */
const EYE = { up: 0.06, forward: 0.36, side: 0.3 }

/** Where an eye is (side -1 or 1): on the face's own surface, just proud of it. */
function eyeOnFace(pos: V3, u: V3, f: V3, r: V3, s: number, side: number): V3 {
  const [a, b, c] = [EYE.up, side * EYE.side, EYE.forward]
  const reach = 1.04 / Math.hypot(a / FACE.ru, b / FACE.rr, c / FACE.rf)
  const centre = add(add(pos, mul(u, s * FACE.up)), mul(f, s * FACE.forward))
  return add(centre, mul(add(add(mul(u, a), mul(r, b)), mul(f, c)), s * reach))
}

/** Where an eye is (side -1 or 1), from the arm ring, axis, facing and size. */
export function eyeAt(pos: V3, axis: V3, facing: V3, s: number, side: number): V3 {
  const { u, f, r } = frame(axis, facing)
  return eyeOnFace(pos, u, f, r, s, side)
}

export function buildModel(b: Body, cam: Camera): Model {
  const { u, f, r } = frame(b.axis, b.facing)
  const s = b.s
  // A bulbous head: the mantle sack, great and round, swept up and back;
  // the face below it, where the eyes sit and the arms pour out.
  const centre = add(add(b.pos, mul(u, s * 0.78)), mul(f, -s * 0.18))
  const faceCentre = add(add(b.pos, mul(u, s * FACE.up)), mul(f, s * FACE.forward))
  const blobs: Blob[] = [
    { C: centre, ru: s * 0.86 * (1 + b.squash), rr: s * 0.78 * (1 - b.squash * 0.5), rf: s * 0.8 * (1 - b.squash * 0.5), k0: project(cam, centre).k },
    { C: faceCentre, ru: s * FACE.ru, rr: s * FACE.rr, rf: s * FACE.rf, k0: project(cam, faceCentre).k },
  ]

  const arms: Arm[] = []
  for (let i = 0; i < 8; i += 1) {
    const theta = ((i + 0.5) / 8) * TAU + 0.2
    const radial = add(mul(r, Math.cos(theta)), mul(f, Math.sin(theta)))
    const a = b.arms?.[i] ?? { phase: b.phase - i * 0.9, gather: b.gather, curl: 1, sweep: 0, reach: 1, splay: 0, wave: 1, toward: 0, twitch: 0 }
    // Roots in a wide ring round the face, thick, so the arms seem to pour out of it.
    // Drawn in, the roots close up and every curve straightens: the arms
    // trail behind the mantle in one tight bundle, as an octopus jets.
    const drawn = Math.max(0, a.gather)
    const root = add(add(b.pos, mul(radial, s * (0.38 - 0.2 * drawn))), mul(u, s * 0.04))
    // Spread out below the rim, or drawn down into a trailing bundle.
    const splay = Math.min(1.55, 0.35 + 1.25 * a.gather + a.splay * (1 - drawn))
    let dir = norm3(add(mul(radial, Math.cos(splay)), mul(u, -Math.sin(splay))))
    // Some arms bend round toward the glass, tips coming at the viewer.
    if (a.toward > 0) {
      dir = norm3(add(mul(dir, 1 - a.toward), mul([0, 0, -1], a.toward)))
    }
    const bend = norm3(cross(radial, u))
    const n = 20
    const length = s * 2.7 * (0.85 + hash(i, 3) * 0.3) * (1 + 0.18 * drawn) * a.reach
    const step = length / n
    // How it bends along its length: S-curves that turn one way then the
    // other and ripple outward, and a spiral at the tip, its way the arm's own.
    const coil = (2.2 + hash(i, 7) * 1.6) * (1 - 0.9 * drawn) * a.curl
    const sCurve = (1.4 + hash(i, 11) * 0.8) * (0.4 + 0.6 * a.wave) * (0.5 + b.sway) * (1 - 0.85 * drawn)
    const turns = 0.7 + hash(i, 13) * 0.6
    // A gentle rise along the whole arm, so arms arch up and over as in life.
    const arc = 0.9 * (1 - 0.9 * drawn)
    const verts: Vert[] = []
    let p = root
    const w0 = s * 0.46
    for (let k = 0; k <= n; k += 1) {
      const t = k / n
      const pr = project(cam, p)
      verts.push({ x: pr.x, y: pr.y, z: p[2], w: Math.max(1.5, w0 * Math.pow(1 - t, 1.1)) * pr.k })
      if (k === n) {
        break
      }
      const s1 = (k + 1) / n
      // Curvature at this point: the S-curve wave, stronger toward the tip and
      // travelling along the arm; the tip's spiral; a shiver when it twitches.
      const kappa =
        arc +
        sCurve * Math.sin(TAU * turns * s1 - a.phase) * (0.4 + s1) +
        coil * Math.pow(Math.max(0, (s1 - 0.6) / 0.4), 2) * 9 +
        a.twitch * Math.sin(TAU * 3 * s1 + a.phase * 7) * 2
      const twist = (b.sway * a.wave * 0.7 * Math.sin(TAU * 0.5 * s1 - a.phase * 0.7 + i * 1.7) * s1 + a.sweep * s1 * s1 * 2) * (1 - 0.8 * drawn)
      dir = norm3(rotate(rotate(dir, bend, (kappa / n) * 2), u, (twist / n) * 2))
      p = add(p, mul(dir, step))
    }
    const pad = w0
    const xs = verts.map(v => v.x)
    const ys = verts.map(v => v.y)
    arms.push({ v: verts, len: length, box: [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad] })
  }

  // Webbing between each pair of neighbouring arms, a third of the way down.
  const webs: Web[] = arms.map((armA, i) => {
    const armB = arms[(i + 1) % arms.length]!
    const quads: Array<[Vert, Vert, Vert, Vert]> = []
    for (let k = 0; k < 4; k += 1) {
      quads.push([armA.v[k]!, armA.v[k + 1]!, armB.v[k + 1]!, armB.v[k]!])
    }
    const xs = quads.flat().map(v => v.x)
    const ys = quads.flat().map(v => v.y)
    return { quads, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
  })

  const eyes: Eye[] = []
  for (const side of [-1, 1]) {
    const at = eyeOnFace(b.pos, u, f, r, s, side)
    const outward = norm3(sub(at, faceCentre))
    const facing = -outward[2]
    const pr = project(cam, at)
    eyes.push({ x: pr.x, y: pr.y, z: at[2] - s * 0.05, r: s * 0.1 * pr.k * Math.sqrt(Math.max(0, facing)), facing })
  }

  return { cam, body: b, centre, u, r, f, blobs, arms, webs, eyes }
}

/** Where on the glass the Kraken could draw anything: mantle and every arm. */
export function modelBounds(m: Model): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const blob of m.blobs) {
    const c = project(m.cam, blob.C)
    const rad = Math.max(blob.ru, blob.rr, blob.rf) * c.k
    x0 = Math.min(x0, c.x - rad)
    y0 = Math.min(y0, c.y - rad)
    x1 = Math.max(x1, c.x + rad)
    y1 = Math.max(y1, c.y + rad)
  }
  for (const arm of m.arms) {
    x0 = Math.min(x0, arm.box[0])
    y0 = Math.min(y0, arm.box[1])
    x1 = Math.max(x1, arm.box[2])
    y1 = Math.max(y1, arm.box[3])
  }
  return [x0, y0, x1, y1]
}

type Hit = { z: number; cell: Cell }

/** One ellipsoid of the head, met by the viewer's line of sight; lit from above, darkly. */
function blobHit(m: Model, blob: Blob, X: number, Y: number): Hit | undefined {
  const { cam, u, r, f } = m
  const { C, ru, rr, rf, k0 } = blob
  const wx = cam.cx + (X - cam.cx) / k0
  const wy = cam.cy + (Y - cam.cy) / k0
  const q0: V3 = [wx - C[0], wy - C[1], -C[2]]
  const a0 = dot(q0, u) / ru
  const b0 = dot(q0, r) / rr
  const c0 = dot(q0, f) / rf
  const au = u[2] / ru
  const br = r[2] / rr
  const cf = f[2] / rf
  const A = au * au + br * br + cf * cf
  const B = 2 * (a0 * au + b0 * br + c0 * cf)
  const C0 = a0 * a0 + b0 * b0 + c0 * c0 - 1
  const disc = B * B - 4 * A * C0
  if (disc < 0) {
    return undefined
  }
  const t = (-B - Math.sqrt(disc)) / (2 * A)
  const a = a0 + t * au
  const b = b0 + t * br
  const c = c0 + t * cf
  const n = norm3(add(add(mul(u, a / ru), mul(r, b / rr)), mul(f, c / rf)))
  const lambert = Math.max(0, dot(n, LIGHT))
  const rim = Math.pow(1 - Math.abs(n[2]), 3) * 0.28
  const v = (0.07 + 0.55 * lambert + rim) * m.body.light * fog(t)
  return { z: t, cell: [BODY, clamp01(v)] }
}

function mantleHit(m: Model, X: number, Y: number): Hit | undefined {
  let best: Hit | undefined
  for (const blob of m.blobs) {
    const hit = blobHit(m, blob, X, Y)
    if (hit && (!best || hit.z < best.z)) {
      best = hit
    }
  }
  return best
}

/** Whether a point lies in a triangle on the glass. */
function inTriangle(X: number, Y: number, a: Vert, b: Vert, c: Vert): boolean {
  const d1 = (X - b.x) * (a.y - b.y) - (a.x - b.x) * (Y - b.y)
  const d2 = (X - c.x) * (b.y - c.y) - (b.x - c.x) * (Y - c.y)
  const d3 = (X - a.x) * (c.y - a.y) - (c.x - a.x) * (Y - a.y)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** The webbing between two arms: a dark membrane, just behind the arms it joins. */
function webHit(m: Model, web: Web, X: number, Y: number): Hit | undefined {
  const [x0, y0, x1, y1] = web.box
  if (X < x0 || X > x1 || Y < y0 || Y > y1) {
    return undefined
  }
  for (const [k, q] of web.quads.entries()) {
    if (inTriangle(X, Y, q[0], q[1], q[2]) || inTriangle(X, Y, q[0], q[2], q[3])) {
      const z = (q[0].z + q[1].z + q[2].z + q[3].z) / 4 + 2
      return { z, cell: [BODY, clamp01((0.2 - k * 0.025) * m.body.light * fog(z))] }
    }
  }
  return undefined
}

function armHit(m: Model, arm: Arm, X: number, Y: number): Hit | undefined {
  const [x0, y0, x1, y1] = arm.box
  if (X < x0 || X > x1 || Y < y0 || Y > y1) {
    return undefined
  }
  let best: Hit | undefined
  const n = arm.v.length - 1
  for (let i = 0; i < n; i += 1) {
    const A = arm.v[i]!
    const B = arm.v[i + 1]!
    const dx = B.x - A.x
    const dy = B.y - A.y
    const l2 = dx * dx + dy * dy || 1
    const k = clamp01(((X - A.x) * dx + (Y - A.y) * dy) / l2)
    const px = A.x + dx * k
    const py = A.y + dy * k
    const d = Math.hypot(X - px, Y - py)
    const half = (A.w + (B.w - A.w) * k) / 2
    if (d > half) {
      continue
    }
    const z = A.z + (B.z - A.z) * k
    if (best && best.z <= z) {
      continue
    }
    const t = (i + k) / n
    const cross2 = dx * (Y - A.y) - dy * (X - A.x)
    const side = (cross2 < 0 ? -1 : 1) * (d / half)
    // The lit side is whichever side faces up on the glass.
    const up = dx >= 0 ? -1 : 1
    const toward = side * up
    const along = t * arm.len
    let cell: Cell
    if (toward < -0.38 && toward > -0.92 && t < 0.88 && (along / Math.max(6, half * 0.9)) % 1 < 0.5) {
      cell = [DETAIL, (0.35 + 0.2 * (1 - t)) * m.body.light * fog(z)]
    } else if (Math.abs(side) < 0.16 && t > 0.05 && t < 0.8 && [0, 2, 3].includes(Math.floor(along / 9) % 6)) {
      cell = [GLOW, m.body.rune * 0.9]
    } else {
      const lit = 0.1 + 0.3 * clamp01(toward * 0.6 + 0.5)
      const edge = Math.abs(side) > 0.88 ? 0.55 : 1
      cell = [BODY, clamp01(lit * edge * (1 - 0.3 * t) * m.body.light * fog(z))]
    }
    best = { z, cell }
  }
  return best
}

function eyeHit(m: Model, eye: Eye, X: number, Y: number): Hit | undefined {
  if (eye.facing < 0.08 || eye.r < 1) {
    return undefined
  }
  const r = eye.r
  const d = Math.hypot(X - eye.x, (Y - eye.y) * 1.15)
  if (d > r * 1.55) {
    return undefined
  }
  const light = m.body.light
  if (d > r) {
    // The skin round the eye: dark, with a lit fold of upper lid.
    const isFold = Y < eye.y - r * 0.3 && d < r * 1.3
    return { z: eye.z, cell: [BODY, (isFold ? 0.42 : 0.16 + 0.12 * (1 - (d - r) / (r * 0.55))) * light] }
  }
  if (Y - eye.y < -r + 2 * r * m.body.lid) {
    return { z: eye.z, cell: [BODY, 0.3 * light] }
  }
  // The pupil: a horizontal slit with rounded ends, as an octopus has.
  const px = eye.x + m.body.look * r * 0.25
  const half = r * (r < 10 ? 0.62 : 0.5)
  const thick = r * (r < 10 ? 0.2 : 0.17)
  const along = Math.max(-half, Math.min(half, X - px))
  const fromSlit = Math.hypot(X - px - along, (Y - eye.y) * 1.15)
  if (fromSlit < thick) {
    return { z: eye.z, cell: [BODY, 0.02] }
  }
  if (r < 10) {
    // Small and far: a glow, no more.
    return { z: eye.z, cell: [GLOW, 0.75 + 0.25 * (1 - d / r)] }
  }
  // Up close, an iris of its own: a dark limbal ring, fine fibres, darker
  // round the pupil, brighter toward the middle, and a glint of the surface.
  const rho = d / r
  if (rho > 0.86) {
    return { z: eye.z, cell: [IRIS, 0.06] }
  }
  if (Math.hypot(X - (eye.x - r * 0.36), Y - (eye.y - r * 0.38)) < r * 0.12) {
    return { z: eye.z, cell: [IRIS, 1] }
  }
  const angle = Math.atan2(Y - eye.y, X - eye.x)
  const fibres = noise(angle * 9 + 10, rho * 3)
  let v = 0.3 + 0.5 * Math.pow(1 - rho, 0.8) + (fibres - 0.5) * 0.18
  if (fromSlit < thick * 1.7) {
    v *= 0.72
  }
  return { z: eye.z, cell: [IRIS, clamp01(v)] }
}

/** What the viewer sees at a point on the glass: the nearest part of the Kraken, if any. */
export function sampleModel(m: Model, X: number, Y: number): Cell | undefined {
  let best = mantleHit(m, X, Y)
  for (const eye of m.eyes) {
    const hit = eyeHit(m, eye, X, Y)
    if (hit && (!best || hit.z < best.z)) {
      best = hit
    }
  }
  for (const arm of m.arms) {
    const hit = armHit(m, arm, X, Y)
    if (hit && (!best || hit.z < best.z)) {
      best = hit
    }
  }
  for (const web of m.webs) {
    const hit = webHit(m, web, X, Y)
    if (hit && (!best || hit.z < best.z)) {
      best = hit
    }
  }
  return best?.cell
}
