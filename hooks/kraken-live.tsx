// The live Kraken: a Client module that simulates the creature and draws it
// every tick, over water drawn once beneath it. The mood comes in props; the
// instance and its timer outlive every redraw, so a new mood is a new place
// to swim to, never a cut.
//
// It swims as an octopus does: jet strokes, mantle first, arms drawn into a
// trailing bundle, then a glide as they open again. It lives in depth: far
// back in the murk when idle, up at the glass when it needs you. Between
// moves it is never still: it breathes, turns, looks about and blinks.
//
// Pixels are rows of Boxes, two to a cell row (8 × 9.5 px on desktop): a
// coloured Box per run of one shade, a bare Box for a gap.

import type { ClientModule } from 'claude-code'

import { noise } from './field'

import type { Mood } from '../types'
import { BODY, DETAIL, GLOW, IRIS, layers } from './kraken'
import { buildModel, eyeAt, len3, modelBounds, norm3, sampleModel } from './kraken3d'
import type { ArmPose, Body, Camera, V3 } from './kraken3d'

/** The grid comes in props, never from the region: a drawing sized by its region resizes it. */
type Props = { mood: Mood; cols: number; rows: number; view?: View; ink?: number }

/** The pane, tall beside the transcript; or the band, a wide strip above the prompt. */
type View = 'pane' | 'band'

/** How a mood behaves: where it lives, how it moves, how it glows. */
type Plan = {
  /** Home on the glass (fractions) and depth behind it (pixels). */
  home: V3
  /** How far it roams from home, the same way. */
  spread: V3
  light: number
  rune: number
  /** Seconds per rune pulse. */
  runePulse: number
  sway: number
  /** How fast its arms move. */
  pace: number
  lid: number
  /** Ticks between picking a new spot. */
  wander: [number, number]
  /** Seconds a jet stroke takes. */
  stroke: number
  /** How far it turns about, and which way it favours. */
  turn: number
  turnBias: number
  /** Eyes dart, rather than drift. */
  darts: boolean
  /** Arms flare wide now and then. */
  flexes: boolean
  /** How drawn-in its arms rest. */
  rest: number
  /**
   * What it does now and then, by weight: `peer` brings one eye to the glass
   * until it fills the pane; `pass` sweeps it past right against the glass;
   * `cruise` swims it out through one edge and back in through another.
   */
  acts?: Array<{ kind: Act; weight: number }>
  /** Ticks between acts. */
  every?: [number, number]
  /** Ticks a peer holds. */
  hold?: [number, number]
}

type Act = 'peer' | 'pass' | 'cruise' | 'ink'

/** A cloud of ink on the glass: where, how it drifts and spreads, how dense it still is. */
type Puff = { x: number; y: number; vx: number; vy: number; r: number; grow: number; d: number; seed: number }
/** Where the Kraken has just swum through ink, clearing it: a circle on the glass, ageing. */
type Wake = { x: number; y: number; r: number; age: number }

const PLANS: Record<Mood, Plan> = {
  // Back in the murk: drifting, half asleep, turning lazily so its arms wheel about.
  idle: { home: [0.5, 0.58, 120], spread: [0.55, 0.3, 80], light: 0.6, rune: 0.25, runePulse: 4, sway: 0.28, pace: 0.35, lid: 0.25, wander: [90, 200], stroke: 2.6, turn: 1.3, turnBias: 0, darts: false, flexes: false, rest: 0.1, acts: [{ kind: 'cruise', weight: 3 }, { kind: 'pass', weight: 1 }, { kind: 'ink', weight: 0.25 }], every: [250, 500] },
  // Up in the light, restless: shifting spot, eyes darting, arms busy, runes racing.
  working: { home: [0.5, 0.45, -380], spread: [0.55, 0.3, 60], light: 1, rune: 1, runePulse: 1.4, sway: 0.5, pace: 0.9, lid: 0, wander: [50, 110], stroke: 1.6, turn: 0.7, turnBias: 0, darts: true, flexes: true, rest: 0, acts: [{ kind: 'cruise', weight: 2 }, { kind: 'pass', weight: 2 }, { kind: 'ink', weight: 0.4 }], every: [180, 360] },
  // At the glass, facing the conversation, leaning in now and then.
  attention: { home: [0.5, 0.4, -480], spread: [0.08, 0.06, 40], light: 1, rune: 0.9, runePulse: 2, sway: 0.25, pace: 0.5, lid: 0, wander: [70, 140], stroke: 1.8, turn: 0.15, turnBias: -0.35, darts: false, flexes: false, rest: 0, acts: [{ kind: 'peer', weight: 1 }], every: [15, 45], hold: [50, 80] },
}

/**
 * One arm's own life: its clock, the intent it is easing toward, and when it
 * picks its next. Eight of these, each on its own schedule.
 */
