// The Lich's grimoire in three dimensions, for the band: an open book seen
// from a little above, in perspective, lit as the Lich is and drawn in
// glyphs. Two boards of red leather and a gilt spine between them; a thick
// block of pages on each board, their tops curving down into the gutter,
// their stacked edges toward the glass; faint signs written on the pages.
// While the Lich works a page lifts from the right, curls over the spine and
// settles on the left; when it needs you its ink glows.
//
// Book space: u across (the spine at 0, + to our right), h up, v away from
// the glass. Every solid is a cross-section in (u, h) carried straight back
// through v, so a line of sight meets it on its front face or on a side.

import { clamp01, hash, smoothstep } from './field'
import { COLOURS, CROWN, MANTLE } from './lich'
import type { GlyphAt } from './live-glyphs'
import { mixHex, pick, short } from './live-pixels'

type V2 = readonly [number, number]
type V3 = readonly [number, number, number]

/** What the book shows: a page turning (0 to 1, or -1 for none), how many have turned, the ink's mood, and the time (s). */
export type Book = { flip: number; pages: number; heat: number; alarm: number; t: number }

// Materials.
const LEATHER = 1
const PARCH = 2
const EDGE = 3
const GILT = 4

/** Half the pages' depth, front to back; the boards stand a little proud of them. */
const PAGE_D = 0.48
const BOARD_D = 0.53
const BOARD_H = 0.045
const GUTTER = 0.015
/** A page's width, spine to fore-edge. */
const SHEET = 0.97
/** How much of its height a turning page keeps: it bows over, low. */
const LOW = 0.45

/** How high the pages stand at a distance from the spine (0 to 1): low in the gutter, swelling, rounding down to the fore-edge. */
export function pageTop(a: number): number {
  return BOARD_H + 0.035 + 0.15 * (1 - Math.exp(-a * 7)) * (1 - 0.6 * Math.pow(a, 1.5))
}

/** An edge of a cross-section: what it is made of, seen from that side. */
type Side = 'top' | 'leather' | 'edge' | 'gilt' | 'hidden'
type Solid = { poly: V2[]; sides: Side[]; v0: number; v1: number; cap: 'edge' | 'leather' | 'spine'; box: [number, number, number, number] }

function solid(poly: V2[], sides: Side[], v0: number, v1: number, cap: Solid['cap']): Solid {
  const us = poly.map(p => p[0])
  const hs = poly.map(p => p[1])
  return { poly, sides, v0, v1, cap, box: [Math.min(...us), Math.min(...hs), Math.max(...us), Math.max(...hs)] }
}

/** A cross-section mirrored to the other side of the spine, kept counter-clockwise. */
function mirror(s: Solid): Solid {
  const n = s.poly.length
  const poly = s.poly.map(([u, h]) => [-u, h] as V2).reverse()
  // Edge i ran from point i to i + 1; reversed, it runs from n - 2 - i to n - 1 - i.
  const sides = s.poly.map((_, i) => s.sides[(n - 2 - i + n) % n]!)
  return solid(poly, sides, s.v0, s.v1, s.cap)
}

const PROFILE = 36

/** The pages on the right: along the board, up the fore-edge, back over the top to the gutter. */
function pageBlock(): Solid {
  const poly: V2[] = [
    [GUTTER, BOARD_H],
    [1, BOARD_H],
  ]
  const sides: Side[] = ['hidden', 'edge']
  for (let i = PROFILE; i >= 0; i -= 1) {
    const a = GUTTER + ((1 - GUTTER) * i) / PROFILE
    poly.push([a, pageTop(a)])
    sides.push(i ? 'top' : 'hidden')
  }
  return solid(poly, sides, -PAGE_D, PAGE_D, 'edge')
}

function board(): Solid {
  return solid(
    [
      [0.05, 0],
      [1.07, 0],
      [1.07, BOARD_H],
      [0.05, BOARD_H],
    ],
    ['hidden', 'leather', 'leather', 'hidden'],
    -BOARD_D,
    BOARD_D,
    'leather',
  )
}

