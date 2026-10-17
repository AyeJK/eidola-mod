// The field engine. A scene is a sampler: for a point and a frame it gives
// a layer and a brightness. The engine samples it onto a grid sized to the
// slot, once per frame, and an ink turns the grid into SVG:
//
//   glyph     a character per cell, from a ramp of dim to dense
//   pixel     a block per cell, dithered between a layer's shades
//   particle  a dot per lit cell, sized by brightness
//
// Each layer names its ink, so one scene can mix them: a pixel creature in
// particle water. Frames cycle by CSS, locked to the wall clock, so a
// redraw for a new state carries the motion on unbroken.

export type Ink = 'glyph' | 'pixel' | 'particle'
export const INKS: readonly Ink[] = ['glyph', 'pixel', 'particle']

/** How one layer of a scene looks in each ink. */
export type LayerStyle = {
  /** glyph: characters from dim to dense; a space draws nothing. */
  chars: string
  /** pixel: shades from dim to bright. */
  shades: string[]
  /** glyph and particle: the fill, a colour or a paint server. */
  fill: string
  opacity?: number
  /** Drawn with a soft bloom. */
  isGlowing?: boolean
  /** The ink this layer draws in; the scene's when absent. */
  ink?: Ink
}

/** [layer, brightness]: layer 0 draws nothing; brightness runs 0 to 1. */
export type Cell = readonly [number, number]
export const EMPTY: Cell = [0, 0]

export type FieldScene = {
  width: number
  height: number
  /** Index 0 is the empty layer and is never drawn. */
  layers: LayerStyle[]
  /** The ink of any layer that names none. */
  ink: Ink
  /**
   * A point in pixels, a frame of `frames`: what moves there, or EMPTY.
   * `want` is the layers this pass draws; a scene may skip work for others.
   */
  sample: (x: number, y: number, frame: number, frames: number, want: ReadonlySet<number>) => Cell
  /**
   * What lies still behind it: sampled once and drawn outside the frame
   * cycle, so a backdrop costs one frame however many the scene has. A
   * cell the moving layers reach in any frame is left out of it.
   */
  still?: (x: number, y: number, want: ReadonlySet<number>) => Cell
  /**
   * How the still backdrop moves: a small drift side to side (the default),
   * or a sway from the top edge, as light shafts hang from the surface.
   */
  stillMotion?: 'drift' | 'sway'
  /** Seconds for one pass through the frames. */
  period: number
  /** Markup drawn under the field and over it; defs and CSS the scene needs. */
  under: string
  over: string
  defs: string[]
  css: string[]
}

/** Cell size in pixels and frame count per ink: what the budget allows. */
export const GRID: Record<Ink, { cw: number; ch: number; frames: number }> = {
  glyph: { cw: 8, ch: 14, frames: 8 },
  pixel: { cw: 8, ch: 8, frames: 3 },
  particle: { cw: 9, ch: 9, frames: 3 },
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** A stable value in [0, 1) for a cell: the same every frame and every draw. */
export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Smooth value noise in [0, 1). */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** 4×4 ordered dither thresholds. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(n => (n + 0.5) / 16)

type Sampled = { cols: number; rows: number; layer: Uint8Array[]; value: Float32Array[]; still?: { layer: Uint8Array; value: Float32Array } }

/** The scene sampled on one ink's grid, keeping only the layers drawn in that ink. */
function sampleAll(scene: FieldScene, cw: number, ch: number, frames: number, keep: Set<number>): Sampled {
  const cols = Math.floor(scene.width / cw)
  const rows = Math.floor(scene.height / ch)
  const layer: Uint8Array[] = []
  const value: Float32Array[] = []
  for (let f = 0; f < frames; f += 1) {
    const L = new Uint8Array(cols * rows)
    const V = new Float32Array(cols * rows)
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const [l, v] = scene.sample((x + 0.5) * cw, (y + 0.5) * ch, f, frames, keep)
        if (l > 0 && v > 0 && keep.has(l)) {
          L[y * cols + x] = l
          V[y * cols + x] = clamp01(v)
        }
      }
    }
    layer.push(L)
    value.push(V)
  }
  let still: Sampled['still']
  if (scene.still) {
    const L = new Uint8Array(cols * rows)
    const V = new Float32Array(cols * rows)
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const i = y * cols + x
        if (layer.some(f => f[i] !== 0)) {
          continue
        }
        const [l, v] = scene.still((x + 0.5) * cw, (y + 0.5) * ch, keep)
        if (l > 0 && v > 0 && keep.has(l)) {
          L[i] = l
          V[i] = clamp01(v)
        }
      }
    }
    still = { layer: L, value: V }
  }
  return { cols, rows, layer, value, still }
}

