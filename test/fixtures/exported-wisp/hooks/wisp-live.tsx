// The Wisp, live, in its fen: a small spirit flying free over black water.
// Drawn in pixels (8 × 9.5 px) over the fen (wisp.ts), which it shares a
// grid with.
//
// It goes where it likes: off one side of the band and back from the other,
// down under the water and up again, ripples spreading where it breaks the
// surface. It and its glow take its mood's colour, a ghost fire flickering at
// its edge, and the water glows with it from below: white at rest, teal-green at
// work, yellow when it needs you, red when something fails (and it gutters,
// smoking, and sinks).
// Work finished, it circles up bright while fireflies rise from the reeds.
// Now and then, whatever its mood, a star falls across the sky, and a drop
// or a rising fish sets a ring spreading on the water.

import type { ClientModule } from 'claude-code'

import type { Mood } from './eidola-types'
import { drawPixels, mixHex, short } from './live-pixels'
import type { Steady } from './live-pixels'
import { fenLayout } from './wisp'

type Props = { mood: Mood; cols: number; rows: number; ink?: number }

type Mote = { x: number; y: number; vx: number; vy: number; life: number; seed: number }
/** A ring on the water: where, how far it has spread, how far it goes before it is gone. */
type Ripple = { x: number; age: number; max: number }
/** A falling star: where its head is, how it moves, ticks left. */
type Meteor = { x: number; y: number; vx: number; vy: number; life: number }
/** What it is doing: drifting somewhere, dipping under, leaving by a side to come back by the other, or swooping. */
type Plan = 'drift' | 'dip' | 'leave' | 'swoop'

type Live = {
  mood: Mood
  tick: number
  seed: number
  /** Where it is and how it moves, in pixels; where it is headed, and why. */
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  plan: Plan
  planUntil: number
  /** Which way it looks: -1 left, 0 at you, 1 right. */
  look: number
  /** Its glow's colour, eased: how far toward work's teal, attention's green, failure's red. */
  work: number
  heed: number
  ash: number
  /** Ticks left guttering after something failed; the ink it has seen. */
  gutter: number
  inkSeen: number
  /** Ticks left celebrating work finished. */
  cheer: number
  motes: Mote[]
  meteor: Meteor | null
  ripples: Ripple[]
  wasUnder: boolean
  steady: Steady
}
type State = { live: Live }

const TICK_MS = 100

/** The spirit, 7 × 8 pixels: o outline, b body, h highlight, e eye. Its tail flickers between two shapes. */
const BODY = ['..ooo..', '.ohhbo.', 'ohbbbbo', 'obbbbbo', 'obbbbbo', 'obbbbbo']
const TAILS = [
  ['.obobo.', '..o.o..'],
  ['.obobo.', '.o...o.'],
]

/** A mood's look: the spirit's colours and its glow, outermost first. The whole of it takes the mood. */
type Look = { o: string; b: string; h: string; e: string; glow: string[] }
const WHITE: Look = { o: '#4a4a6a', b: '#e8e8f6', h: '#ffffff', e: '#1a1c2b', glow: ['#34344c', '#5c5c7a', '#9c9cb8', '#e0e0f2'] }
const TEAL: Look = { o: '#1a5a48', b: '#a8f5d8', h: '#ebfff6', e: '#0c2420', glow: ['#0c2a24', '#12463a', '#1c6a56', '#2aa884'] }
const YELLOW: Look = { o: '#7a6414', b: '#fff0a0', h: '#fffbe0', e: '#2a2208', glow: ['#2a2614', '#4a4218', '#7a6a20', '#b8a02a'] }
const RED: Look = { o: '#6a1a24', b: '#ffb0b8', h: '#ffe8ea', e: '#2a0a0e', glow: ['#2a0f14', '#4a161e', '#7a1e2a', '#b82a3c'] }

/** One look part way to another, every colour of it. */
function mixLook(a: Look, b: Look, k: number): Look {
  if (k <= 0.001) {
    return a
  }
  const m = (x: string, y: string) => mixHex(x, y, Math.min(1, k))
  return { o: m(a.o, b.o), b: m(a.b, b.b), h: m(a.h, b.h), e: m(a.e, b.e), glow: a.glow.map((g, i) => m(g, b.glow[i]!)) }
}


/** The water's dark, which what lies in it is mixed into; and the water's own blue, for what is under it. */
const POOL = '#0a0818'
const DEEP = '#16284a'
const SMOKE = short('#3a3650')
const RIPPLE = '#8f86d0'
const FLY = ['#a39340', '#ffe680'].map(short)
/** A falling star's head, then its tail, fading. */
const METEOR = ['#ffffff', '#d8d8f4', '#9a9ac4', '#5c5c8a', '#36365a'].map(short)