/** The spine: rounded beneath the gutter, filling the gap between the boards. */
function spine(): Solid {
  const r = 0.05
  const poly: V2[] = []
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI + (Math.PI * i) / 12
    poly.push([r * Math.cos(a), BOARD_H + r * Math.sin(a)])
  }
  poly.push([0.03, pageTop(0) - 0.01], [-0.03, pageTop(0) - 0.01])
  // Seen only at its front, a small gilt headband; its top, down in the gutter, is hidden by the pages.
  return solid(
    poly,
    poly.map((_, i) => (i < 12 ? 'leather' : 'hidden')),
    -BOARD_D,
    BOARD_D,
    'spine',
  )
}

const RIGHT = pageBlock()
const SOLIDS: Solid[] = [RIGHT, mirror(RIGHT), board(), mirror(board()), spine()]

/** Where a line of sight meets the book. */
type Hit = { t: number; mat: number; n: V3; u: number; h: number; v: number; page?: number; a?: number; isShaded?: boolean; isLifted?: boolean }

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

function inside(poly: V2[], u: number, h: number): boolean {
  let isIn = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [ui, hi] = poly[i]!
    const [uj, hj] = poly[j]!
    if (hi > h !== hj > h && u < ((uj - ui) * (h - hi)) / (hj - hi) + ui) {
      isIn = !isIn
    }
  }
  return isIn
}

/** Where a line in (u, h) meets the segment a→b: its t along the line, or -1. */
function cross2(o: V3, d: V3, a: V2, b: V2): number {
  const eu = b[0] - a[0]
  const eh = b[1] - a[1]
  const den = d[0] * eh - d[1] * eu
  if (Math.abs(den) < 1e-12) {
    return -1
  }
  const au = a[0] - o[0]
  const ah = a[1] - o[1]
  const s = (au * d[1] - ah * d[0]) / den
  return s < 0 || s > 1 ? -1 : (au * eh - ah * eu) / den
}

function hitSolid(s: Solid, o: V3, d: V3, best: Hit | undefined): Hit | undefined {
  // Its front face, toward the glass.
  if (d[2] > 1e-9) {
    const t = (s.v0 - o[2]) / d[2]
    if (t > 0 && (!best || t < best.t)) {
      const u = o[0] + d[0] * t
      const h = o[1] + d[1] * t
      if (u >= s.box[0] && u <= s.box[2] && h >= s.box[1] && h <= s.box[3] && inside(s.poly, u, h)) {
        const mat = s.cap === 'edge' ? EDGE : s.cap === 'leather' ? LEATHER : GILT
        best = { t, mat, n: [0, 0, -1], u, h, v: s.v0 }
      }
    }
  }
  // Its sides, as far back as it goes.
  for (let i = 0; i < s.poly.length; i += 1) {
    const side = s.sides[i]!
    if (side === 'hidden') {
      continue
    }
    const a = s.poly[i]!
    const b = s.poly[(i + 1) % s.poly.length]!
    const t = cross2(o, d, a, b)
    if (t <= 0 || (best && t >= best.t)) {
      continue
    }
    const v = o[2] + d[2] * t
    if (v < s.v0 || v > s.v1) {
      continue
    }
    const n = norm([b[1] - a[1], -(b[0] - a[0]), 0])
    if (dot(n, d) > 0) {
      continue
    }
    const u = o[0] + d[0] * t
    const h = o[1] + d[1] * t
    const mat = side === 'top' ? PARCH : side === 'edge' ? EDGE : side === 'gilt' ? GILT : LEATHER
    best = { t, mat, n, u, h, v, a: Math.abs(u) }
  }
  return best
}

/** The page turning: a bent sheet from the spine, its points and their distance along it. */
type Sheet = { pts: V2[]; s: number[] }

/**
 * The sheet `flip` of the way over: its fore-edge lifts first and leads, so
 * the page curls up from the right, rolls over the spine and comes down on
 * the left edge first. Nowhere does it sink into the pages beneath it.
 */
