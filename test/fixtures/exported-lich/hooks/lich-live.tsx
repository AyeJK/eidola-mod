// The live Lich: a Client module that keeps it and draws it every tick, in
// glyphs, over the dark drawn once beneath it. The mood comes in props; the
// instance and its timer outlive every redraw, so a new mood is something
// it turns to, never a cut.
//
// It hangs in the dark, drifting, its bone a slow shimmer of signs. Idle,
// its fire is low and a few runes wheel lazily about its head. Working, the
// fire streams up from its sockets, the runes race, the signs churn, and now
// and then it chants. When it needs you it comes right up to the glass, its
// eyes gone to witchlight. Something gone wrong scorches it red for a moment.

import type { ClientModule } from 'claude-code'

import type { Mood } from './eidola-types'
import { hash } from './field'
import { ARCANE, COLOURS, ROBE_EMERALD, ROBE_PURPLE, FIRE, SCORCHED, WITCHLIGHT, framing, glyphFor } from './lich'
import type { View } from './lich'
import { BONE, CROWN, GEM, MANTLE, buildModel, modelBounds, sampleModel } from './lich3d'
import type { Pose } from './lich3d'
import { grimoireGlyphs } from './grimoire3d'
import { drawGlyphs } from './live-glyphs'
import { mixRamp, pick, short } from './live-pixels'

/**
 * The grid comes in props, never from the region: a drawing sized by its
 * region resizes it. `rows` is the whole picture's height; `slice` the rows
 * this drawing draws, [first, count], when it is split across several.
 *
 * Split, each drawing keeps its own copy, and they stay as one: the
 * simulation is deterministic, its ticks counted from `epoch` (ms), and a
 * new mood or ink takes effect a few ticks after its time (`moodAt`,
 * `inkAt`, ms), by when every drawing has heard of it.
 */
type Props = {
  mood: Mood
  cols: number
  rows: number
  view?: View
  ink?: number
  slice?: [number, number]
  epoch?: number
  moodAt?: number
  inkAt?: number
  /** The mood before this one: what a drawing started late lived through first. */
  moodBefore?: Mood
}

/**
 * What one copy carries across a resync, so every copy agrees: the mood and
 * the ink, now and pending.
 */
type Carry = Pick<Live, 'mood' | 'moodNext' | 'moodTick' | 'inkSeen' | 'inkPending' | 'inkTick'>

/**
 * What it does now and then. `turn` looks aside; `chuckle` rattles its jaw;
 * `drift` moves it across the glass; `gutter` lets its fire sink and flare;
 * `loom` brings it nearer; `chant` is a spell, jaw working, fire high; `surge`
 * sets the runes racing; `tilt` cocks its head; `speak` is a word to you.
 * And it flies: a `swoop` dives out through one side and comes back from the
 * other; a `dip` sinks out of the bottom and rises again; a `pass` sweeps
 * past right against the glass. A `vanish` dissolves it into drifting motes,
 * and it gathers itself again somewhere else. Its arms hang at its sides
 * but for a `gesture`, one hand lifted, and a `beckon` to you.
 */
type Act = 'turn' | 'chuckle' | 'drift' | 'gutter' | 'loom' | 'chant' | 'surge' | 'tilt' | 'speak' | 'swoop' | 'dip' | 'pass' | 'vanish' | 'gesture' | 'beckon'

/**
 * A waypoint: across and down the glass (fractions) and depth (pixels). A
 * `jump` one is reached at once, and only ever while the Lich is out of view.
 */
type Waypoint = { x: number; y: number; z: number; jump?: boolean }

/** Acts that fly a route: out of frame and back. */
const FLIGHTS: ReadonlySet<Act> = new Set(['swoop', 'dip', 'pass'])

type Plan = {
  /** Across the glass (a fraction), depth behind it (pixels), height on the glass (a fraction). */
  home: [number, number, number]
  spread: number
  pitch: number
  eyes: number
  flame: number
  runes: number
  /** Radians a second the runes wheel. */
  spin: number
  /** How fast the bone's signs change. */
  churn: number
  light: number
  acts: Array<[Act, number]>
  every: [number, number]
}

