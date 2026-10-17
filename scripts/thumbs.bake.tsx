// The thumbnail bake, run by scripts/bake-thumbs.mjs (never by the suite):
// each live Engram's real drawing, run for a while with a fixed seed, then
// one frame of it captured at full detail and printed as a still SVG. The
// script copies this file into hooks/ for one run, rewriting its imports.

import { describe, expect, test } from 'claude-code/testing'
import type { ClientModule } from 'claude-code'

import KrakenLive from '../../hooks/kraken-live'
import LichLive from '../../hooks/lich-live'
import WispLive from '../../hooks/wisp-live'
import { renderScene } from '../../hooks/field'
import { krakenWaterScene } from '../../hooks/kraken'
import { voidScene } from '../../hooks/lich'
import { fenScene } from '../../hooks/wisp'
import { captureGlyphs } from '../../hooks/live-glyphs'
import { capturePixels } from '../../hooks/live-pixels'
import { SVG_LIMIT, cellsFor, glyphsSvg, pixelsSvg, stillSvg } from '../../hooks/thumb'

/**
 * The moment the backdrops are drawn at. The Lich runs on a fixed seed; the
 * Kraken's arms on Math.random, which the runner will not let a test replace,
 * so a bake of it differs a little from the last.
 */
const NOW = 1_760_000_000_000

type Shot = {
  file: string
  module: ClientModule<any, any>
  props: Record<string, unknown>
  /** The ticks to look through, every `every`: the frame chosen is the best composed of them. */
  from: number
  to: number
  every: number
  backdrop: (W: number, H: number) => string
  width: number
  height: number
  /** The glyphs' size and weight, for a glyph drawing: larger and bolder reads better small. */
  glyphs?: { size: number; weight: number }
  /** How far down the drawing is moved in the still, in px, for one that crowds the top. */
  drop?: number
  /** What the drawing holds outside its pixels, as SVG over them, from its state then. */
  extra?: (state: unknown, cols: number, rows: number) => string
  /** Only frames where this holds are looked at: a moment the still must show. */
  want?: (state: unknown) => boolean
}

/** Where the drawing's ink lies in a frame: its bounds and centre, in cells across and pixel rows down. */
type Ink = { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number; n: number }

function inkOf(cols: number, rows: number, at: (x: number, y: number) => boolean): Ink {
  const ink = { minX: Infinity, maxX: -1, minY: Infinity, maxY: -1, cx: 0, cy: 0, n: 0 }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (at(x, y)) {
        ink.minX = Math.min(ink.minX, x)
        ink.maxX = Math.max(ink.maxX, x)
        ink.minY = Math.min(ink.minY, y)
        ink.maxY = Math.max(ink.maxY, y)
        ink.cx += x
        ink.cy += y
        ink.n += 1
      }
    }
  }
  return ink.n ? { ...ink, cx: ink.cx / ink.n / cols, cy: ink.cy / ink.n / rows } : ink
}

/**
 * How well a frame is composed: wholly in view first, then near the middle,
 * then as large as it gets. A frame cut by an edge scores below any that is not.
 */
function score(ink: Ink, cols: number, rows: number): number {
  if (!ink.n) {
    return -Infinity
  }
  const cut = ink.minX <= 0 || ink.maxX >= cols - 1 || ink.minY <= 0 || ink.maxY >= rows - 1
  const off = Math.hypot(ink.cx - 0.5, ink.cy - 0.5)
  const size = ink.n / (cols * rows)
  return (cut ? -10 : 0) - off * 4 + size
}

/**
 * The drawing run on a stand-in surface, every `every` ticks from `from` to
 * `to` drawn with the capture set (what it would draw, before any budget),
 * and the best composed of those frames kept.
 */