export function sheetAt(flip: number): Sheet {
  const N = 24
  const theta = Math.PI * smoothstep(0, 1, flip)
  const curl = 2.1 * Math.sin(Math.PI * flip)
  const ds = SHEET / N
  let u = 0
  let h = pageTop(0)
  const pts: V2[] = []
  const s: number[] = []
  // A heavy page bows low as it goes over, never standing up straight.
  const rest = (p: number, q: number): V2 => {
    const floor = pageTop(Math.min(1, Math.abs(p)))
    return [p, Math.max(floor + (q - floor) * LOW, Math.abs(p) <= 1 ? floor + 0.006 : -1)]
  }
  pts.push(rest(u, h))
  s.push(0)
  for (let i = 0; i < N; i += 1) {
    const k = (i + 0.5) / N
    const phi = Math.min(Math.PI, theta + curl * Math.pow(k, 1.4))
    u += Math.cos(phi) * ds
    h += Math.sin(phi) * ds
    pts.push(rest(u, h))
    s.push((i + 1) * ds)
  }
  return { pts, s }
}

function hitSheet(sh: Sheet, o: V3, d: V3, best: Hit | undefined, front: number, back: number): Hit | undefined {
  for (let i = 0; i + 1 < sh.pts.length; i += 1) {
    const a = sh.pts[i]!
    const b = sh.pts[i + 1]!
    const t = cross2(o, d, a, b)
    if (t <= 0 || (best && t >= best.t)) {
      continue
    }
    const v = o[2] + d[2] * t
    if (v < -PAGE_D || v > PAGE_D) {
      continue
    }
    // Its upper face, as it lay on the right: which side the viewer sees.
    let n = norm([-(b[1] - a[1]), b[0] - a[0], 0])
    const isBack = dot(n, d) > 0
    if (isBack) {
      n = [-n[0], -n[1], 0]
    }
    const u = o[0] + d[0] * t
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const along = sh.s[i]! + ((sh.s[i + 1]! - sh.s[i]!) * Math.hypot(u - a[0], o[1] + d[1] * t - a[1])) / ab
    best = { t, mat: PARCH, n, u, h: o[1] + d[1] * t, v, page: isBack ? back : front, a: along }
  }
  return best
}

// ── The camera ────────────────────────────────────────────────────────────

/** From the glass, a little above: how steeply it looks down, and how near it stands. */
const ELEVATION = 0.5
const DISTANCE = 3.4
const TARGET: V3 = [0, 0.16, 0.02]

type Cam = { E: V3; F: V3; U: V3; f: number; cx: number; cy: number; box: [number, number, number, number] }

const CW = 8
const CH = 19
const cams = new Map<string, Cam>()

