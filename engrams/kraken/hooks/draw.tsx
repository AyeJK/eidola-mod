// The Kraken's drawing module (hooks/drawing.ts): still water drawn once as
// an SVG whose source never changes, the creature drawn live over it by
// kraken-live.tsx. A new mood reaches the running Client as props: no
// reload, no cut. In the pane, deep water; in the band, a wide strip of it.
//
// Eidola draws the bundled Kraken through this, and an Engram plugin
// exported from it (scripts/export-engram.mjs) draws with this same file.

import { overdrawn } from '../../../hooks/drawing'
import type { Draw } from '../../../hooks/drawing'
import { renderScene } from '../../../hooks/field'
import { krakenWaterScene } from '../../../hooks/kraken'
import { PX_PER_COLUMN, PX_PER_ROW, sceneSize } from '../../../hooks/stage'

export const draw: Draw = (els, handoff, kit) => {
  const { Box, Svg, Client } = els
  const { columns: cols, rows, mood, ink } = handoff
  if (handoff.where === 'band') {
    const width = Math.max(96, cols * PX_PER_COLUMN - 4)
    const height = rows * PX_PER_ROW - 2
    const water = kit.memo(`kraken-water:${width}x${height}`, () => renderScene(krakenWaterScene(width, height), kit.now))
    return (
      <Box width={cols} height={rows}>
        <Svg key="scene:band-water" source={water} alt={`${kit.name} in deep water`} width={width} height={height} isInteractive />
        <Box position="absolute" top={0} left={0}>
          <Client key="kraken-band" module="../../../hooks/kraken-live.tsx" props={{ mood, cols, rows, view: 'band', ink }} width={cols} height={rows} />
        </Box>
      </Box>
    )
  }
  // The water the same height as the drawing over it: any taller and the pane scrolls.
  const { width } = sceneSize(cols, rows, 'dock')
  const height = overdrawn(rows)
  const water = kit.memo(`kraken-water:${width}x${height}`, () => renderScene(krakenWaterScene(width, height), kit.now))
  return (
    <Box width={cols} height={rows} overflow="hidden" alignItems="flex-start">
      {/* Nothing here may change with the mood, alt included: a changed prop reloads the drawing. */}
      <Svg key="scene:water" source={water} alt={`${kit.name} in deep water`} width={width} height={height} isInteractive />
      <Box position="absolute" top={0} left={0}>
        <Client key="kraken-live" module="../../../hooks/kraken-live.tsx" props={{ mood, cols, rows, ink }} width={cols} height={rows} />
      </Box>
    </Box>
  )
}