function glyphFrame(scene: FieldScene, s: Grid, cw: number, ch: number): string {
  const out: string[] = []
  scene.layers.forEach((style, l) => {
    if (l === 0) {
      return
    }
    const texts: string[] = []
    for (let y = 0; y < s.rows; y += 1) {
      let line = ''
      let first = -1
      let last = -1
      for (let x = 0; x < s.cols; x += 1) {
        const i = y * s.cols + x
        let c = ' '
        if (s.layer[i] === l) {
          // Lifted and jittered a little, so mid-tones don't band into rows of one character.
          const v = clamp01(Math.pow(s.value[i]!, 0.75) + (hash(x, y) - 0.5) * 0.14)
          c = style.chars[Math.min(style.chars.length - 1, Math.floor(v * style.chars.length))]!
        }
        if (c !== ' ') {
          if (first < 0) {
            first = x
          }
          last = x
        }
        line += c
      }
      if (first >= 0) {
        texts.push(`<text x="${first * cw}" y="${r1(y * ch + ch * 0.78)}" textLength="${(last - first + 1) * cw}">${line.slice(first, last + 1)}</text>`)
      }
    }
    if (texts.length) {
      out.push(layerGroup(style, texts.join(''), style.fill))
    }
  })
  return out.join('')
}

function pixelFrame(scene: FieldScene, s: Grid): string {
  const out: string[] = []
  scene.layers.forEach((style, l) => {
    if (l === 0) {
      return
    }
    const n = style.shades.length
    const runs: string[][] = style.shades.map(() => [])
    for (let y = 0; y < s.rows; y += 1) {
      let runLevel = -1
      let runStart = 0
      const flush = (end: number) => {
        if (runLevel >= 0) {
          const len = end - runStart
          runs[runLevel]!.push(`M${runStart} ${y}h${len}v1h-${len}z`)
        }
      }
      for (let x = 0; x < s.cols; x += 1) {
        const i = y * s.cols + x
        let level = -1
        if (s.layer[i] === l) {
          const at = s.value[i]! * (n - 1)
          const base = Math.floor(at)
          level = Math.min(n - 1, at - base > BAYER[(y % 4) * 4 + (x % 4)]! ? base + 1 : base)
        }
        if (level !== runLevel) {
          flush(x)
          runLevel = level
          runStart = x
        }
      }
      flush(s.cols)
    }
    const paths = runs.map((d, k) => (d.length ? `<path fill="${style.shades[k]}" d="${d.join('')}"/>` : '')).join('')
    if (paths) {
      out.push(layerGroup(style, paths))
    }
  })
  return out.join('')
}

/** One grid's worth: a frame, or the still backdrop. */
type Grid = { cols: number; rows: number; layer: Uint8Array; value: Float32Array }

const DOT_SIZES = [0.32, 0.55, 0.85]

function particleFrame(scene: FieldScene, s: Grid, cw: number, ch: number): string {
  const out: string[] = []
  scene.layers.forEach((style, l) => {
    if (l === 0) {
      return
    }
    const buckets: string[][] = DOT_SIZES.map(() => [])
    for (let y = 0; y < s.rows; y += 1) {
      for (let x = 0; x < s.cols; x += 1) {
        const i = y * s.cols + x
        if (s.layer[i] !== l) {
          continue
        }
        const v = s.value[i]!
        if (v < 0.08) {
          continue
        }
        const k = v < 0.4 ? 0 : v < 0.72 ? 1 : 2
        const jx = (hash(x, y) - 0.5) * cw * 0.6
        const jy = (hash(y, x) - 0.5) * ch * 0.6
        buckets[k]!.push(`M${Math.round((x + 0.5) * cw + jx)} ${Math.round((y + 0.5) * ch + jy)}h0`)
      }
    }
    const paths = buckets
      .map((d, k) => (d.length ? `<path stroke="${style.fill}" stroke-width="${r1(DOT_SIZES[k]! * cw)}" d="${d.join('')}"/>` : ''))
      .join('')
    if (paths) {
      out.push(layerGroup(style, paths))
    }
  })
  return out.join('')
}

function layerGroup(style: LayerStyle, body: string, fill?: string): string {
  const attrs =
    (fill ? ` fill="${fill}"` : '') +
    (style.opacity !== undefined ? ` opacity="${style.opacity}"` : '') +
    (style.isGlowing ? ' filter="url(#bloom)"' : '')
  return `<g${attrs}>${body}</g>`
}

const BLOOM =
  '<filter id="bloom" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'

/** What a drawing may come to: under the Svg element's 131,072, with room to spare. */
export const BUDGET = 120_000

/** The slot area GRID's cell sizes were set for: a 412 × 1442 dock. */
const REFERENCE_AREA = 412 * 1442