/** The camera for a strip of cells: the book as large as it fits, centred; a turning page may rise out of the top, as the Lich flies out of frame. */
export function cameraFor(cols: number, rows: number): Cam {
  const key = `${cols}x${rows}`
  const known = cams.get(key)
  if (known) {
    return known
  }
  const W = cols * CW
  const H = rows * CH
  const E: V3 = [TARGET[0], TARGET[1] + DISTANCE * Math.sin(ELEVATION), TARGET[2] - DISTANCE * Math.cos(ELEVATION)]
  const F = norm([TARGET[0] - E[0], TARGET[1] - E[1], TARGET[2] - E[2]])
  const U: V3 = [0, F[2], -F[1]]
  const corners: V3[] = []
  for (const u of [-1.08, 1.08]) {
    for (const h of [-0.02, 0.22]) {
      for (const v of [-BOARD_D, BOARD_D]) {
        corners.push([u, h, v])
      }
    }
  }
  const flat = corners.map(p => {
    const q: V3 = [p[0] - E[0], p[1] - E[1], p[2] - E[2]]
    const z = dot(q, F)
    return [q[0] / z, -dot(q, U) / z] as const
  })
  const xs = flat.map(p => p[0])
  const ys = flat.map(p => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const f = Math.min((W * 0.86) / (x1 - x0), (H * 0.92) / (y1 - y0))
  const cx = W / 2 - f * ((x0 + x1) / 2)
  const cy = H / 2 - f * ((y0 + y1) / 2)
  const cam: Cam = { E, F, U, f, cx, cy, box: [cx + f * x0 - CW, -Infinity, cx + f * x1 + CW, cy + f * y1 + CH] }
  cams.set(key, cam)
  return cam
}

function rayAt(cam: Cam, X: number, Y: number): V3 {
  const x = (X - cam.cx) / cam.f
  const y = (Y - cam.cy) / cam.f
  return norm([cam.F[0] + x, cam.F[1] - cam.U[1] * y, cam.F[2] - cam.U[2] * y])
}

// ── What is written ───────────────────────────────────────────────────────

/** What the pages are written in: the Lich's own signs. */
const SIGNS = ['∴', '∵', '+', '×', '☿', '♀', '♂', '♁', ':']

/**
 * The ink at a place on a page (a: from the spine, w: front to back, both 0
 * to 1): how strong, and its sign. Every page is a block of lines of signs,
 * square to its margins, so the writing reads as a page.
 */
function writing(page: number, a: number, w: number): { k: number; glyph: string } | undefined {
  if (a < 0.13 || a > 0.9 || w < 0.1 || w > 0.9) {
    return undefined
  }
  const line = Math.floor(w * 6)
  if (w * 6 - line > 0.6) {
    return undefined
  }
  // Words with gaps between them.
  const col = Math.floor(a / 0.045)
  if (hash(col + line * 53 + page * 7, 3.7) < 0.24) {
    return undefined
  }
  return { k: 0.6 + 0.4 * hash(col, line + page), glyph: SIGNS[Math.floor(hash(col * 5 + page * 31, line * 11 - page) * SIGNS.length)]! }
}

// ── Colour and glyph ──────────────────────────────────────────────────────

// What a cell shows besides the solids' own materials.
const INK = 5

/** The ink by mood: ember at rest, violet at work, emerald when it needs you. */
const INKS = { idle: '#e0603e', working: '#a860f0', attention: '#3ccf8a' }
/** Old parchment in the dark: one colour, a few close shades of it. */
const PARCHMENT = ['#5e4a30', '#6c5638', '#7a6240', '#886e48']
const EDGES = ['#1a160e', '#30291b', '#4a3f2a', '#665839', '#82704a', '#9e885c']

const GLYPHS: Record<number, string[][]> = {
  [LEATHER]: [['∙']],
  [PARCH]: [[':']],
  [EDGE]: [['=']],
  [GILT]: [['∙'], [':'], ['+'], ['×'], ['●']],
}

function glyphOf(mat: number, v: number, x: number, y: number): string {
  const steps = GLYPHS[mat]!
  const set = steps[Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length)))]!
  return set.length === 1 ? set[0]! : set[Math.floor(hash(x, y) * set.length)]!
}

/** From above and in front, a little to the left. */
const LIGHT = norm([-0.7, 0.6, -0.4])

type Seen = { mat: number; v: number; t: number; glyph?: string }

/** How a hit looks: its material lit, or the ink written on it. */
function shade(hit: Hit, glow: number): Seen {
  const lambert = Math.max(0, dot(hit.n, LIGHT))
  let v = (0.1 + 0.85 * lambert) * (hit.isShaded ? 0.35 : 1)
  if (hit.mat === PARCH) {
    const a = hit.a ?? Math.abs(hit.u)
    // Darker down in the gutter, where the light cannot reach.
    v *= 0.3 + 0.7 * smoothstep(0.02, 0.25, a)
    // The turning page catches the light.
    if (hit.isLifted) {
      v = 0.25 + 0.9 * v
    }
    const page = hit.page ?? -1
    const ink = page >= 0 ? writing(page, a, (hit.v + PAGE_D) / (2 * PAGE_D)) : undefined
    if (ink) {
      return { mat: INK, v: clamp01(ink.k * (0.15 + 0.5 * v) + glow * 0.6), t: hit.t, glyph: ink.glyph }
    }
    return { mat: PARCH, v: clamp01(v), t: hit.t }
  }
  if (hit.mat === GILT || (hit.mat === LEATHER && hit.n[2] < -0.5 && Math.abs(hit.u) > 1.0)) {
    return { mat: GILT, v: clamp01(v + 0.15), t: hit.t }
  }
  return { mat: hit.mat, v: clamp01(v), t: hit.t }
}

/** Which page lies open where: left, right (or the one beneath a turning page), and the turning page's two faces. */
function pagesOf(book: Book): { left: number; right: number; front: number; back: number } {
  const n = book.pages * 2
  return { left: n, right: book.flip >= 0 ? n + 3 : n + 1, front: n + 1, back: n + 2 }
}