const PLANS: Record<Mood, Plan> = {
  // Hanging in the dark, fire low, a few runes drifting round.
  idle: { home: [0.5, 0, 0.27], spread: 0.1, pitch: 0.1, eyes: 0.55, flame: 0.15, runes: 0.5, spin: 0.15, churn: 0.6, light: 0.75, acts: [['turn', 3], ['chuckle', 1.5], ['drift', 2], ['gutter', 1.5], ['loom', 1], ['swoop', 2], ['dip', 1.5], ['pass', 1], ['vanish', 0.5], ['gesture', 1.5]], every: [50, 140] },
  // Burning: flame streaming from its sockets, every rune racing.
  working: { home: [0.5, -80, 0.26], spread: 0.06, pitch: -0.04, eyes: 1.1, flame: 1, runes: 1, spin: 0.9, churn: 3, light: 1, acts: [['chant', 3], ['surge', 2], ['turn', 1], ['swoop', 0.8], ['dip', 0.6], ['vanish', 0.2]], every: [40, 100] },
  // At the glass, eyes gone to witchlight, looking at you.
  attention: { home: [0.5, -380, 0.3], spread: 0.03, pitch: -0.02, eyes: 1.6, flame: 0.5, runes: 0.6, spin: 0.3, churn: 1, light: 1, acts: [['tilt', 3], ['speak', 2], ['loom', 1], ['beckon', 2]], every: [20, 50] },
}

/**
 * The band: a strip across its face at the pane's own scale, the same signs
 * the same size, its eyes in the middle row: brow above, nose and teeth below.
 */
const BAND_HOMES: Record<Mood, [number, number, number]> = {
  idle: [0.5, 0, 0.27],
  working: [0.5, 0, 0.3],
  attention: [0.5, -40, 0.3],
}

function planOf(view: View, mood: Mood): Plan {
  return view === 'band' ? { ...PLANS[mood], home: BAND_HOMES[mood], spread: mood === 'attention' ? 0.03 : 0.12, runes: 0 } : PLANS[mood]
}

export type Live = {
  mood: Mood
  view: View
  planned: Mood | ''
  tick: number
  t: number
  seed: number
  x: number
  z: number
  y: number
  xTarget: number
  pitch: number
  yaw: number
  roll: number
  jaw: number
  eyes: number
  look: [number, number]
  lookTarget: [number, number]
  nextLook: number
  flame: number
  runes: number
  spin: number
  spinRate: number
  churn: number
  /** Time for the glyphs: runs faster as the signs churn. */
  glyphT: number
  light: number
  /** 0 ember, 1 witchlight: the fire's colour. */
  witch: number
  /** How far arcane fire has kindled across its signs: 1 while it works. */
  arcane: number
  /** How far its robe has gone to purple (working), and to emerald (attention): 0 to 1 each. */
  heat: number
  /** The band's grimoire: a page turning (0 to 1, or -1), which pages are open, when the next turns. */
  flip: number
  pages: number
  nextFlip: number
  alarm: number
  blinkUntil: number
  nextBlink: number
  act: Act | 'none'
  actUntil: number
  nextAct: number
  side: number
  /** Its drift across the glass, in pixels a tick. */
  vx: number
  vy: number
  /** A flight's waypoints still ahead. */
  route: Waypoint[]
  /** How much of it is here: 1 whole, 0 dissolved to nothing. */
  presence: number
  /** Its arms, x < 0 then x > 0: how raised and how flung out, easing to where they are going. */
  arms: [{ raise: number; spread: number }, { raise: number; spread: number }]
  /** A gesture greeting a new mood, and until when. */
  greet: 'conjure' | 'beckon' | 'none'
  greetUntil: number
  inkSeen: number
  scorchUntil: number
  scorch: number
  moodNext: Mood
  moodTick: number
  inkPending: boolean
  inkTick: number
}
/** A copy's Lich, and the last few seconds of it, one snapshot a tick, to replay from. */
type State = { live: Live; past: Live[] }

const TICK_MS = 100
const DT = TICK_MS / 1000
const CW = 8
const CH = 19
/** Ticks a split drawing may simulate at once, catching up. */
const CATCH_UP = 50
/** How far back a freshly mounted drawing starts: a whole number of these before now. */
const ERA = 6000
/** Ticks a vanishing takes, all told: going, gone, and gathered again. */
const VANISH = 30
/** Ticks before its end it starts to gather again; and the tick, a little before that, it moves while nothing of it shows. */
const GATHER = 12
/** Ticks of the past a copy keeps, to replay a change it heard of late. */
const MEMORY = 80

