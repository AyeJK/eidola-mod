// Built-in sprite: 20x20 pixel frames composed from layers, emitted as one
// SVG whose frames cycle with CSS steps(). No redraw per frame: the pane
// redraws only when the state changes. Bundled Engrams now ship baked SVGs
// from the Vessel Forge; this is the fallback and the media test's control.

import type { VesselState } from './eidola-types'

export const GRID = 20

/** Character -> palette slot. '.' is transparent. */
export type Palette = {
  o: string // outline
  b: string // body
  h: string // highlight
  e: string // eye
  w: string // eye shine
  c: string // cheek
  m: string // mouth
  a: string // accent (thought dots, z's)
  r: string // alert
  y: string // sparkle
  d: string // sweat drop
}

/**
 * The built-in sprite's colors. It draws the media test's control and
 * stands in when a baked Vessel's file can't be read.
 */
export const SPRITE_PALETTE: Palette = {
  o: '#3b2f8f',
  b: '#cfc6ff',
  h: '#f4f1ff',
  e: '#1a1c2b',
  w: '#ffffff',
  c: '#ff9ec4',
  m: '#3b2f8f',
  a: '#9d93ff',
  r: '#ff5c5c',
  y: '#ffd25e',
  d: '#6fc3ff',
}

type Grid = string[][]
type Dot = [x: number, y: number, ch: keyof Palette]

// The body: a domed spirit. Rows 0-4 stay free for accessories.
const BODY = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '.......oooooo.......',
  '.....oohhbbbboo.....',
  '....ohhbbbbbbbbo....',
  '...ohbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
  '...obbbbbbbbbbbbo...',
]

// Two tail poses; frames alternate them so the spirit always drifts.
const TAILS: [string[], string[]] = [
  ['...obbbobbbbobbbo...', '....ooo.oooo.ooo....'],
  ['...obbbbobbbbobbo...', '....oooo.oooo.oo....'],
]

// Faces: dots drawn over the body.
const EYES = {
  open: [
    [6, 10, 'w'], [7, 10, 'e'], [6, 11, 'e'], [7, 11, 'e'],
    [12, 10, 'w'], [13, 10, 'e'], [12, 11, 'e'], [13, 11, 'e'],
  ],
  closed: [[6, 11, 'e'], [7, 11, 'e'], [12, 11, 'e'], [13, 11, 'e']],
  happy: [[6, 11, 'e'], [7, 10, 'e'], [8, 11, 'e'], [11, 11, 'e'], [12, 10, 'e'], [13, 11, 'e']],
  up: [
    [6, 9, 'w'], [7, 9, 'e'], [6, 10, 'e'], [7, 10, 'e'],
    [12, 9, 'w'], [13, 9, 'e'], [12, 10, 'e'], [13, 10, 'e'],
  ],
  focus: [[6, 11, 'e'], [7, 11, 'e'], [6, 10, 'e'], [12, 11, 'e'], [13, 11, 'e'], [13, 10, 'e']],
  wide: [
    [6, 9, 'w'], [7, 9, 'e'], [6, 10, 'e'], [7, 10, 'e'], [6, 11, 'e'], [7, 11, 'e'],
    [12, 9, 'w'], [13, 9, 'e'], [12, 10, 'e'], [13, 10, 'e'], [12, 11, 'e'], [13, 11, 'e'],
  ],
  left: [
    [5, 10, 'w'], [6, 10, 'e'], [5, 11, 'e'], [6, 11, 'e'],
    [11, 10, 'w'], [12, 10, 'e'], [11, 11, 'e'], [12, 11, 'e'],
  ],
  right: [
    [7, 10, 'w'], [8, 10, 'e'], [7, 11, 'e'], [8, 11, 'e'],
    [13, 10, 'w'], [14, 10, 'e'], [13, 11, 'e'], [14, 11, 'e'],
  ],
  x: [
    [5, 9, 'e'], [7, 9, 'e'], [6, 10, 'e'], [5, 11, 'e'], [7, 11, 'e'],
    [12, 9, 'e'], [14, 9, 'e'], [13, 10, 'e'], [12, 11, 'e'], [14, 11, 'e'],
  ],
} satisfies Record<string, Dot[]>

