// /eidola live: a Client module that draws pixel art and animates it live on
// a timer. On desktop a pixel row is a row of coloured Boxes, two to a cell
// row (half height each): exact rectangles, no line spacing between them.
// On the terminal it is half-block text (▀: its colour paints the top half,
// its background the bottom), which the terminal draws gap-free. The mood arrives as props; the instance and
// its timer are kept across redraws, so the disc should glide to the new
// mood's spot and the frame count should never start over.

import type { ClientModule } from 'claude-code'

type Mood = 'idle' | 'working' | 'attention'
/** The grid comes in props, never from the region: a drawing sized by its region resizes the region, and the surface stops a Client that does that. */
type Props = { mood: Mood; cols: number; rows: number; surface: 'desktop' | 'terminal' }
type Sim = { mood: Mood; frame: number; x: number; y: number }
type State = { sim: Sim }

/** Where the disc rests for each mood, as fractions of the region. */
const TARGET: Record<Mood, [number, number]> = { idle: [0.25, 0.75], working: [0.5, 0.35], attention: [0.78, 0.5] }
const DISC: Record<Mood, string> = { idle: '#7fa6b0', working: '#5ff6ff', attention: '#ffb547' }

/** A deep-water gradient in eight steps, rippled by the frame. */
const WATER = ['#1d6170', '#185868', '#134d5d', '#0f4252', '#0b3746', '#082c3a', '#05212d', '#031620']

const TICK_MS = 100

const LiveTest: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (!state) {
    const sim: Sim = { mood: props.mood, frame: 0, x: TARGET[props.mood][0], y: TARGET[props.mood][1] }
    state = { sim }
    surface.every(TICK_MS, () => {
      sim.frame += 1
      // Ease toward the mood's spot: a glide, never a jump.
      const [tx, ty] = TARGET[sim.mood]
      sim.x += (tx - sim.x) * 0.08
      sim.y += (ty - sim.y) * 0.08
      surface.setState({ sim })
    })
    surface.setState(state)
  }
  const sim = state.sim
  sim.mood = props.mood

  const cols = Math.max(1, props.cols)
  const rows = Math.max(2, props.rows) - 1
  const pxRows = rows * 2
  // A half-block pixel is 8 × 9.5 px on desktop: scale y so the disc is round.
  const aspect = 9.5 / 8
  const cx = sim.x * cols
  const cy = sim.y * pxRows
  const radius = cols * 0.14
  const colour = (px: number, py: number): string => {
    const dx = px + 0.5 - cx
    const dy = (py + 0.5 - cy) * aspect
    if (dx * dx + dy * dy < radius * radius) {
      return DISC[sim.mood]
    }
    const ripple = Math.sin(px * 0.35 + py * 0.15 - sim.frame * 0.25) * 0.6
    const step = Math.max(0, Math.min(WATER.length - 1, Math.floor((py / pxRows) * WATER.length + ripple)))
    return WATER[step]!
  }

  if (props.surface === 'desktop') {
    /** One pixel row as Boxes, a Box per run of one colour. */
    const pixelRow = (py: number) => {
      const boxes = []
      let start = 0
      let c = colour(0, py)
      for (let x = 1; x <= cols; x += 1) {
        const n = x < cols ? colour(x, py) : ''
        if (n !== c) {
          boxes.push(<Box width={x - start} height="100%" flexShrink={0} backgroundColor={c} />)
          start = x
          c = n
        }
      }
      return boxes
    }
    const cells = []
    for (let y = 0; y < rows; y += 1) {
      cells.push(
        <Box flexDirection="column" width={cols} height={1} flexShrink={0}>
          <Box flexDirection="row" width={cols} height="50%">
            {pixelRow(y * 2)}
          </Box>
          <Box flexDirection="row" width={cols} height="50%">
            {pixelRow(y * 2 + 1)}
          </Box>
        </Box>,
      )
    }
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate">{`live · ${sim.mood} · frame ${sim.frame}`}</Text>
        {cells}
      </Box>
    )
  }

  const lines = []
  for (let y = 0; y < rows; y += 1) {
    const runs = []
    let start = 0
    let fg = colour(0, y * 2)
    let bg = colour(0, y * 2 + 1)
    for (let x = 1; x <= cols; x += 1) {
      const nfg = x < cols ? colour(x, y * 2) : ''
      const nbg = x < cols ? colour(x, y * 2 + 1) : ''
      if (nfg !== fg || nbg !== bg) {
        runs.push(
          <Text key={`${start}`} color={fg} backgroundColor={bg}>
            {'▀'.repeat(x - start)}
          </Text>,
        )
        start = x
        fg = nfg
        bg = nbg
      }
    }
    lines.push(
      <Text key={`r${y}`} wrap="truncate">
        {runs}
      </Text>,
    )
  }
  return (
    <Box flexDirection="column">
      <Text dimColor wrap="truncate">{`live · ${sim.mood} · frame ${sim.frame}`}</Text>
      {lines}
    </Box>
  )
}

export default LiveTest
