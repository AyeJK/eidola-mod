// The Wisp's drawing module (hooks/drawing.ts): its fen drawn once, the
// spirit and its lanterns live over it by wisp-live.tsx. The Wisp draws only
// in the band; the pane, opened by hand, draws the same band view. A row
// taller than its rows, clipped to them, so the HUD meets its edges.
//
// Eidola draws the bundled Wisp through this, and an Engram plugin exported
// from it (scripts/export-engram.mjs) draws with this same file.

import { overdrawn } from './drawing'
import type { Draw } from './drawing'
import { renderScene } from './field'
import { PX_PER_COLUMN } from './stage'
import { fenScene } from './wisp'

export const draw: Draw = (els, handoff, kit) => {
  const { Box, Svg, Client } = els
  const { columns: cols, rows, mood, ink } = handoff
  const width = cols * PX_PER_COLUMN
  const height = overdrawn(rows)
  const fen = kit.memo(`wisp-fen:${cols}x${rows}`, () => renderScene(fenScene(width, height, cols, rows), kit.now))
  return (
    <Box width={cols} height={rows} overflow="hidden" alignItems="flex-start">
      <Svg key="scene:band-fen" source={fen} alt={`${kit.name} in the fen`} width={width} height={height} isInteractive />
      <Box position="absolute" top={0} left={0}>
        <Client key="wisp-band" module="./wisp-live.tsx" props={{ mood, cols, rows, ink }} width={cols} height={rows} />
      </Box>
    </Box>
  )
}