/** What the viewer sees at a point on the glass, nearest first; and whether the turning page shades it. */
function sampleBook(cam: Cam, sheet: Sheet | undefined, pages: ReturnType<typeof pagesOf>, X: number, Y: number): Hit | undefined {
  const o = cam.E
  const d = rayAt(cam, X, Y)
  let best: Hit | undefined
  for (const s of SOLIDS) {
    best = hitSolid(s, o, d, best)
  }
  if (best && best.mat === PARCH) {
    best.page = best.u < 0 ? pages.left : pages.right
  }
  if (sheet) {
    const under = best
    best = hitSheet(sheet, o, d, best, pages.front, pages.back)
    if (best === under && best) {
      // In the turning page's shadow, or not.
      const p: V3 = [best.u + LIGHT[0] * 0.01, best.h + LIGHT[1] * 0.01, best.v + LIGHT[2] * 0.01]
      best.isShaded = !!hitSheet(sheet, p, LIGHT, undefined, 0, 0)
    } else if (best) {
      best.isLifted = true
    }
  }
  return best
}

/** Priority when a cell's two samples disagree: the thin and bright win. */
const RANK = [0, 1, 2, 4, 3, 5, 6]

/**
 * The book this frame as glyphs: colour and character at column x of row y
 * (of `rows`), from at most `levels` shades. Each cell is looked at twice,
 * high and low, since a glyph is tall.
 */
export function grimoireGlyphs(book: Book, cols: number, rows: number): GlyphAt {
  const cam = cameraFor(cols, rows)
  const sheet = book.flip >= 0 ? sheetAt(book.flip) : undefined
  const pages = pagesOf(book)
  const glow = book.alarm
  const ink = mixHex(mixHex(INKS.idle, INKS.working, book.heat), INKS.attention, book.alarm)
  const inkRamp = ['#000000', '#000000', '#000000', '#000000', ink, '#ffffff', '#ffffff'].map((c, i) => short(mixHex(ink, c, [0.75, 0.6, 0.42, 0.22, 0, 0.3 + 0.3 * glow, 0.6 + 0.2 * glow][i]!)))
  // When it needs you, the glow of the ink lies on the pages.
  const ramps: Record<number, string[]> = {
    [LEATHER]: COLOURS[MANTLE]!.map(short),
    [PARCH]: PARCHMENT.map(c => short(mixHex(c, ink, 0.22 * glow))),
    [EDGE]: EDGES.map(short),
    [GILT]: COLOURS[CROWN]!.map(short),
    [INK]: inkRamp,
  }

  const cells = new Map<number, Seen | null>()
  const seen = (x: number, y: number): Seen | null => {
    const key = y * cols + x
    const known = cells.get(key)
    if (known !== undefined) {
      return known
    }
    let cell: Seen | null = null
    const X = (x + 0.5) * CW
    if (X >= cam.box[0] && X <= cam.box[2] && (y + 1) * CH >= cam.box[1] && y * CH <= cam.box[3]) {
      const looks = [0.3, 0.7].map(f => sampleBook(cam, sheet, pages, X, (y + f) * CH)).map(hit => (hit ? shade(hit, glow) : undefined))
      const [hi, lo] = looks
      const one = hi && lo ? (RANK[lo.mat]! > RANK[hi.mat]! ? lo : hi) : (hi ?? lo)
      if (one) {
        const same = looks.filter((l): l is Seen => !!l && l.mat === one.mat)
        const v = same.reduce((sum, l) => sum + l.v, 0) / same.length
        // Edges, half on the book and half off, are fainter.
        cell = { ...one, v: v * (hi && lo ? 1 : 0.8) }
      }
    }
    cells.set(key, cell)
    return cell
  }

  return (x, y, levels) => {
    const cell = seen(x, y)
    if (!cell) {
      return undefined
    }
    // Lifted: a sign in the dark wants to be seen.
    return [pick(ramps[cell.mat]!, 0.1 + 0.9 * Math.pow(cell.v, 0.8), levels), cell.glyph ?? glyphOf(cell.mat, cell.v, x, y)]
  }
}