const CHEEKS: Dot[] = [[5, 12, 'c'], [14, 12, 'c']]

const MOUTH = {
  smile: [[8, 13, 'm'], [9, 14, 'm'], [10, 14, 'm'], [11, 13, 'm']],
  small: [[9, 14, 'm'], [10, 14, 'm']],
  open: [[9, 13, 'm'], [10, 13, 'm'], [9, 14, 'm'], [10, 14, 'm']],
  frown: [[8, 14, 'm'], [9, 13, 'm'], [10, 13, 'm'], [11, 14, 'm']],
  o: [[9, 14, 'm']],
} satisfies Record<string, Dot[]>

function plus(x: number, y: number, ch: keyof Palette): Dot[] {
  return [[x, y - 1, ch], [x - 1, y, ch], [x, y, ch], [x + 1, y, ch], [x, y + 1, ch]]
}

const BANG: Dot[] = [[9, 0, 'r'], [10, 0, 'r'], [9, 1, 'r'], [10, 1, 'r'], [9, 2, 'r'], [10, 2, 'r'], [9, 4, 'r'], [10, 4, 'r']]
const DROP: Dot[] = [[16, 6, 'd'], [16, 7, 'd'], [17, 7, 'd'], [16, 8, 'd']]
const Z_SMALL: Dot[] = [[16, 3, 'a'], [17, 3, 'a'], [18, 3, 'a'], [17, 4, 'a'], [16, 5, 'a'], [17, 5, 'a'], [18, 5, 'a']]
const Z_BIG: Dot[] = [
  [15, 0, 'a'], [16, 0, 'a'], [17, 0, 'a'], [18, 0, 'a'], [17, 1, 'a'], [16, 2, 'a'],
  [15, 3, 'a'], [16, 3, 'a'], [17, 3, 'a'], [18, 3, 'a'],
]

/** One frame: which tail, and which dots on top. */
type Frame = { tail: 0 | 1; dots: Dot[] }

export type Animation = {
  frames: Frame[]
  /** Seconds each frame shows. */
  frameS: number
  /** Seconds per bob up and down; 0 holds still. */
  bobS: number
}

const face = (...parts: Dot[][]): Dot[] => parts.flat()

export const ANIMATIONS: Record<VesselState, Animation> = {
  idle: {
    frameS: 0.5,
    bobS: 2,
    frames: [0, 1, 0, 1, 0, 1].map((tail, i) => ({
      tail: tail as 0 | 1,
      dots: face(i === 5 ? EYES.closed : EYES.open, CHEEKS, MOUTH.small),
    })),
  },
  thinking: {
    frameS: 0.45,
    bobS: 1.6,
    frames: [
      { tail: 0, dots: face(EYES.up, CHEEKS, MOUTH.o, [[14, 5, 'a']]) },
      { tail: 1, dots: face(EYES.up, CHEEKS, MOUTH.o, [[14, 5, 'a'], [16, 3, 'a']]) },
      { tail: 0, dots: face(EYES.up, CHEEKS, MOUTH.o, [[14, 5, 'a'], [16, 3, 'a'], [18, 1, 'a']]) },
    ],
  },
  working: {
    frameS: 0.18,
    bobS: 0.5,
    frames: [
      { tail: 0, dots: face(EYES.focus, CHEEKS, MOUTH.small, plus(18, 7, 'y')) },
      { tail: 1, dots: face(EYES.focus, CHEEKS, MOUTH.small, plus(1, 9, 'y')) },
    ],
  },
  attention: {
    frameS: 0.4,
    bobS: 0.8,
    frames: [
      { tail: 0, dots: face(EYES.wide, CHEEKS, MOUTH.o, BANG) },
      { tail: 1, dots: face(EYES.wide, CHEEKS, MOUTH.o) },
    ],
  },
  success: {
    frameS: 0.3,
    bobS: 0.6,
    frames: [
      { tail: 0, dots: face(EYES.happy, CHEEKS, MOUTH.smile, plus(2, 4, 'y'), [[17, 2, 'y']]) },
      { tail: 1, dots: face(EYES.happy, CHEEKS, MOUTH.smile, plus(17, 3, 'y'), [[2, 6, 'y']]) },
    ],
  },
  responding: {
    frameS: 0.2,
    bobS: 1.2,
    frames: [
      { tail: 0, dots: face(EYES.open, CHEEKS, MOUTH.open) },
      { tail: 1, dots: face(EYES.open, CHEEKS, MOUTH.small) },
    ],
  },
  error: {
    frameS: 0.6,
    bobS: 0,
    frames: [
      { tail: 0, dots: face(EYES.x, MOUTH.frown, DROP) },
      { tail: 1, dots: face(EYES.x, MOUTH.frown) },
    ],
  },
  waiting: {
    frameS: 0.45,
    bobS: 1.6,
    frames: [
      { tail: 0, dots: face(EYES.left, CHEEKS, MOUTH.small) },
      { tail: 1, dots: face(EYES.right, CHEEKS, MOUTH.small) },
    ],
  },
  sleeping: {
    frameS: 0.9,
    bobS: 3.6,
    frames: [
      { tail: 0, dots: face(EYES.closed, MOUTH.o, Z_SMALL) },
      { tail: 1, dots: face(EYES.closed, MOUTH.o, Z_BIG) },
    ],
  },
}