const EMBER = COLOURS.map(ramp => ramp.map(short))
const COLD = WITCHLIGHT.map(short)
const GREEN = ARCANE.map(short)
const RED = SCORCHED.map(short)
function random(live: Live): number {
  live.seed = (live.seed + 0x6d2b79f5) >>> 0
  let t = live.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const between = (live: Live, [a, b]: [number, number]) => Math.round(a + random(live) * (b - a))

function pickAct(live: Live, plan: Plan): Act {
  let roll = random(live) * plan.acts.reduce((sum, [, w]) => sum + w, 0)
  for (const [act, weight] of plan.acts) {
    roll -= weight
    if (roll <= 0) {
      return act
    }
  }
  return plan.acts[0]![0]
}

function poseOf(live: Live, W: number, H: number): Pose {
  const { s } = framing(live.view, W, H)
  // It floats: a slow rise and fall, never still.
  const hover = Math.sin(live.t * 0.7) * s * 0.03
  return {
    pos: [live.x * W, live.y * H + hover, live.z],
    s,
    yaw: live.yaw,
    pitch: live.pitch,
    roll: live.roll,
    bodyYaw: live.yaw * 0.3,
    jaw: live.jaw,
    eyes: live.tick < live.blinkUntil ? live.eyes * 0.15 : live.eyes,
    look: live.look,
    flame: live.flame,
    runes: live.runes,
    spin: live.spin,
    t: live.t,
    light: live.light,
    arms: [{ ...live.arms[0] }, { ...live.arms[1] }],
  }
}

function step(live: Live, W: number, H: number): void {
  live.tick += 1
  live.t = live.tick * DT
  if (live.tick % ERA === ERA - 18) {
    live.act = 'vanish'
    live.actUntil = live.tick + VANISH
    live.route = []
  }
  if (live.tick % ERA === 0) {
    resync(live)
  }
  if (live.mood !== live.moodNext && live.tick >= live.moodTick) {
    live.mood = live.moodNext
  }
  if (live.inkPending && live.tick >= live.inkTick) {
    live.inkPending = false
    live.scorchUntil = live.tick + 30
  }
  const plan = planOf(live.view, live.mood)
  const ease = (from: number, to: number, rate: number) => from + (to - from) * rate

  const endAct = () => {
    live.act = 'none'
    live.route = []
    live.nextAct = live.tick + between(live, plan.every)
  }
  if (live.planned !== live.mood) {
    live.planned = live.mood
    live.xTarget = plan.home[0]
    endAct()
    live.nextAct = live.tick + between(live, [10, 30])
    // A new mood is greeted with its hands: raised to conjure as work begins, one lifted to you when it needs you.
    live.greet = live.mood === 'working' ? 'conjure' : live.mood === 'attention' ? 'beckon' : 'none'
    live.greetUntil = live.tick + 45
    live.side = random(live) < 0.5 ? -1 : 1
  }
  if (live.act !== 'none' && live.tick >= live.actUntil) {
    endAct()
  }
  const homeY = live.view === 'band' ? framing('band', W, H).home[1] : plan.home[2]
  if (live.act === 'none' && live.tick >= live.nextAct) {
    const act = pickAct(live, plan)
    live.act = act
    live.side = random(live) < 0.5 ? -1 : 1
    live.actUntil = live.tick + between(live, act === 'chant' ? [30, 50] : act === 'turn' ? [30, 60] : [18, 35])
    if (act === 'drift') {
      live.xTarget = plan.home[0] + (random(live) * 2 - 1) * plan.spread
      endAct()
    } else if (FLIGHTS.has(act)) {
      live.route = flight(live, act, plan, homeY, W, H)
      live.actUntil = live.tick + 600
    } else if (act === 'vanish') {
      live.actUntil = live.tick + VANISH
    }
  }

  let pitch = plan.pitch
  let yaw = Math.sin(live.t * 0.23) * 0.12
  let roll = Math.sin(live.t * 0.31) * 0.05
  let jaw = 0
  let eyes = plan.eyes
  let flame = plan.flame
  let runes = plan.runes
  let spinRate = plan.spin
  let z = plan.home[1]
  let look: [number, number] = live.lookTarget
  switch (live.act) {
    case 'turn':
      yaw = live.side * 0.45
      look = [live.side * 0.6, 0]
      break
    case 'chuckle':
      jaw = 0.25 * Math.abs(Math.sin(live.t * 11))
      pitch -= 0.1
      break
    case 'gutter': {
      const k = (live.actUntil - live.tick) / 30
      eyes *= k > 0.5 ? 0.15 : 1.6
      break
    }
    case 'loom':
      z -= 200
      eyes += 0.3
      break
    case 'chant':
      jaw = 0.35 * Math.abs(Math.sin(live.t * 8))
      pitch = -0.15
      eyes = 1.6
      flame = 1
      spinRate *= 2.5
      break
    case 'surge':
      eyes += 0.3
      flame = 1
      break
    case 'tilt':
      roll = live.side * 0.22
      look = [live.side * 0.3, 0]
      break
    case 'speak':
      jaw = 0.3 * Math.abs(Math.sin(live.t * 9)) * (Math.sin(live.t * 2.3) > -0.3 ? 1 : 0)
      break
  }
  // Scorched: it flinches back, its fire flaring, its jaw agape.
  const scorched = live.tick < live.scorchUntil
  if (scorched) {
    const k = (live.scorchUntil - live.tick) / 30
    roll += Math.sin(live.t * 18) * 0.15 * k
    jaw = Math.max(jaw, 0.5 * k)
    eyes = Math.max(eyes, 1.5)
    z += 120 * k
  }

  // Its arms: down at its sides unless it is greeting a mood or doing something with them.
  const arms = [
    { raise: 0, spread: 0 },
    { raise: 0, spread: 0 },
  ]
  const one = live.side < 0 ? 0 : 1
  if (live.tick < live.greetUntil) {
    if (live.greet === 'conjure') {
      arms[0]!.raise = arms[1]!.raise = 1
    } else if (live.greet === 'beckon') {
      arms[one]!.raise = 0.85
    }
  }
  switch (live.act) {
    case 'chant':
      arms[0]!.raise = arms[1]!.raise = 1
      break
    case 'surge':
      arms[0]!.spread = arms[1]!.spread = 1
      arms[0]!.raise = arms[1]!.raise = 0.5
      break
    case 'gesture':
      arms[one]!.raise = 0.75
      break
    case 'beckon':
      arms[one]!.raise = 0.8 + 0.12 * Math.sin(live.t * 4)
      break
    case 'speak':
      arms[one]!.raise = 0.45 + 0.2 * Math.sin(live.t * 2.5)
      break
  }
  if (scorched) {
    const k = (live.scorchUntil - live.tick) / 30
    arms[0]!.spread = arms[1]!.spread = 0.7 * k
  }
  for (const i of [0, 1] as const) {
    live.arms[i].raise = ease(live.arms[i].raise, arms[i]!.raise, 0.1)
    live.arms[i].spread = ease(live.arms[i].spread, arms[i]!.spread, 0.1)
  }

  // Dissolving and gathering again: gone for a moment in the middle, it
  // moves while there is nothing of it to see.
  let presence = 1
  if (live.act === 'vanish') {
    const left = live.actUntil - live.tick
    presence = left > GATHER ? 0 : 1
    if (left === GATHER + 1) {
      live.xTarget = plan.home[0] + (random(live) * 2 - 1) * Math.max(plan.spread, 0.2)
      live.x = live.xTarget
      live.y = homeY + (random(live) - 0.5) * (live.view === 'band' ? 0 : 0.06)
      live.vx = 0
      live.vy = 0
    }
  }
  // Quick each way, and whole (or gone) once nearly there: no motes lingering at the edge.
  live.presence = ease(live.presence, presence, presence ? 0.2 : 0.22)
  if (presence ? live.presence > 0.97 : live.presence < 0.02) {
    live.presence = presence
  }

  // Where it is headed: home, or the next waypoint of a flight. A jump is
  // taken only once nothing of it is on the glass.
  let tx = live.xTarget
  let ty = homeY
  const wp = live.route[0]
  if (wp?.jump) {
    if (isOutOfView(live, W, H)) {
      live.x = wp.x
      live.y = wp.y
      live.z = wp.z
      live.vx = 0
      live.vy = 0
      live.route.shift()
    } else {
      // Not out yet: keep going the way it was.
      tx = live.x + (live.vx / W) * 20
      ty = live.y + (live.vy / H) * 20
    }
  } else if (wp) {
    tx = wp.x
    ty = wp.y
    z = wp.z
    if (Math.hypot((wp.x - live.x) * W, (wp.y - live.y) * H) < 40) {
      live.route.shift()
      if (!live.route.length) {
        endAct()
      }
    }
  }
  // It flies on a spring: it gathers speed, carries through its turns, and settles.
  live.vx = (live.vx + (tx - live.x) * W * 0.004) * 0.9
  live.vy = (live.vy + (ty - live.y) * H * 0.004) * 0.9
  live.x += live.vx / W
  live.y += live.vy / H
  live.z = ease(live.z, z, 0.06)
  // Banking into its turns, nose down as it dives.
  live.pitch = ease(live.pitch, pitch + Math.max(-0.3, Math.min(0.3, live.vy * 0.008)), 0.08)
  live.yaw = ease(live.yaw, yaw + Math.max(-0.45, Math.min(0.45, live.vx * 0.012)), 0.07)
  live.roll = ease(live.roll, roll - Math.max(-0.3, Math.min(0.3, live.vx * 0.006)), scorched ? 0.5 : 0.08)
  live.jaw = ease(live.jaw, jaw, 0.4)
  live.eyes = ease(live.eyes, eyes, 0.15)
  live.look = [ease(live.look[0], look[0], 0.2), ease(live.look[1], look[1], 0.2)]
  live.flame = ease(live.flame, flame, 0.08)
  live.runes = ease(live.runes, runes, 0.04)
  live.spinRate = ease(live.spinRate, spinRate, 0.05)
  live.spin += live.spinRate * DT
  live.churn = ease(live.churn, plan.churn, 0.05)
  live.glyphT += live.churn * DT
  live.light = ease(live.light, plan.light, 0.05)
  live.witch = ease(live.witch, live.mood === 'attention' ? 1 : 0, 0.1)
  live.arcane = ease(live.arcane, live.mood === 'working' ? (live.act === 'chant' || live.act === 'surge' ? 1.5 : 1) : 0, 0.05)
  live.heat = ease(live.heat, live.mood === 'working' ? 1 : 0, 0.06)
  // The grimoire turns its pages while it works, one after another; at rest it lies still.
  if (live.flip >= 0) {
    live.flip += 0.07
    if (live.flip >= 1) {
      live.flip = -1
      live.pages += 1
      live.nextFlip = live.tick + between(live, [6, 18])
    }
  } else if (live.mood === 'working' && live.tick >= live.nextFlip) {
    live.flip = 0
  }
  live.alarm = ease(live.alarm, live.mood === 'attention' ? 1 : 0, 0.08)
  live.scorch = ease(live.scorch, scorched ? 1 : 0, scorched ? 0.4 : 0.06)

  if (live.tick >= live.nextLook && live.act === 'none') {
    live.lookTarget = [(random(live) * 2 - 1) * 0.4, (random(live) * 2 - 1) * 0.2]
    live.nextLook = live.tick + between(live, [25, 70])
  }
  if (live.tick >= live.nextBlink) {
    live.blinkUntil = live.tick + 2
    live.nextBlink = live.tick + between(live, [50, 140])
  }
}

/** Whether nothing of the Lich is on the glass. */
function isOutOfView(live: Live, W: number, H: number): boolean {
  const [x0, y0, x1] = modelBounds(buildModel(poseOf(live, W, H), framing(live.view, W, H).cam))
  return x1 < 0 || x0 > W || y0 > H
}

/** How far past an edge (as a fraction) its centre must be for all of it to be gone, at a depth. */
function outside(view: View, W: number, H: number, z: number): { x: number; y: number } {
  const { cam, s } = framing(view, W, H)
  const k = cam.f / (cam.f + z)
  return { x: (1.8 * s * k) / W + 0.05, y: (1.8 * s * k) / H + 0.05 }
}

/**
 * A flight's waypoints. A swoop dives out one side and comes back in from
 * the other; a dip sinks out the bottom and rises again elsewhere; a pass
 * leaves, sweeps back across right against the glass, and comes home.
 */
function flight(live: Live, act: Act, plan: Plan, homeY: number, W: number, H: number): Waypoint[] {
  const side = live.side
  const z = plan.home[1]
  const far = outside(live.view, W, H, z)
  const isBand = live.view === 'band'
  const home = { x: plan.home[0], y: homeY, z }
  const edge = (dir: number, o: { x: number }) => (dir > 0 ? 1 + o.x : -o.x)
  if (act === 'dip' && !isBand) {
    return [
      { x: live.x + side * 0.15, y: 1 + far.y, z },
      { x: plan.home[0] - side * 0.2, y: 1 + far.y, z, jump: true },
      home,
    ]
  }
  if (act === 'pass') {
    const near = -420
    const close = outside(live.view, W, H, near)
    return [
      { x: edge(side, far), y: homeY + (isBand ? 0 : 0.06), z },
      { x: edge(-side, close), y: homeY + (isBand ? 0 : 0.04), z: near, jump: true },
      { x: edge(side, close), y: homeY + (isBand ? 0 : 0.1), z: near },
      { x: edge(-side, far), y: homeY - (isBand ? 0 : 0.08), z, jump: true },
      home,
    ]
  }
  return [
    { x: edge(side, far), y: homeY + (isBand ? 0 : 0.12), z: z - 80 },
    { x: edge(-side, far), y: homeY - (isBand ? 0 : 0.1), z: z + 120, jump: true },
    home,
  ]
}

/**
 * A Lich at a tick, the same for every copy that starts there. Past the
 * first, a start is a resync: mid-vanish, nothing of it showing, gathering
 * itself again.
 */
export function born(carry: Carry, view: View, tick: number): Live {
  const plan = planOf(view, carry.mood)
  const isResync = tick > 0
  return {
    ...carry,
    view,
    planned: carry.mood,
    tick,
    t: tick * DT,
    seed: (1234567 + tick * 2654435761) >>> 0,
    x: plan.home[0],
    z: plan.home[1],
    y: plan.home[2],
    xTarget: plan.home[0],
    pitch: plan.pitch,
    yaw: 0,
    roll: 0,
    jaw: 0,
    eyes: plan.eyes,
    look: [0, 0],
    lookTarget: [0, 0],
    nextLook: tick + 30,
    flame: plan.flame,
    runes: plan.runes,
    spin: 0,
    spinRate: plan.spin,
    churn: plan.churn,
    glyphT: 0,
    light: plan.light,
    witch: carry.mood === 'attention' ? 1 : 0,
    arcane: carry.mood === 'working' ? 1 : 0,
    heat: carry.mood === 'working' ? 1 : 0,
    flip: -1,
    pages: 0,
    nextFlip: tick + 10,
    alarm: carry.mood === 'attention' ? 1 : 0,
    blinkUntil: 0,
    nextBlink: tick + 50,
    act: isResync ? 'vanish' : 'none',
    actUntil: isResync ? tick + GATHER + 2 : 0,
    nextAct: tick + 40,
    side: 1,
    vx: 0,
    vy: 0,
    route: [],
    presence: isResync ? 0 : 1,
    arms: [
      { raise: 0, spread: 0 },
      { raise: 0, spread: 0 },
    ],
    greet: 'none',
    greetUntil: 0,
    scorchUntil: 0,
    scorch: 0,
  }
}

/**
 * Every ERA ticks every copy vanishes, and while nothing of it shows, is
 * born again from the same state at the same tick: copies that started at
 * different times, or drifted, are one again. A copy that starts late starts
 * from the last of these.
 */
function resync(live: Live): void {
  const { mood, moodNext, moodTick, inkSeen, inkPending, inkTick, flip, pages, nextFlip } = live
  Object.assign(live, born({ mood, moodNext, moodTick, inkSeen, inkPending, inkTick }, live.view, live.tick))
  // The grimoire keeps its place: an open book does not jump back a chapter.
  Object.assign(live, { flip, pages, nextFlip })
}

type Sampled = { layer: number; v: number; glyph?: string }

const copy = (live: Live): Live => JSON.parse(JSON.stringify(live)) as Live

/** One tick on, keeping what it was before it. */
export function advance(live: Live, past: Live[], W: number, H: number): void {
  past.push(copy(live))
  if (past.length > MEMORY) {
    past.shift()
  }
  step(live, W, H)
}

/**
 * A change heard of after its tick (`at`) had already gone by: what the
 * other copies did on time, this one does late, and from there their lots
 * would part. So it goes back to before that tick and lives it again,
 * knowing. Past what it remembers, it takes the change as it comes.
 */
export function replay(live: Live, past: Live[], at: number, W: number, H: number): void {
  const from = past.findLastIndex(p => p.tick < at)
  if (from < 0) {
    return
  }
  const now = live.tick
  const known = { moodNext: live.moodNext, moodTick: live.moodTick, inkSeen: live.inkSeen, inkTick: live.inkTick }
  Object.assign(live, past[from]!)
  past.length = from
  live.moodNext = known.moodNext
  live.moodTick = known.moodTick
  if (known.inkSeen > live.inkSeen) {
    live.inkSeen = known.inkSeen
    live.inkPending = true
    live.inkTick = known.inkTick
  }
  while (live.tick < now) {
    advance(live, past, W, H)
  }
}

const LichLive: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const W = props.cols * CW
  const H = props.rows * CH
  const view = props.view ?? 'pane'
  const [first, count] = props.slice ?? [0, props.rows]

  const clock = (): number | undefined => {
    if (props.epoch === undefined || typeof Date === 'undefined') {
      return undefined
    }
    const tick = Math.floor((Date.now() - props.epoch) / TICK_MS)
    return tick >= 0 && tick < 1e8 ? tick : undefined
  }
  const tickOf = (ms: number | undefined, fallback: number) => (ms === undefined || props.epoch === undefined ? fallback : Math.floor((ms - props.epoch) / TICK_MS) + 3)

  let state = surface.state
  if (!state) {
    const now = clock()
    const base = now === undefined ? 0 : Math.max(0, Math.floor((now - CATCH_UP) / ERA) * ERA)
    // What it was living through at the base tick: a newer mood or ink is still to come.
    const moodTick = tickOf(props.moodAt, 0)
    const inkTick = tickOf(props.inkAt, 0)
    const isNewMood = moodTick > base && props.moodBefore !== undefined
    const isNewInk = inkTick > base && (props.ink ?? 0) > 0
    const live = born(
      {
        mood: isNewMood ? props.moodBefore! : props.mood,
        moodNext: props.mood,
        moodTick,
        inkSeen: (props.ink ?? 0) - (isNewInk ? 1 : 0),
        inkPending: isNewInk,
        inkTick,
      },
      view,
      base,
    )
    const past: Live[] = []
    while (now !== undefined && live.tick < now) {
      if (now - live.tick > MEMORY) {
        step(live, W, H)
      } else {
        advance(live, past, W, H)
      }
    }
    state = { live, past }
    // Tell the hooks which clock this copy keeps: shared, or its own (and so not in step).
    surface.post({ clock: now === undefined ? `own (epoch ${props.epoch ?? 'none'})` : `shared, tick ${now}` })
    surface.every(TICK_MS, () => {
      const target = clock() ?? live.tick + 1
      for (let i = 0; i < CATCH_UP && live.tick < target; i += 1) {
        advance(live, past, W, H)
      }
      surface.setState({ live, past })
    })
    surface.setState(state)
  }
  const { live, past } = state
  if (props.mood !== live.moodNext) {
    live.moodNext = props.mood
    live.moodTick = tickOf(props.moodAt, live.tick + 1)
    if (live.moodTick <= live.tick) {
      replay(live, past, live.moodTick, W, H)
    }
  }
  if ((props.ink ?? 0) > live.inkSeen) {
    live.inkSeen = props.ink ?? 0
    live.inkPending = true
    live.inkTick = tickOf(props.inkAt, live.tick + 1)
    if (live.inkTick <= live.tick) {
      replay(live, past, live.inkTick, W, H)
    }
  }

  const scorch = live.scorch
  const witch = live.witch
  const arcane = live.arcane
  // The robe's colour this frame: dark red, going to purple as it works or
  // emerald when it needs you, the whole robe at once.
  const robeRamp = mixRamp(mixRamp(COLOURS[MANTLE]!, ROBE_PURPLE, live.heat), ROBE_EMERALD, live.alarm).map(short)
  // Which crown signs burn arcane changes a few times a second.
  const kindle = Math.floor(live.t * 3)
  const presence = live.presence
  const paint = (cell: Sampled | null | undefined, x: number, y: number, levels: number) => {
    if (!cell) {
      return undefined
    }
    // Half here: each sign is in or out by its own lot, and those on the
    // edge of going are motes, shifting cell to cell.
    if (presence < 0.999) {
      if (presence < 0.03) {
        return undefined
      }
      const lot = hash(x * 5 + 1, y * 7 + 3)
      // The band of motes at the edge of what is left narrows to nothing as it goes, and as it comes whole.
      const band = 0.12 * Math.min(1, presence * 5, (1 - presence) * 6)
      if (lot > presence + band) {
        return undefined
      }
      if (lot > presence - band) {
        if (hash(x + live.tick, y * 3 - live.tick) > 0.45) {
          return undefined
        }
        // One colour for every mote, so neighbours share a run.
        return [GREEN[2]!, hash(x, y + live.tick) < 0.5 ? '·' : '∴'] as const
      }
    }
    // In patches, not cell by cell: a colour a cell would be a run a cell.
    const isScorched = scorch > 0.02 && hash(Math.floor(x / 5), y) < scorch
    // While it works its gem burns arcane green, as its flame does, and a few
    // arcane sparks run over its crown; never over the skull.
    const isArcane =
      arcane > 0.02 && ((cell.layer === GEM && arcane > 0.5) || (cell.layer === CROWN && hash(x * 3 + kindle, y * 5 - kindle) < arcane * (0.02 + 0.1 * cell.v)))
    // The robe wears the mood's colour.
    const robe = cell.layer === MANTLE ? robeRamp : undefined
    const v = cell.v
    const ramp = isScorched ? RED : isArcane ? GREEN : robe ?? (cell.layer === FIRE && hash(y, Math.floor(x / 3)) < witch ? COLD : EMBER[cell.layer]!)
    // Lifted: a sign in the dark wants to be seen.
    const colour = pick(ramp, 0.2 + 0.85 * Math.pow(v, 0.7), levels)
    // Scorched signs glitch: any glyph at all, for a moment.
    const glyph = isScorched && cell.layer === BONE ? glyphFor(BONE, hash(x, live.tick), x, y, live.glyphT) : (cell.glyph ?? glyphFor(cell.layer, 0.15 + 0.9 * v, x, y, live.glyphT))
    return [colour, glyph] as const
  }
  // In the band, the Lich's grimoire lies open.
  if (view === 'band') {
    const at = grimoireGlyphs({ flip: live.flip, pages: live.pages, heat: live.heat, alarm: live.alarm, t: live.t }, props.cols, props.rows)
    return drawGlyphs({ Box, Text }, props.cols, count, (x, sy, levels) => at(x, sy + first, levels))
  }

  const model = buildModel(poseOf(live, W, H), framing(view, W, H).cam)
  // Each cell sampled once a frame, at two heights: a glyph is tall.
  const cells = new Map<number, Sampled | null>()
  const cellAt = (x: number, y: number): Sampled | null => {
    const key = y * props.cols + x
    const known = cells.get(key)
    if (known === undefined) {
      let cell: Sampled | null = null
      let sum = 0
      let hits = 0
      for (const f of [0.3, 0.7]) {
        const hit = sampleModel(model, (x + 0.5) * CW, (y + f) * CH)
        if (hit) {
          hits += 1
          sum += hit.cell[1]
          const before = cell as Sampled | null
          if (!before || hit.glyph) {
            cell = { layer: hit.cell[0], v: 0, glyph: hit.glyph ?? before?.glyph }
          }
        }
      }
      if (cell) {
        // Edges, half in and half out, draw lighter signs.
        cell.v = (sum / Math.max(1, hits)) * (0.7 + 0.15 * hits)
      }
      cells.set(key, cell)
      return cell
    }
    return known
  }
  // Runes and the crown's gem are a glyph a cell, where their centre falls;
  // one behind the head is hidden by it.
  const singles = new Map<number, { glyph: string; layer: number; v: number }>()
  for (const sp of model.sparks) {
    if (!sp.glyph) {
      continue
    }
    const x = Math.floor(sp.x / CW)
    const y = Math.floor(sp.y / CH)
    if (x < 0 || x >= props.cols || y < first || y >= first + count) {
      continue
    }
    if (sp.z > model.pose.pos[2] && cellAt(x, y)) {
      continue
    }
    singles.set(y * props.cols + x, { glyph: sp.glyph, layer: sp.layer, v: sp.v })
  }
  return drawGlyphs({ Box, Text }, props.cols, count, (x, sy, levels) => {
    const y = sy + first
    return paint(singles.get(y * props.cols + x) ?? cellAt(x, y), x, y, levels)
  })
}

export default LichLive