type ArmLife = ArmPose & {
  /** Its own pace, against the body's. */
  speed: number
  /** How quickly it follows the body's gather: the stroke ripples through the arms. */
  lag: number
  /** How quickly it moves toward its intent. */
  ease: number
  intent: { curl: number; sweep: number; reach: number; splay: number; wave: number; toward: number }
  next: number
}

/** -1 or 1, evenly. */
const either = () => (Math.random() < 0.5 ? -1 : 1)

/**
 * What an arm may set out to do, and how. Curls go both ways: out and up,
 * or inward, back toward the body; and to either side.
 */
const INTENTS = {
  drift: () => ({ curl: -0.6 + Math.random() * 2, sweep: (Math.random() - 0.5) * 1.2, reach: 0.9 + Math.random() * 0.15, splay: (Math.random() - 0.5) * 0.5, wave: 0.6 + Math.random() * 0.7, toward: 0 }),
  coil: () => ({ curl: either() * (2 + Math.random() * 1), sweep: (Math.random() - 0.5) * 1.6, reach: 0.75, splay: -0.1, wave: 0.3, toward: 0 }),
  hook: () => ({ curl: -(1.8 + Math.random() * 1), sweep: (Math.random() - 0.5) * 0.8, reach: 0.95, splay: 0.15, wave: 0.35, toward: 0 }),
  reach: () => ({ curl: (Math.random() - 0.5) * 0.6, sweep: (Math.random() - 0.5) * 0.6, reach: 1.25 + Math.random() * 0.15, splay: -0.35, wave: 0.4, toward: Math.random() < 0.5 ? 0.55 : 0 }),
  creep: () => ({ curl: (Math.random() - 0.5) * 1.2, sweep: (Math.random() - 0.5) * 1, reach: 1.1, splay: -0.2, wave: 0.25, toward: 0.6 + Math.random() * 0.2 }),
} as const

type Intent = keyof typeof INTENTS | 'twitch'

/** Each mood's mix of what its arms get up to. */
const ARM_MIX: Record<Mood, Array<[Intent, number]>> = {
  idle: [
    ['drift', 7],
    ['coil', 1.5],
    ['hook', 1],
    ['reach', 1],
    ['twitch', 0.5],
  ],
  working: [
    ['drift', 3],
    ['coil', 2],
    ['hook', 1.5],
    ['reach', 2],
    ['twitch', 2],
  ],
  attention: [
    ['creep', 4],
    ['drift', 2],
    ['hook', 1],
    ['coil', 1],
    ['twitch', 1],
  ],
}

type Live = {
  mood: Mood
  view: View
  arms: ArmLife[]
  /** The mood the current target was picked for. */
  planned: Mood | ''
  tick: number
  /** Animation time: runs faster while working and while stroking. */
  t: number
  seed: number
  pos: V3
  vel: V3
  axis: V3
  target: V3
  nextPick: number
  /** Progress through a jet stroke, 0 to 1; -1 between strokes. */
  stroke: number
  gather: number
  squash: number
  yaw: number
  yawTarget: number
  look: number
  lookTarget: number
  nextLook: number
  blinkUntil: number
  nextBlink: number
  flexUntil: number
  nextFlex: number
  light: number
  rune: number
  sway: number
  pace: number
  lid: number
  /** What it is doing: roaming its home, or a close encounter in stages. */
  act: 'roam' | Act
  actStage: number
  actUntil: number
  nextAct: number
  /**
   * A pass or a cruise: the waypoints still ahead. A `jump` waypoint is
   * reached at once: it is only ever taken while the Kraken is out of view.
   */
  route: Array<{ p: V3; jump?: boolean }>
  /** The ink in the water, and the wake that clears it. */
  puffs: Puff[]
  wake: Wake[]
  /** The ink count last seen in props; a rise means something went wrong. */
  inkSeen: number
  inkPending: boolean
  lastInk: number
  /** Until when it is squirting, and until when the blackout holds before it returns. */
  squirtUntil: number
  /** For a peer: which eye it brings to the glass. */
  peerSide: number
}
type State = { live: Live }

const TICK_MS = 100
const DT = TICK_MS / 1000
const PX_W = 8
const PX_H = 9.5
/** Boxes a frame may hold: about 60,000 characters, well inside the 100,000 bound. */
const BOX_BUDGET = 700

/** #rrggbb as #rgb, nearest: a few characters less on every Box. */
function short(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return '#' + [16, 8, 0].map(k => Math.round(((n >> k) & 255) / 17).toString(16)).join('')
}

const STYLES = layers(false).map(style => ({ ...style, shades: style.shades.map(short) }))

/** A layer's shade for a brightness, from at most `levels` of its shades. */
function shade(layer: number, v: number, levels: number): string {
  const all = STYLES[layer]!.shades
  const n = Math.min(levels, all.length)
  const k = Math.min(n - 1, Math.max(0, Math.floor(v * n)))
  return all[n === 1 ? all.length - 1 : Math.round((k * (all.length - 1)) / (n - 1))]!
}