export function compose(frame: Frame): Grid {
  const rows = [...BODY, ...TAILS[frame.tail]]
  const grid = rows.map(row => row.split(''))
  for (const [x, y, ch] of frame.dots) {
    const row = grid[y]
    if (row !== undefined && x >= 0 && x < GRID) {
      row[x] = ch
    }
  }
  return grid
}

/** Horizontal runs of one color become one rect, to keep the SVG small. */
export function rects(grid: Grid, palette: Palette): string {
  const out: string[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') {
        x += 1
        continue
      }
      let end = x + 1
      while (end < row.length && row[end] === ch) end += 1
      const fill = palette[ch as keyof Palette] ?? '#ff00ff'
      out.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`)
      x = end
    }
  })
  return out.join('')
}

const r = (n: number) => Math.round(n * 1000) / 1000

/** The whole animated Vessel for one state, as SVG markup. */
export function vesselSvg(state: VesselState, palette: Palette, size: number): string {
  const anim = ANIMATIONS[state]
  const n = anim.frames.length
  const cycle = r(anim.frameS * n)
  const slice = r(100 / n)

  const delays = anim.frames
    .map((_, i) => `.d${i}{animation-delay:-${r(((n - i) % n) * anim.frameS)}s}`)
    .join('')
  const bob =
    anim.bobS > 0
      ? `.bob{animation:bob ${anim.bobS}s steps(1,end) infinite}` +
        '@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(-1px)}100%{transform:translateY(0)}}'
      : ''
  const css =
    `.f{opacity:0;animation:fr ${cycle}s steps(1,end) infinite}.f0{opacity:1}` +
    `@keyframes fr{0%{opacity:1}${slice}%{opacity:0}100%{opacity:0}}` +
    delays +
    bob +
    '@media (prefers-reduced-motion:reduce){.f,.bob{animation:none}}'

  const frames = anim.frames
    .map((frame, i) => `<g class="f f${i === 0 ? '0' : 'n'} d${i}">${rects(compose(frame), palette)}</g>`)
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -1 ${GRID} ${GRID + 1}" ` +
    `width="${size}" height="${Math.round((size * (GRID + 1)) / GRID)}" shape-rendering="crispEdges">` +
    `<style>${css}</style><g class="bob">${frames}</g></svg>`
  )
}

/** Terminal fallback: one line per state. */
export const FACES: Record<VesselState, string> = {
  idle: '( o_o )',
  thinking: '( o_o ) . o O',
  working: '( >_< ) *',
  attention: '( O_O ) !',
  success: '( ^_^ ) +',
  responding: '( o0o )',
  error: '( x_x )',
  waiting: '( o_o)>',
  sleeping: '( -_- ) z',
}