/**
 * The scene drawn, its frames cycling from where the clock says. Runs of
 * layers that share an ink are one pass, each on its own grid, drawn in
 * layer order. `only` draws every layer in one ink, to compare inks.
 *
 * Cells grow with the slot so a larger one costs no more: from a scale set
 * by its area, and coarser again until the drawing fits the budget.
 */
export function renderScene(scene: FieldScene, nowMs: number, only?: Ink): string {
  let scale = Math.max(1, Math.sqrt((scene.width * scene.height) / REFERENCE_AREA))
  let svg = renderAt(scene, nowMs, only, scale)
  for (let tries = 0; svg.length > BUDGET && tries < 6; tries += 1) {
    scale *= 1.2
    svg = renderAt(scene, nowMs, only, scale)
  }
  return svg
}

function renderAt(scene: FieldScene, nowMs: number, only: Ink | undefined, scale: number): string {
  const W = Math.round(scene.width)
  const H = Math.round(scene.height)
  const P = scene.period
  const clock = (nowMs / 1000) % P

  const passes: Array<{ ink: Ink; layers: number[] }> = []
  scene.layers.forEach((style, l) => {
    if (l === 0) {
      return
    }
    const ink = only ?? style.ink ?? scene.ink
    const last = passes[passes.length - 1]
    if (last?.ink === ink) {
      last.layers.push(l)
    } else {
      passes.push({ ink, layers: [l] })
    }
  })

  const css: string[] = []
  const reduced: string[] = []
  const body = passes
    .map((pass, p) => {
      const base = GRID[pass.ink]
      const cw = Math.round(base.cw * scale)
      const ch = Math.round(base.ch * scale)
      const frames = base.frames
      const s = sampleAll(scene, cw, ch, frames, new Set(pass.layers))
      const draw = (g: Grid) =>
        pass.ink === 'glyph' ? glyphFrame(scene, g, cw, ch) : pass.ink === 'pixel' ? pixelFrame(scene, g) : particleFrame(scene, g, cw, ch)
      const slot = P / frames

      let stillMarkup = s.still ? draw({ cols: s.cols, rows: s.rows, ...s.still }) : ''
      if (stillMarkup) {
        // The still backdrop drifts a little, so it never reads as frozen.
        // Pixel ink draws in cell units, the others in pixels.
        const drift = pass.ink === 'pixel' ? 0.5 : r1(cw * 0.5)
        const delay = r1(-((nowMs / 1000) % 18))
        css.push(
          scene.stillMotion === 'sway'
            ? `.s${p}{transform-box:view-box;transform-origin:${r1(W / 2)}px 0;animation:s${p} 7s ${delay}s ease-in-out infinite alternate}@keyframes s${p}{from{transform:skewX(-2.5deg)}to{transform:skewX(2.5deg)}}`
            : `.s${p}{animation:s${p} 9s ${delay}s ease-in-out infinite alternate}@keyframes s${p}{from{transform:translate(-${drift}px,0)}to{transform:translate(${drift}px,0)}}`,
        )
        reduced.push(`.s${p}`)
        stillMarkup = `<g class="s${p}">${stillMarkup}</g>`
      }

      const frameBodies = Array.from({ length: frames }, (_, f) => draw({ cols: s.cols, rows: s.rows, layer: s.layer[f]!, value: s.value[f]! }))
      let frameMarkup = ''
      if (frameBodies.some(b => b)) {
        css.push(`.p${p}{opacity:0;animation:p${p} ${P}s steps(1,end) infinite}@keyframes p${p}{0%{opacity:1}${r1(100 / frames)}%{opacity:0}100%{opacity:0}}`)
        reduced.push(`.p${p}`)
        frameMarkup = frameBodies
          .map((b, f) => {
            const delay = r1(-(((P - f * slot) % P) + clock) % P)
            return `<g class="p${p}${f === 0 ? ' f0' : ''}" style="animation-delay:${delay}s">${b}</g>`
          })
          .join('')
      }

      const attrs =
        pass.ink === 'glyph'
          ? ` font-family="ui-monospace,Menlo,Consolas,monospace" font-size="${r1(ch * 1.02)}" font-weight="700" style="white-space:pre"`
          : pass.ink === 'pixel'
            ? ` transform="scale(${cw} ${ch})" shape-rendering="crispEdges"`
            : ' fill="none" stroke-linecap="round"'
      return stillMarkup || frameMarkup ? `<g${attrs}>${stillMarkup}${frameMarkup}</g>` : ''
    })
    .join('')

  if (reduced.length) {
    css.push(`@media (prefers-reduced-motion:reduce){${reduced.join(',')}{animation:none}.f0{opacity:1}}`)
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<style>${css.join('')}${scene.css.join('')}</style><defs>${BLOOM}${scene.defs.join('')}</defs>` +
    `${scene.under}${body}${scene.over}</svg>`
  )
}