/** A fixed sequence in [0, 1), carried in the state. */
function random(live: Live): number {
  live.seed = (live.seed + 0x6d2b79f5) >>> 0
  let t = live.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const between = (live: Live, [a, b]: [number, number]) => Math.round(a + random(live) * (b - a))

/**
 * The band is a strip: the same creature, framed wide, and far too big for
 * it: a slice of mantle and arms slides past; it roams side to side and
 * leaves through the sides; its eye at the glass fills the strip's height.
 */
const BAND_PLACES: Record<Mood, Pick<Plan, 'home' | 'spread'>> = {
  idle: { home: [0.5, 0.55, 200], spread: [0.55, 0.25, 60] },
  working: { home: [0.5, 0.5, -150], spread: [0.55, 0.3, 50] },
  attention: { home: [0.5, 0.5, -250], spread: [0.06, 0.05, 30] },
}

function planOf(view: View, mood: Mood): Plan {
  return view === 'band' ? { ...PLANS[mood], ...BAND_PLACES[mood] } : PLANS[mood]
}

function camera(W: number, H: number, view: View): Camera {
  return view === 'band' ? { cx: W / 2, cy: H / 2, f: W } : { cx: W / 2, cy: H * 0.45, f: H * 1.3 }
}

/** Mantle width for a view: a share of the pane's width, or of the band's height. */
function sizeOf(W: number, H: number, view: View): number {
  // In the band it is the creature that does not fit: its mantle alone the strip's height.
  return view === 'band' ? H : Math.min(W * 0.42, H * 0.25)
}

/** A point on the glass at a depth, as a world point. */
function onGlass(cam: Camera, sx: number, sy: number, z: number): V3 {
  const k = cam.f / (cam.f + z)
  return [cam.cx + (sx - cam.cx) / k, cam.cy + (sy - cam.cy) / k, z]
}

/** Somewhere near home, partly out of frame as often as not: the frame is a window, not a wall. */
function pickSpot(live: Live, plan: Plan, cam: Camera, W: number, H: number): V3 {
  const jitter = () => random(live) * 2 - 1
  // Mostly to the other side of where it is now: it crosses back and forth.
  const k = cam.f / (cam.f + Math.max(-cam.f * 0.95, live.pos[2]))
  const nowX = (cam.cx + (live.pos[0] - cam.cx) * k) / W
  const across = (nowX < plan.home[0] ? 1 : -1) * (random(live) < 0.7 ? 1 : -1)
  const sx = Math.min(1.15, Math.max(-0.15, plan.home[0] + across * (0.35 + random(live) * 0.65) * plan.spread[0])) * W
  const sy = Math.min(1.1, Math.max(-0.1, plan.home[1] + jitter() * plan.spread[1])) * H
  const z = Math.max(-cam.f * 0.6, plan.home[2] + jitter() * plan.spread[2])
  return onGlass(cam, sx, sy, z)
}

/**
 * A point just out of view past an edge (dx, dy each -1, 0 or 1: a side or
 * a corner), at a depth: far enough out that the whole Kraken is hidden.
 */
function offscreen(live: Live, cam: Camera, W: number, H: number, s: number, dx: number, dy: number, z: number): V3 {
  const k = cam.f / (cam.f + z)
  const margin = 3 * s * k + 10
  const sx = dx < 0 ? -margin : dx > 0 ? W + margin : (0.2 + random(live) * 0.6) * W
  const sy = dy < 0 ? -margin : dy > 0 ? H + margin : (0.2 + random(live) * 0.6) * H
  return onGlass(cam, sx, sy, z)
}

const EDGES: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

function pickAct(live: Live, plan: Plan): Act | undefined {
  const acts = plan.acts ?? []
  let roll = random(live) * acts.reduce((sum, a) => sum + a.weight, 0)
  for (const a of acts) {
    roll -= a.weight
    if (roll <= 0) {
      return a.kind
    }
  }
  return acts[0]?.kind
}

/** Whether nothing of the Kraken is on the glass: mantle and every arm. */
function isOutOfView(live: Live, cam: Camera, W: number, H: number, s: number): boolean {
  const [x0, y0, x1, y1] = modelBounds(
    buildModel(
      {
        pos: live.pos,
        axis: live.axis,
        facing: [Math.sin(live.yaw), 0, -Math.cos(live.yaw)],
        s,
        squash: live.squash,
        gather: live.gather,
        phase: live.t * 1.3,
        sway: live.sway,
        look: 0,
        lid: 0,
        rune: 0,
        light: 1,
        arms: live.arms,
      },
      cam,
    ),
  )
  return x1 < 0 || x0 > W || y1 < 0 || y0 > H
}

/** A world point's place on the glass, and its scale there. */
function project3(cam: Camera, p: V3): { x: number; y: number; k: number } {
  const k = cam.f / (cam.f + Math.max(-cam.f * 0.95, p[2]))
  return { x: cam.cx + (p[0] - cam.cx) * k, y: cam.cy + (p[1] - cam.cy) * k, k }
}

/** One tick of the Kraken's life. */
function step(live: Live, W: number, H: number, s: number): void {
  const plan = planOf(live.view, live.mood)
  const cam = camera(W, H, live.view)
  const ease = (from: number, to: number, rate: number) => from + (to - from) * rate
  live.tick += 1

  // The mood's glow and pace come on gradually.
  live.light = ease(live.light, plan.light, 0.05)
  live.rune = ease(live.rune, plan.rune, 0.06)
  live.sway = ease(live.sway, plan.sway, 0.05)
  live.pace = ease(live.pace, plan.pace, 0.05)
  live.lid = ease(live.lid, plan.lid, 0.08)

  // A new mood ends any encounter and sets when the next one comes.
  const nextActAt = () => live.tick + (plan.every ? between(live, plan.every) : Infinity)
  if (live.planned !== live.mood) {
    live.act = 'roam'
    live.route = []
    live.nextAct = nextActAt()
  }
  const near = (d: number) => len3([live.target[0] - live.pos[0], live.target[1] - live.pos[1], live.target[2] - live.pos[2]]) < d
  const endAct = () => {
    live.act = 'roam'
    live.route = []
    live.nextPick = live.tick
    live.nextAct = nextActAt()
  }
  // Inking: it squirts and jets away, out past an edge and deeper; holds there
  // while the ink spreads to black; then comes back close to the glass from
  // another side and swims straight through it, carving it away.
  const startInk = () => {
    live.act = 'ink'
    live.actStage = 0
    live.lastInk = live.tick
    live.squirtUntil = live.tick + 8
    live.actUntil = live.tick + 8 + between(live, [20, 32])
    const at = project3(cam, live.pos)
    const dx = at.x < W / 2 ? 1 : -1
    const dy = live.view === 'band' ? 0 : random(live) < 0.5 ? -1 : 1
    const close = live.view === 'band' ? -cam.f * 0.25 : -cam.f * 0.35
    live.route = [
      { p: offscreen(live, cam, W, H, s, dx, dy, live.pos[2] + 400) },
      { p: offscreen(live, cam, W, H, s, -dx, 0, close), jump: true },
      { p: offscreen(live, cam, W, H, s, dx, 0, close) },
    ]
    live.target = live.route.shift()!.p
    live.stroke = 0
  }
  if (live.inkPending && live.act !== 'ink' && live.tick - live.lastInk > 150) {
    live.inkPending = false
    startInk()
  }
  live.inkPending = false
  if (live.act === 'roam' && live.tick >= live.nextAct && live.planned === live.mood) {
    const kind = pickAct(live, plan)
    if (kind === 'ink') {
      startInk()
    } else if (kind) {
      live.act = kind
      live.actStage = 0
      if (kind === 'peer') {
        // One eye to the centre of the glass, so close it fills the pane.
        live.peerSide = random(live) < 0.5 ? -1 : 1
        live.yawTarget = 0
      } else if (kind === 'pass') {
        // In close from one side, across, and out the other.
        const from = random(live) < 0.5 ? -1 : 1
        const y = (0.25 + random(live) * 0.5) * H
        const z = -cam.f * 0.62
        live.route = [
          { p: onGlass(cam, from < 0 ? -0.35 * W : 1.35 * W, y, z) },
          { p: onGlass(cam, from < 0 ? 1.4 * W : -0.4 * W, y + (random(live) - 0.5) * H * 0.4, z) },
        ]
      } else {
        // Out through one edge, and back in through another, at another depth.
        // The band is a strip: it leaves and returns through the sides.
        const edges = live.view === 'band' ? EDGES.filter(([dx]) => dx !== 0) : EDGES
        const out = edges[Math.floor(random(live) * edges.length)]!
        let back = edges[Math.floor(random(live) * edges.length)]!
        if (back[0] === out[0] && back[1] === out[1]) {
          back = [-out[0], -out[1]]
        }
        const depth = () => plan.home[2] + (random(live) * 2 - 1) * plan.spread[2]
        live.route = [
          { p: offscreen(live, cam, W, H, s, out[0], out[1], depth()) },
          { p: offscreen(live, cam, W, H, s, back[0], back[1], depth()), jump: true },
          { p: pickSpot(live, plan, cam, W, H) },
        ]
      }
      const first = live.route.shift()
      if (first) {
        live.target = first.p
      }
    }
  }
  if (live.act === 'peer') {
    // Steer by where the eye is now, not where it would be once upright:
    // the body is still turning as it arrives.
    const facing: V3 = [Math.sin(live.yaw), 0, -Math.cos(live.yaw)]
    const eye = eyeAt(live.pos, live.axis, facing, s, live.peerSide)
    const k = (Math.min(W, H) * 0.42) / (0.1 * s * 0.84)
    const want: V3 = [cam.cx, cam.cy, cam.f / k - cam.f]
    live.target = [live.pos[0] + want[0] - eye[0], live.pos[1] + want[1] - eye[1], live.pos[2] + want[2] - eye[2]]
    if (live.actStage === 0 && near(s * 0.12) && len3(live.vel) < s * 0.3) {
      live.actStage = 1
      live.actUntil = live.tick + between(live, plan.hold ?? [50, 80])
    } else if (live.actStage === 1 && live.tick >= live.actUntil) {
      endAct()
    }
  } else if (live.act === 'pass' || live.act === 'cruise' || live.act === 'ink') {
    // Heading out past an edge, it is gone once nothing of it is in view:
    // mantle and every arm. Only then may it come round unseen; after inking,
    // only once the blackout has held.
    const leaving = live.route[0]?.jump === true && (live.act !== 'ink' || live.tick >= live.actUntil)
    if (leaving && near(s * 0.6) && !isOutOfView(live, cam, W, H, s)) {
      // There, but an arm still shows: the way out goes a little further.
      const out = norm3([live.target[0] - cam.cx, live.target[1] - cam.cy, 0])
      live.target = [live.target[0] + out[0] * s * 1.5, live.target[1] + out[1] * s * 1.5, live.target[2]]
    }
    if (leaving ? isOutOfView(live, cam, W, H, s) : near(s * 0.8)) {
      let next = live.route.shift()
      if (next?.jump) {
        // Out of view: come round unseen to where it re-enters, heading in.
        live.pos = next.p
        live.vel = [0, 0, 0]
        next = live.route.shift()
        if (next) {
          live.axis = norm3([next.p[0] - live.pos[0], next.p[1] - live.pos[1], next.p[2] - live.pos[2]])
        }
      }
      if (next) {
        live.target = next.p
        live.actStage += 1
      } else {
        endAct()
      }
    }
  }

  // Somewhere new to be, while roaming: on a new mood at once, else now and then.
  if (live.act === 'roam' && (live.planned !== live.mood || live.tick >= live.nextPick)) {
    live.target = pickSpot(live, plan, cam, W, H)
    live.nextPick = live.tick + between(live, plan.wander)
    live.yawTarget = plan.turnBias + (random(live) * 2 - 1) * plan.turn
  }
  live.planned = live.mood

  // Swim there in jet strokes: squeeze and draw the arms in, then glide.
  const toward: V3 = [live.target[0] - live.pos[0], live.target[1] - live.pos[1], live.target[2] - live.pos[2]]
  const distance = len3(toward)
  if (live.stroke < 0 && distance > s * 0.5) {
    live.stroke = 0
  }
  if (live.stroke >= 0) {
    // A jet stroke in three: the arms flare open and the mantle fills; then
    // they snap shut into a trailing bundle as the mantle squeezes, which is
    // the thrust; then it glides, the bundle loosening slowly.
    live.stroke += DT / plan.stroke
    if (live.stroke < 0.15) {
      live.gather = ease(live.gather, -0.5, 0.4)
      live.squash = ease(live.squash, -0.06, 0.4)
    } else if (live.stroke < 0.4) {
      // Into the glass at full speed; the sweep across it slower and statelier.
      const cap = live.act === 'pass' && live.actStage >= 1 ? s * 1.6 : s * 2.4
      const push = Math.min(distance * 0.75, cap) / (0.83 * Math.max(1, (0.25 * plan.stroke) / DT))
      const dir = norm3(toward)
      live.vel = [live.vel[0] + dir[0] * push, live.vel[1] + dir[1] * push, live.vel[2] + dir[2] * push]
      live.gather = ease(live.gather, 1.05, 0.5)
      live.squash = ease(live.squash, 0.16, 0.45)
    } else {
      live.gather = ease(live.gather, 0.5, 0.06)
      live.squash = ease(live.squash, 0, 0.15)
    }
    if (live.stroke >= 1) {
      live.stroke = -1
    }
  } else {
    // Between strokes: breathing, arms at rest, or flared wide in a flex.
    // Peering at the glass, it keeps its arms down and back, clear of its face.
    const flexing = live.tick < live.flexUntil
    const rest = live.act === 'peer' ? 0.6 : flexing ? -0.45 : plan.rest
    live.gather = ease(live.gather, rest, flexing ? 0.25 : 0.08)
    live.squash = ease(live.squash, Math.sin(live.t * 0.9) * 0.04, 0.2)
  }
  // A long, slow coast after each stroke.
  live.vel = [live.vel[0] * 0.93, live.vel[1] * 0.93, live.vel[2] * 0.93]
  live.pos = [live.pos[0] + live.vel[0] * DT, live.pos[1] + live.vel[1] * DT, live.pos[2] + live.vel[2] * DT]
  // Close to its mark, it settles the last of the way with its fins rather than a stroke:
  // up at the glass a small miss would be magnified across the pane.
  if (live.stroke < 0 && distance < s * 0.5) {
    live.pos = [
      live.pos[0] + (live.target[0] - live.pos[0]) * 0.04,
      live.pos[1] + (live.target[1] - live.pos[1]) * 0.04,
      live.pos[2] + (live.target[2] - live.pos[2]) * 0.04,
    ]
  }

  // Mantle first while it swims; upright, swaying a little, while it hovers.
  const speed = len3(live.vel)
  const moving = Math.hypot(live.vel[0], live.vel[1]) > s * 0.5
  const want: V3 = moving ? norm3([live.vel[0], live.vel[1], live.vel[2] * 0.2]) : norm3([Math.sin(live.t * 0.31) * 0.18, -1, Math.sin(live.t * 0.23) * 0.18])
  const turnRate = moving ? 0.15 : 0.04
  live.axis = norm3([
    live.axis[0] * (1 - turnRate) + want[0] * turnRate,
    live.axis[1] * (1 - turnRate) + want[1] * turnRate,
    live.axis[2] * (1 - turnRate) + want[2] * turnRate,
  ])
  live.yaw = ease(live.yaw, live.yawTarget, 0.03)

  // Eyes: darting while working, drifting otherwise, on the conversation when it needs you.
  if (live.act === 'peer') {
    live.lookTarget = live.actStage === 1 ? (random(live) - 0.5) * 0.3 : 0
  } else if (live.tick >= live.nextLook) {
    live.lookTarget = live.mood === 'attention' ? -1 + random(live) * 0.3 : random(live) * 2 - 1
    live.nextLook = live.tick + (plan.darts ? between(live, [12, 30]) : between(live, [40, 90]))
  }
  live.look = ease(live.look, live.lookTarget, plan.darts ? 0.45 : 0.08)
  if (live.tick >= live.nextBlink) {
    live.blinkUntil = live.tick + 2
    live.nextBlink = live.tick + between(live, [40, 95])
  }
  if (plan.flexes && live.tick >= live.nextFlex) {
    live.flexUntil = live.tick + 8
    live.nextFlex = live.tick + between(live, [70, 130])
  }

  live.t += DT * live.pace * (live.stroke >= 0 ? 1.8 : 1)

  // The ink: squirted from under the mantle, spreading and drifting, thinning
  // slowly while it holds and fast once the Kraken is back through it.
  const scale = cam.f / (cam.f + Math.max(-cam.f * 0.95, live.pos[2]))
  if (live.act === 'ink' && live.tick < live.squirtUntil) {
    const siphon = project3(cam, [live.pos[0] - live.axis[0] * s * 0.2, live.pos[1] - live.axis[1] * s * 0.2, live.pos[2]])
    for (let i = 0; i < 5 && live.puffs.length < 60; i += 1) {
      const angle = random(live) * Math.PI * 2
      const speed = 8 + random(live) * 22
      live.puffs.push({ x: siphon.x, y: siphon.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: s * scale * 0.35, grow: (W + H) * (0.009 + random(live) * 0.006), d: 1, seed: random(live) * 100 })
    }
  }
  const clearing = live.act !== 'ink' || live.actStage >= 1
  for (const puff of live.puffs) {
    puff.x += puff.vx
    puff.y += puff.vy
    puff.vx *= 0.92
    puff.vy *= 0.92
    puff.r += puff.grow
    puff.grow *= 0.95
    puff.d *= clearing ? 0.975 : 0.999
  }
  live.puffs = live.puffs.filter(puff => puff.d > 0.04)
  // Where it swims through the ink, it clears a path, and pushes the clouds aside.
  if (live.puffs.length && clearing) {
    const at = project3(cam, live.pos)
    const reach = s * at.k * 1.4
    live.wake.push({ x: at.x, y: at.y, r: reach, age: 0 })
    for (const puff of live.puffs) {
      const dx = puff.x - at.x
      const dy = puff.y - at.y
      const d = Math.hypot(dx, dy) || 1
      if (d < puff.r + reach) {
        puff.d *= 0.92
        puff.vx += (dx / d) * 6
        puff.vy += (dy / d) * 6
      }
    }
  }
  for (const w of live.wake) {
    w.age += 1
  }
  live.wake = live.wake.filter(w => w.age < 40)

  // Each arm on its own: its own clock, its own lag on the stroke, its own
  // intent, picked on its own schedule from the mood's mix.
  const mix = ARM_MIX[live.mood]
  const total = mix.reduce((sum, [, w]) => sum + w, 0)
  for (const arm of live.arms) {
    arm.phase += DT * live.pace * arm.speed * (live.stroke >= 0 ? 1.8 : 1)
    arm.gather += (live.gather - arm.gather) * arm.lag
    if (live.tick >= arm.next) {
      let roll = random(live) * total
      let pick: Intent = 'drift'
      for (const [kind, weight] of mix) {
        roll -= weight
        if (roll <= 0) {
          pick = kind
          break
        }
      }
      if (pick === 'twitch') {
        arm.twitch = 0.5 + random(live) * 0.4
      } else {
        arm.intent = INTENTS[pick]()
      }
      arm.ease = 0.015 + random(live) * 0.045
      arm.next = live.tick + between(live, pick === 'twitch' ? [15, 40] : [50, 160])
    }
    arm.curl = ease(arm.curl, arm.intent.curl, arm.ease)
    arm.sweep = ease(arm.sweep, arm.intent.sweep, arm.ease)
    arm.reach = ease(arm.reach, arm.intent.reach, arm.ease)
    arm.splay = ease(arm.splay, arm.intent.splay, arm.ease)
    arm.wave = ease(arm.wave, arm.intent.wave, arm.ease)
    arm.toward = ease(arm.toward, arm.intent.toward, arm.ease * 0.7)
    arm.twitch *= 0.82
  }
}

const KrakenLive: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  const W = props.cols * PX_W
  const H = props.rows * PX_H * 2
  const view = props.view ?? 'pane'
  const s = sizeOf(W, H, view)
  const cam = camera(W, H, view)

  let state = surface.state
  if (!state) {
    const plan = planOf(view, props.mood)
    const live: Live = {
      mood: props.mood,
      view,
      arms: Array.from({ length: 8 }, (_, i) => ({
        phase: i * 1.7,
        gather: plan.rest,
        curl: 1,
        sweep: 0,
        reach: 1,
        splay: 0,
        wave: 1,
        toward: 0,
        twitch: 0,
        speed: 0.6 + ((i * 0.37) % 1),
        lag: 0.35 + ((i * 0.53) % 0.4),
        ease: 0.05,
        intent: { curl: 1, sweep: 0, reach: 1, splay: 0, wave: 1, toward: 0 },
        next: i * 7,
      })),
      planned: '',
      tick: 0,
      t: 0,
      seed: 1234567,
      pos: onGlass(cam, plan.home[0] * W, plan.home[1] * H, plan.home[2]),
      vel: [0, 0, 0],
      axis: [0, -1, 0],
      target: [0, 0, 0],
      nextPick: 0,
      stroke: -1,
      gather: plan.rest,
      squash: 0,
      yaw: 0,
      yawTarget: 0,
      look: 0,
      lookTarget: 0,
      nextLook: 0,
      blinkUntil: 0,
      nextBlink: 50,
      flexUntil: 0,
      nextFlex: 90,
      light: plan.light,
      rune: plan.rune,
      sway: plan.sway,
      pace: plan.pace,
      lid: plan.lid,
      act: 'roam',
      actStage: 0,
      actUntil: 0,
      nextAct: plan.acts ? 60 : Infinity,
      route: [],
      puffs: [],
      wake: [],
      inkSeen: props.ink ?? 0,
      inkPending: false,
      lastInk: -1000,
      squirtUntil: 0,
      peerSide: 1,
    }
    state = { live }
    surface.every(TICK_MS, () => {
      step(live, W, H, s)
      surface.setState({ live })
    })
    surface.setState(state)
  }
  const live = state.live
  live.mood = props.mood
  if ((props.ink ?? 0) > live.inkSeen) {
    live.inkSeen = props.ink ?? 0
    live.inkPending = true
  }
  const plan = planOf(live.view, live.mood)

  // Hovering bobs a little; the attention lean comes and goes.
  const hovering = live.stroke < 0
  const scale = cam.f / (cam.f + Math.max(-cam.f * 0.95, live.pos[2]))
  const bob = hovering ? (Math.sin(live.t * 1.1) * s * 0.05) / Math.max(1, scale * scale) : 0
  const lean = live.mood === 'attention' && live.act === 'roam' ? Math.max(0, Math.sin(live.t * 0.8)) * -40 : 0
  const body: Body = {
    pos: [live.pos[0], live.pos[1] + bob, live.pos[2] + lean],
    axis: live.axis,
    facing: [Math.sin(live.yaw), 0, -Math.cos(live.yaw)],
    s,
    squash: live.squash,
    gather: live.gather,
    phase: live.t * 1.3,
    sway: live.sway,
    look: live.look,
    lid: live.tick < live.blinkUntil ? 1 : live.lid,
    rune: live.rune * (0.7 + 0.3 * Math.sin((live.t / plan.runePulse) * Math.PI * 2)),
    light: live.light,
    arms: live.arms,
  }
  const model = buildModel(body, cam)

  // The Kraken's cells, sampled once a frame; shading is chosen below.
  const cells: Array<Array<readonly [number, number] | undefined>> = []
  for (let py = 0; py < props.rows * 2; py += 1) {
    const row: Array<readonly [number, number] | undefined> = []
    for (let x = 0; x < props.cols; x += 1) {
      const cell = sampleModel(model, (x + 0.5) * PX_W, (py + 0.5) * PX_H)
      row.push(cell && (cell[0] === BODY || cell[0] === DETAIL || cell[0] === GLOW || cell[0] === IRIS) ? cell : undefined)
    }
    cells.push(row)
  }

  // The ink, per pixel: the clouds' density, less what the wake has cleared.
  // It covers the Kraken, except once it is back and swimming through it.
  const inkBehind = live.act === 'ink' && live.actStage >= 1
  const inkGrid = new Map<number, string>()
  const inkAt = (x: number, py: number): string => {
    if (!live.puffs.length) {
      return ''
    }
    const key = py * props.cols + x
    const known = inkGrid.get(key)
    if (known !== undefined) {
      return known
    }
    const X = (x + 0.5) * PX_W
    const Y = (py + 0.5) * PX_H
    let density = 0
    for (const puff of live.puffs) {
      const dx = X - puff.x
      const dy = Y - puff.y
      const dist = Math.hypot(dx, dy)
      if (dist > puff.r * 1.15) {
        continue
      }
      // A ragged edge that shifts as it billows, not a disc.
      const edge = 0.78 + 0.37 * noise(Math.atan2(dy, dx) * 2.5 + puff.seed, live.t * 0.6 + puff.seed)
      const q = dist / (puff.r * edge)
      if (q < 1) {
        density += puff.d * (1 - q * q) * 1.4
      }
    }
    let cleared = 0
    for (const w of live.wake) {
      const q = Math.hypot(X - w.x, Y - w.y) / w.r
      if (q < 1) {
        cleared = Math.max(cleared, (1 - q) * (1 - w.age / 60))
      }
    }
    density = Math.min(1, density) * (1 - 0.95 * cleared)
    const colour = density > 0.75 ? '#020204' : density > 0.5 ? '#06080d' : density > 0.28 ? '#0a141c' : ''
    inkGrid.set(key, colour)
    return colour
  }

  /** One pixel row as Boxes: a bare Box per gap, a coloured one per run of one shade. */
  const pixelRow = (py: number, levels: number, step: number) => {
    const boxes = []
    let start = 0
    const at = (x: number): string => {
      const sx = x - (x % step)
      const cell = cells[py]![sx]
      const ink = inkAt(sx, py)
      if (ink && !(cell && inkBehind)) {
        return ink
      }
      return cell ? shade(cell[0], cell[1], levels) : ink
    }
    let c = at(0)
    for (let x = 1; x <= props.cols; x += 1) {
      const n = x < props.cols ? at(x) : '\u0000'
      if (n !== c) {
        if (c) {
          boxes.push(<Box width={x - start} backgroundColor={c} />)
        } else if (n !== '\u0000') {
          boxes.push(<Box width={x - start} />)
        }
        start = x
        c = n
      }
    }
    return boxes
  }

  // Full detail if it fits: 8 × 9.5 px pixels, two rows to a cell row. Else
  // fewer shades; and last, pixels twice as big each way (16 × 19 px, a row
  // to a cell row), so a Kraken up at the glass reads as pixel art zoomed in.
  const draw = (levels: number, isCoarse: boolean) => {
    const out = []
    let boxes = 0
    let empty = 0
    for (let y = 0; y < props.rows; y += 1) {
      const halves = isCoarse ? [pixelRow(y * 2, levels, 2)] : [pixelRow(y * 2, levels, 1), pixelRow(y * 2 + 1, levels, 1)]
      if (halves.every(h => !h.length)) {
        empty += 1
        continue
      }
      if (empty) {
        out.push(<Box height={empty} />)
        empty = 0
      }
      boxes += halves.reduce((sum, h) => sum + h.length, 0)
      out.push(
        isCoarse ? (
          <Box flexDirection="row" height={1} alignItems="stretch">
            {halves[0]}
          </Box>
        ) : (
          <Box flexDirection="column" height={1}>
            <Box flexDirection="row" height="50%" alignItems="stretch">
              {halves[0]}
            </Box>
            <Box flexDirection="row" height="50%" alignItems="stretch">
              {halves[1]}
            </Box>
          </Box>
        ),
      )
    }
    return { out, boxes }
  }
  let drawn = draw(8, false)
  for (const [levels, isCoarse] of [
    [6, false],
    [4, false],
    [6, true],
    [4, true],
    [3, true],
  ] as const) {
    if (drawn.boxes <= BOX_BUDGET) {
      break
    }
    drawn = draw(levels, isCoarse)
  }
  const out = drawn.out
  return (
    <Box flexDirection="column" width={props.cols} height={props.rows}>
      {out}
    </Box>
  )
}

export default KrakenLive
