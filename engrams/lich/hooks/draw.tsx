// The Lich's drawing module (hooks/drawing.ts): the dark it hangs in drawn
// once, and it drawn over that in glyphs by lich-live.tsx. In the pane, four
// slices, top to bottom, that keep in step by the hand-off's epoch; in the
// band, a strip across its grimoire.
//
// Eidola draws the bundled Lich through this, and an Engram plugin exported
// from it (scripts/export-engram.mjs) draws with this same file.

import { overdrawn } from '../../../hooks/drawing'
import type { Draw } from '../../../hooks/drawing'
import { renderScene } from '../../../hooks/field'
import { voidScene } from '../../../hooks/lich'
import { PX_PER_COLUMN, PX_PER_ROW, sceneSize } from '../../../hooks/stage'

/** The Lich's pane is drawn by four drawings, one above the next, each within its own bound. */
export function lichSlices(rows: number): Array<[number, number]> {
  const cuts = [0, 1, 2, 3, 4].map(i => Math.round((rows * i) / 4))
  return [0, 1, 2, 3].map(i => [cuts[i]!, cuts[i + 1]! - cuts[i]!] as [number, number])
}

export const draw: Draw = (els, handoff, kit) => {
  const { Box, Svg, Client } = els
  const { columns: cols, rows } = handoff
  // What the live drawings share in their props: the mood, the ink, and the clock that keeps split drawings in step.
  const live = { mood: handoff.mood, moodAt: handoff.moodAt, moodBefore: handoff.moodBefore, ink: handoff.ink, inkAt: handoff.inkAt, epoch: handoff.epoch }
  if (handoff.where === 'band') {
    const width = Math.max(96, cols * PX_PER_COLUMN - 4)
    const height = rows * PX_PER_ROW - 2
    const backdrop = kit.memo(`lich-void:${width}x${height}`, () => renderScene(voidScene(width, height, 'band'), kit.now))
    return (
      <Box width={cols} height={rows}>
        <Svg key="scene:band-void" source={backdrop} alt={`${kit.name} in the dark`} width={width} height={height} isInteractive />
        <Box position="absolute" top={0} left={0}>
          <Client key="lich-band" module="../../../hooks/lich-live.tsx" props={{ ...live, cols, rows, view: 'band' }} width={cols} height={rows} />
        </Box>
      </Box>
    )
  }
  // The dark the same height as the drawing over it: any taller and the pane scrolls.
  const { width } = sceneSize(cols, rows, 'dock')
  const height = overdrawn(rows)
  const backdrop = kit.memo(`lich-void:${width}x${height}`, () => renderScene(voidScene(width, height, 'pane'), kit.now))
  const shared = { ...live, cols, rows }
  const [a, b, c, d] = lichSlices(rows)
  return (
    <Box width={cols} height={rows} overflow="hidden" alignItems="flex-start">
      {/* Nothing here may change with the mood, alt included: a changed prop reloads the drawing. */}
      <Svg key="scene:void" source={backdrop} alt={`${kit.name} in the dark`} width={width} height={height} isInteractive />
      <Box position="absolute" top={0} left={0} flexDirection="column">
        <Client key="lich-0" module="../../../hooks/lich-live.tsx" props={{ ...shared, slice: a! }} width={cols} height={a![1]} />
        <Client key="lich-1" module="../../../hooks/lich-live.tsx" props={{ ...shared, slice: b! }} width={cols} height={b![1]} />
        <Client key="lich-2" module="../../../hooks/lich-live.tsx" props={{ ...shared, slice: c! }} width={cols} height={c![1]} />
        <Client key="lich-3" module="../../../hooks/lich-live.tsx" props={{ ...shared, slice: d! }} width={cols} height={d![1]} />
      </Box>
    </Box>
  )
}