/** #rgb as #rrggbb, for mixing. */
const long = (c: string) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c)

/** The drawing's own sequence in [0, 1): it decides the same way every run from the same start. */
function random(live: Live): number {
  live.seed = (live.seed + 0x6d2b79f5) >>> 0
  let t = live.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ── The spirit ────────────────────────────────────────────────────────

const WispLive: ClientModule<Props, State> = (props, surface) => {
  const { Box } = surface.elements
  const { water, deck, height } = fenLayout(props.cols, props.rows)

  let state = surface.state
  if (!state) {
    const live: Live = {
      mood: props.mood,
      tick: 0,
      seed: 20261016,
      x: props.cols * 0.35,
      y: water - 6,
      vx: 0,
      vy: 0,
      tx: props.cols * 0.35,
      ty: water - 6,
      plan: 'drift',
      planUntil: 0,
      look: 1,
      work: props.mood === 'working' ? 1 : 0,
      heed: props.mood === 'attention' ? 1 : 0,
      ash: 0,
      gutter: 0,
      inkSeen: props.ink ?? 0,
      cheer: 0,
      motes: [],
      meteor: null,
      ripples: [],
      wasUnder: false,
      steady: { step: 0, calm: 0 },
    }
    state = { live }
    surface.every(TICK_MS, () => {
      step(live, props.cols, water, height)
      surface.setState({ live })
    })
    surface.setState(state)
  }
  const live = state.live

  // Work finished: it circles up bright, and fireflies rise from the reeds.
  if (props.mood !== live.mood) {
    if (live.mood === 'working' && props.mood === 'idle') {
      live.cheer = 50
      for (let i = 0; i < 24; i += 1) {
        live.motes.push({
          x: random(live) * props.cols,
          y: water - random(live) * 2,
          vx: (random(live) - 0.5) * 0.3,
          vy: -0.05 - random(live) * 0.1,
          life: 60 + Math.floor(random(live) * 50),
          seed: i,
        })
      }
    }
    live.mood = props.mood
    live.planUntil = 0
  }
  // Something failed: its glow goes red, it gutters, smoking, and sinks under for a while.
  if ((props.ink ?? 0) > live.inkSeen) {
    live.inkSeen = props.ink ?? 0
    live.gutter = 60
    live.cheer = 0
  }

  const look = mixLook(mixLook(mixLook(WHITE, TEAL, live.work), YELLOW, live.heed), RED, live.ash)
  const body: Record<string, string> = { o: short(look.o), b: short(look.b), h: short(look.h), e: short(look.e) }
  const glow = look.glow.map(short)
  const wx = Math.round(live.x)
  const wy = Math.round(live.y)
  const tail = TAILS[Math.floor(live.tick / 3) % 2]!
  const pulse = 0.5 + 0.5 * Math.sin(live.tick * 0.8)
  // Its glow: small at rest, wider at work, pulsing hard when it needs you,
  // widest celebrating, a stub guttering.
  // A close glow: a ring or two round it, wider only when it needs you.
  let reach = 3.6 + live.work * 0.4 + live.heed * (0.5 + pulse * 1.2)
  if (live.cheer > 0) {
    reach = 4.8 + pulse * 0.8
  }
  if (live.gutter > 0) {
    reach = 2 + (live.tick % 5 < 2 ? 0 : 1)
  }
  // Its eyes: turned the way it goes, or straight at you when it needs you.
  const facing = live.mood === 'attention' ? 0 : live.look
  const eyes = facing < 0 ? [1, 3] : facing > 0 ? [3, 5] : [2, 4]

  /** The spirit itself at a pixel, wherever it is: above the water or under it. */
  const spirit = (x: number, py: number): string => {
    const sx = x - (wx - 3)
    const sy = py - (wy - 4)
    if (sx < 0 || sx >= 7 || sy < 0 || sy >= 8) {
      return ''
    }
    const row = sy < 6 ? BODY[sy]! : tail[sy - 6]!
    let ch = row[sx]!
    if (sy === 3 && eyes.includes(sx)) {
      ch = 'e'
    }
    return ch === '.' ? '' : body[ch]!
  }

  /**
   * A glow's shade at distance `d` of `reach`: its outermost ring dithered,
   * the dither shifting tick to tick, so its edge flickers like ghost fire.
   */
  const glowAt = (ramp: string[], d: number, r: number, x: number, py: number): string => {
    const i = Math.min(ramp.length - 1, Math.floor((1 - d / r) * ramp.length * 0.999))
    return i === 0 && (x + py + (live.tick >> 1)) % 2 ? '' : ramp[i]!
  }

  /** The falling star at a pixel: its head, and its tail back along its path, dimming as it burns out. */
  const meteorAt = (x: number, py: number): string => {
    const m = live.meteor
    if (!m) {
      return ''
    }
    const dim = m.life < 4 ? 4 - m.life : 0
    for (let k = 0; k < METEOR.length - dim; k += 1) {
      if (Math.round(m.x - m.vx * k * 0.7) === x && Math.round(m.y - m.vy * k * 0.7) === py) {
        return METEOR[Math.min(METEOR.length - 1, k + dim)]!
      }
    }
    return ''
  }

  /** What is above the water at a pixel: the drawing without its reflection. */
  const above = (x: number, py: number): string => {
    const star = meteorAt(x, py)
    if (star) {
      return star
    }
    for (const m of live.motes) {
      if (Math.round(m.x) === x && Math.round(m.y) === py) {
        return FLY[(m.seed + live.tick) % 4 === 0 ? 0 : 1]!
      }
    }
    const body = spirit(x, py)
    if (body) {
      return body
    }
    const d = Math.hypot((x - wx) * 0.85, py - (wy - 1))
    if (wy < water && d < reach) {
      const g = glowAt(glow, d, reach, x, py)
      if (g) {
        return g
      }
    }
    // Smoke off a guttering wisp: a wavering column rising off its crown.
    if (live.gutter > 0 && py < wy - 4 && py >= wy - 4 - Math.min(7, live.gutter / 6)) {
      if (x === wx + Math.round(Math.sin(py * 0.9 + live.tick * 0.4))) {
        return SMOKE
      }
    }
    return ''
  }

  // The light it throws into the water from above, or carries down with it:
  // brightest just under the surface, wider the closer it flies.
  const near = Math.max(0, 1 - Math.abs(live.y - water) / 9)
  const underReach = 2 + near * 4.5 + live.heed * pulse * 1.2
  const underGlow = glow.map(g => short(mixHex(long(g), POOL, 0.6)))

  const pixels = drawPixels(
    Box,
    props.cols,
    props.rows,
    (x, py) => {
      if (py < water) {
        // The boardwalk's row is the fen's, unless the spirit crosses it.
        return py === deck && !spirit(x, py) ? '' : above(x, py)
      }
      const depth = py - water
      const ripple = Math.round(Math.sin(py * 1.9 + live.tick * 0.35))
      // Under the water: itself, wavering and blue-dark.
      const sunk = spirit(x + ripple, py)
      if (sunk) {
        return short(mixHex(long(sunk), DEEP, 0.35 + depth * 0.08))
      }
      // Rings where it broke the surface, spreading and fading.
      if (depth === 0) {
        for (const r of live.ripples) {
          // A drop's first moment: a fleck where it fell.
          if (r.age < 1 && x === r.x) {
            return short(RIPPLE)
          }
          if (Math.abs(Math.abs(x - r.x) - r.age) < 0.5) {
            return short(mixHex(RIPPLE, POOL, Math.min(0.9, 0.3 + (r.age / r.max) * 0.6)))
          }
        }
      }
      // The water mirrors what is over it, broken by ripples and darkened.
      const mirrored = 2 * water - 1 - py
      const seen = mirrored >= 0 && mirrored < deck ? above(x + ripple, mirrored) : ''
      if (seen) {
        return short(mixHex(long(seen), POOL, 0.45 + depth * 0.1))
      }
      // Its glow from under the surface.
      const d = Math.hypot((x - wx) * 0.55, (py - Math.max(water + 1, wy)) * 1.6)
      if (d < underReach) {
        return glowAt(underGlow, d, underReach, x, py)
      }
      return ''
    },
    undefined,
    live.steady,
  )
  return pixels
}

/** A new plan for its mood: where to go next, and for how long at most. */
function plan(live: Live, cols: number, water: number): void {
  const r = random(live)
  const working = live.mood === 'working'
  if (r < (working ? 0.12 : 0.15)) {
    // Off one side, to come back by the other.
    live.plan = 'leave'
    live.tx = live.x < cols / 2 ? -9 : cols + 9
    live.ty = 3 + random(live) * (water - 6)
  } else if (r < (working ? 0.45 : 0.4)) {
    // Down under the water, then up again.
    live.plan = 'dip'
    live.tx = Math.max(4, Math.min(cols - 4, live.x + (random(live) - 0.5) * 30))
    live.ty = water + 3 + random(live) * 2
  } else if (working && r < 0.8) {
    // A quick swoop across the band.
    live.plan = 'swoop'
    live.tx = random(live) * cols
    live.ty = 3 + random(live) * (water - 5)
  } else {
    live.plan = 'drift'
    live.tx = 6 + random(live) * (cols - 12)
    live.ty = 3 + random(live) * (water - 6)
  }
  live.planUntil = live.tick + (working ? 30 : 70) + Math.floor(random(live) * (working ? 30 : 60))
}

/** One tick: where it heads, how it moves, its colour, the motes and ripples. */
function step(live: Live, cols: number, water: number, height: number): void {
  live.tick += 1
  live.gutter = Math.max(0, live.gutter - 1)
  live.cheer = Math.max(0, live.cheer - 1)

  // Its colour eases toward its mood's, over a second or two.
  const ease = (v: number, to: number) => v + (to - v) * 0.08
  live.work = ease(live.work, live.mood === 'working' ? 1 : 0)
  live.heed = ease(live.heed, live.mood === 'attention' ? 1 : 0)
  live.ash = ease(live.ash, live.gutter > 0 ? 1 : 0)

  if (live.gutter > 20) {
    // Guttering: it sinks under and stays there a while.
    live.tx = live.x
    live.ty = water + 3
  } else if (live.mood === 'attention') {
    // Up front and centre, facing you, bobbing to be seen.
    live.tx = cols / 2
    live.ty = 6 + (Math.sin(live.tick * 0.9) > 0 ? 0 : 1.5)
  } else if (live.cheer > 0) {
    // Work finished: a bright circle in the middle of the band.
    const a = live.tick * 0.25
    live.tx = cols / 2 + Math.cos(a) * 10
    live.ty = 6 + Math.sin(a) * 2.5
  } else {
    const there = Math.abs(live.x - live.tx) < 1.5 && Math.abs(live.y - live.ty) < 1.5
    if (live.plan === 'leave' && (live.x < -6 || live.x > cols + 6)) {
      // Gone off one side: it comes back by the other.
      live.x = live.x < 0 ? cols + 6 : -6
      live.vx = 0
      plan(live, cols, water)
      if (live.plan === 'leave') {
        live.plan = 'drift'
        live.tx = 6 + random(live) * (cols - 12)
      }
    } else if (live.plan === 'dip' && there) {
      // Under: now up again.
      live.plan = 'drift'
      live.tx = live.x + (random(live) - 0.5) * 16
      live.ty = 3 + random(live) * (water - 7)
    } else if (there || live.tick >= live.planUntil) {
      plan(live, cols, water)
    }
  }

  // Eased toward its target, bobbing; quicker at work, needing you or celebrating. The water slows it.
  const pull = live.mood === 'working' || live.cheer > 0 || live.mood === 'attention' ? 0.03 : 0.014
  const drag = live.y > water ? 0.8 : 0.86
  live.vx = (live.vx + (live.tx - live.x) * pull) * drag
  live.vy = (live.vy + (live.ty - live.y) * pull) * drag
  live.x += live.vx
  live.y = Math.max(1, Math.min(height + 2, live.y + live.vy + Math.sin(live.tick * 0.18) * 0.12))
  if (Math.abs(live.vx) > 0.05) {
    live.look = Math.sign(live.vx)
  }

  // Breaking the surface, either way: a ring spreads from where it did.
  const isUnder = live.y - 1 > water
  if (isUnder !== live.wasUnder) {
    live.ripples.push({ x: Math.round(live.x), age: 0, max: 9 })
    live.wasUnder = isUnder
  }
  // Now and then a drop, or a fish rising: a smaller ring, somewhere on the water.
  if (random(live) < 0.012) {
    live.ripples.push({ x: Math.round(4 + random(live) * (cols - 8)), age: 0, max: 4 + random(live) * 3 })
  }
  live.ripples = live.ripples.filter(r => (r.age += 0.35) < r.max)

  // Rarely, a star falls across the sky, high over the trees.
  if (live.meteor) {
    const m = live.meteor
    m.x += m.vx
    m.y += m.vy
    m.life -= 1
    if (m.life <= 0 || m.y > water - 6 || m.x < -6 || m.x > cols + 6) {
      live.meteor = null
    }
  } else if (live.tick > 40 && random(live) < 1 / 350) {
    const dir = random(live) < 0.5 ? -1 : 1
    live.meteor = { x: 8 + random(live) * (cols - 16), y: 1 + random(live) * 3, vx: dir * (1.4 + random(live) * 0.8), vy: 0.4 + random(live) * 0.25, life: 12 + Math.floor(random(live) * 8) }
  }

  live.motes = live.motes.filter(m => {
    m.x += m.vx + Math.sin((live.tick + m.seed * 7) * 0.3) * 0.15
    m.y += m.vy
    m.life -= 1
    return m.life > 0 && m.y > 0
  })
}

export default WispLive
