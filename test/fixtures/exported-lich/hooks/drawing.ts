// The drawing interface (docs/spec/engram-plugin.md, "The hand-off"): what
// draws a creature from the hand-off. Each bundled Engram's drawing module,
// engrams/<id>/hooks/draw.tsx, is one of these, and Eidola draws the bundled
// three through it as it asks an Engram plugin. scripts/export-engram.mjs
// copies a bundled Engram's drawing module, and this file with it, into an
// Engram plugin of its own, whose hooks call the very same function with the
// hand-off Eidola gives them.

import type { Elements, RenderElement } from 'claude-code'

import type { EidolaHandoff } from './eidola-types'
import { PX_PER_ROW } from './stage'

/** The elements a drawing draws with: a desktop's, where a Client can run. */
export type DrawEls = Pick<Elements['desktop'], 'Box' | 'Svg' | 'Client'>

/** What the hook drawing the creature gives it besides the hand-off. */
export type DrawKit = {
  /** The Engram's name, as its engram.json gives it: for the drawing's alt text. */
  name: string
  /** The clock now (ms): a still backdrop's loops are locked to it when built. */
  now: number
  /**
   * A still backdrop's SVG by key, built once and kept while the key holds:
   * a rebuilt one (a new clock) would reload the drawing on the surface.
   */
  memo: (key: string, build: () => string) => string
}

/**
 * A creature's drawing, `columns` × `rows` cells of the hand-off: one Box,
 * as wide and tall, holding the creature. The Engram plugin's hooks key it
 * `eidola:<id>` before they answer it; Eidola places a bundled one as it is.
 */
export type Draw = (els: DrawEls, handoff: EidolaHandoff, kit: DrawKit) => RenderElement

/**
 * A pane backdrop's height in px: a row taller than its rows at 19 px each,
 * clipped to them. A row is drawn a fraction of a pixel taller than 19, so a
 * backdrop of exactly rows × 19 stops a few pixels short of the HUD's bottom
 * brackets, which sit on the rows; drawn taller and clipped it meets them.
 */
export function overdrawn(rows: number): number {
  return (rows + 1) * PX_PER_ROW
}
