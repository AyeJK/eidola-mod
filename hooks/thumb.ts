// A frame of a live drawing as a still SVG, for an Engram's thumbnail: the
// pixels or glyphs a live Engram draws in Boxes, drawn instead as paths and
// text over its backdrop, at full detail. Used by the bake
// (scripts/bake-thumbs.mjs), never while a session runs.

import type { GlyphAt } from './live-glyphs'
import type { Colour } from './live-pixels'
import { PX_H, PX_W } from './live-pixels'

/** A desktop cell, in px: a glyph is drawn one a cell. */
const CELL_W = 8
const CELL_H = 19

/** The bound a desktop Svg's source must stay inside. */
export const SVG_LIMIT = 131_072

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A frame's pixels (two rows of them a cell row, 8 × 9.5 px each) as one
 * path a colour, each run of a colour along a row one `h` stroke of it.
 */
export function pixelsSvg(cols: number, rows: number, colour: Colour): string {
  const runs = new Map<string, string[]>()
  for (let py = 0; py < rows * 2; py += 1) {
    let start = 0
    let c = colour(0, py, 8)
    for (let x = 1; x <= cols; x += 1) {
      const n = x < cols ? colour(x, py, 8) : ''
      if (n !== c || x === cols) {
        if (c) {
          const list = runs.get(c) ?? []
          list.push(`M${start} ${py}h${x - start}v1h${start - x}z`)
          runs.set(c, list)
        }
        start = x
        c = n
      }
    }
  }
  const paths = [...runs].map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('')
  return `<g transform="scale(${PX_W} ${PX_H})" shape-rendering="crispEdges">${paths}</g>`
}

/**
 * A frame's glyphs, one a cell (8 × 19 px), as a text a run of one colour,
 * stretched to the run's cells so every glyph keeps its column.
 */
export function glyphsSvg(cols: number, rows: number, glyphAt: GlyphAt, font = { size: 14, weight: 400 }): string {
  const out: string[] = []
  for (let y = 0; y < rows; y += 1) {
    let start = 0
    let colour = ''
    let text = ''
    const flush = (end: number) => {
      if (colour && end > start && text.trim()) {
        out.push(`<text x="${start * CELL_W}" y="${(y + 0.76) * CELL_H}" fill="${colour}" textLength="${(end - start) * CELL_W}" lengthAdjust="spacingAndGlyphs">${escape(text)}</text>`)
      }
    }
    for (let x = 0; x < cols; x += 1) {
      const cell = glyphAt(x, y, 6)
      const c = cell ? cell[0] : ''
      if (c !== colour) {
        flush(x)
        start = x
        colour = c
        text = ''
      }
      text += cell ? cell[1] : ' '
    }
    flush(cols)
  }
  return `<g font-family="ui-monospace, Consolas, Menlo, monospace" font-size="${font.size}" font-weight="${font.weight}" xml:space="preserve">${out.join('')}</g>`
}

/**
 * A still: the backdrop (an SVG of its own, `width` × `height`) with the
 * drawing over it, moved down `drop` px where it would crowd the top edge.
 */
export function stillSvg(backdrop: string, drawing: string, width: number, height: number, drop = 0): string {
  // The backdrop nests as it is: an <svg> inside an <svg> is drawn in its own box.
  const inner = backdrop.replace(/^<\?xml[^>]*>\s*/, '')
  const over = drop ? `<g transform="translate(0 ${drop})">${drawing}</g>` : drawing
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${inner}${over}</svg>`
}

/** The cell size a still is captured at, for a box `width` × `height` px wide. */
export function cellsFor(width: number, height: number): { cols: number; rows: number } {
  return { cols: Math.round(width / CELL_W), rows: Math.round(height / CELL_H) }
}