function capture(shot: Shot): { svg: string; tick: number } {
  const { cols, rows } = cellsFor(shot.width, shot.height)
  const W = cols * 8
  const H = rows * 19
  const props = { ...shot.props, cols, rows }
  let state: unknown
  const timers: Array<() => void> = []
  const surface = {
    elements: { Box: 'Box', Text: 'Text', Button: 'Button', Input: 'Input', Select: 'Select', Link: 'Link', Code: 'Code', Markdown: 'Markdown' },
    get state() {
      return state
    },
    setState: (next: unknown) => {
      state = next
    },
    columns: cols,
    rows,
    every: (_ms: number, fn: () => void) => {
      timers.push(fn)
      return () => undefined
    },
    onPointer: () => () => undefined,
    onKey: () => () => undefined,
    post: () => undefined,
  }
  let best = { score: -Infinity, drawing: '', tick: 0 }
  let tick = 0
  try {
    shot.module(props, surface as never)
    capturePixels.to = (c, r, colour) => {
      const s = score(inkOf(c, r * 2, (x, y) => !!colour(x, y, 8)), c, r * 2)
      if (s > best.score) {
        best = { score: s, drawing: pixelsSvg(c, r, colour) + (shot.extra?.(state, c, r) ?? ''), tick }
      }
    }
    captureGlyphs.to = (c, r, glyphAt) => {
      const s = score(inkOf(c, r, (x, y) => !!glyphAt(x, y, 6)), c, r)
      if (s > best.score) {
        best = { score: s, drawing: glyphsSvg(c, r, glyphAt, shot.glyphs), tick }
      }
    }
    for (tick = 1; tick <= shot.to; tick += 1) {
      timers.forEach(fn => fn())
      if (tick >= shot.from && (tick - shot.from) % shot.every === 0 && (!shot.want || shot.want(state))) {
        shot.module(props, surface as never)
      }
    }
  } finally {
    capturePixels.to = undefined
    captureGlyphs.to = undefined
  }
  return { svg: stillSvg(shot.backdrop(W, H), best.drawing, W, H, shot.drop), tick: best.tick }
}

/**
 * A backdrop drawn at the size the still is shown at, then stretched over
 * the whole frame: finer would be lost in the thumbnail and cost the bound.
 */
function backdropAt(draw: (w: number, h: number) => string, shown: number): (W: number, H: number) => string {
  return (W, H) => {
    const k = shown / W
    const w = Math.round(W * k)
    const h = Math.round(H * k)
    return draw(w, h).replace(/^(<svg[^>]*?) width="[\d.]+" height="[\d.]+"/, `$1 width="${W}" height="${H}"`)
  }
}

const SHOTS: Shot[] = [
  {
    // At work, its ghost fire teal, out over the water.
    file: 'vessels/wisp/thumb-band.svg',
    module: WispLive,
    props: { mood: 'working', ink: 0 },
    from: 40,
    to: 260,
    every: 10,
    width: 720,
    height: 171,
    // The fen's boardwalk and water sit on the live grid, so it is drawn full size.
    backdrop: (W, H) => renderScene(fenScene(W, H, Math.round(W / 8), Math.round(H / 19)), NOW),
  },
  {
    file: 'vessels/kraken/thumb-pane.svg',
    module: KrakenLive,
    props: { mood: 'idle', view: 'pane', ink: 0 },
    from: 20,
    to: 900,
    every: 10,
    width: 960,
    height: 720,
    backdrop: backdropAt((w, h) => renderScene(krakenWaterScene(w, h), NOW), 320),
  },
  {
    file: 'vessels/kraken/thumb-band.svg',
    module: KrakenLive,
    props: { mood: 'idle', view: 'band', ink: 0 },
    from: 20,
    to: 900,
    every: 10,
    width: 1200,
    height: 304,
    backdrop: backdropAt((w, h) => renderScene(krakenWaterScene(w, h), NOW), 400),
  },
  {
    file: 'vessels/lich/thumb-pane.svg',
    module: LichLive,
    props: { mood: 'idle', view: 'pane', ink: 0 },
    from: 20,
    to: 300,
    every: 10,
    // Smaller than the Kraken's: a glyph shown a quarter size is dust.
    width: 480,
    height: 360,
    glyphs: { size: 16, weight: 700 },
    // A bust: its crown clear of the top, its robe running off the bottom.
    drop: 24,
    backdrop: backdropAt((w, h) => renderScene(voidScene(w, h, 'pane'), NOW), 320),
  },
  {
    file: 'vessels/lich/thumb-band.svg',
    module: LichLive,
    props: { mood: 'idle', view: 'band', ink: 0 },
    from: 20,
    to: 300,
    every: 10,
    width: 720,
    height: 190,
    glyphs: { size: 16, weight: 700 },
    backdrop: backdropAt((w, h) => renderScene(voidScene(w, h, 'band'), NOW), 400),
  },
]

/** Printed in parts a line each, so no line is too long for the reader. */
const PART = 4000

describe('bake', () => {
  for (const shot of SHOTS) {
    test(shot.file, { timeoutMs: 120_000 }, () => {
      const { svg, tick } = capture(shot)
      expect(svg.length).toBeLessThan(SVG_LIMIT)
      console.log(`THUMB-TICK ${shot.file} ${tick}`)
      const n = Math.ceil(svg.length / PART)
      for (let i = 0; i < n; i += 1) {
        console.log('THUMB ' + JSON.stringify({ file: shot.file, i, n, part: svg.slice(i * PART, (i + 1) * PART) }))
      }
    })
  }
})
