// Exported Lich: an Engram plugin for Eidola, made from the bundled Lich by
// Eidola's scripts/export-engram.mjs (contract 1, docs/spec/engram-plugin.md
// in the Eidola mod). This module announces the Engram, and hands each
// drawing Eidola asks for to hooks/draw.tsx, the Lich's own drawing
// module, copied here with everything it draws with: change the creature
// there and in the files beside it. Run Eidola's checker on the folder
// (node scripts/check-engram.mjs <folder>) before you share it.
//
// It writes none of Eidola's state and adds nothing to any prompt.

import type { Elements, EngineInterface, Register, RenderElement, RenderSurface } from 'claude-code'

import { draw } from './draw'
import type { DrawEls, DrawKit } from './drawing'
import type { EidolaHandoff, EidolaWhere, Mood } from './eidola-types'
import { FACES } from './sprite'

/** This Engram's id: engram.json's. */
const ID = 'exported-lich'
/** Its name, for the drawing's alt text: engram.json's. */
const NAME = "Exported Lich"
/** The Box its drawing comes back in, and the slot Eidola leaves for it. */
const SCENE = `eidola:${ID}`
const SLOT = `eidola-slot:${ID}`
/** Where a failure is reported from. */
const FILE = 'hooks/register.tsx'
/** How long the face shows the error effect after the ink rises, where no Client can run: in ms. */
const ERROR_MS = 2000

type Els = DrawEls & Pick<Elements['desktop'], 'Text'>

// The backdrop last built for the pane and for the band. Its loops are
// locked to the clock when it is built, so it is built again only when its
// size changes: a redraw for anything else keeps the running drawing.
const built = new Map<EidolaWhere, { key: string; svg: string }>()

function memoFor(where: EidolaWhere): DrawKit['memo'] {
  return (key, build) => {
    const last = built.get(where)
    if (last?.key === key) {
      return last.svg
    }
    const svg = build()
    built.set(where, { key, svg })
    return svg
  }
}

/** The creature, in one Box keyed eidola:<id>: live where a Client can run (the desktop), its face elsewhere (its error face while the ink is fresh). */
function creature(els: Els, surface: RenderSurface, handoff: EidolaHandoff, now: number): RenderElement {
  if (surface === 'desktop') {
    const tree = draw(els, handoff, { name: NAME, now, memo: memoFor(handoff.where) })
    return { ...(tree as object), props: { ...(tree as { props?: object }).props, key: SCENE } } as RenderElement
  }
  const { Box, Text } = els
  return (
    <Box key={SCENE} width={handoff.columns} height={handoff.rows}>
      <Text>{FACES[handoff.ink > 0 && now - handoff.inkAt < ERROR_MS ? 'error' : handoff.mood]}</Text>
    </Box>
  )
}

/** Eidola's tree with this Engram's slot, wherever it is, filled; anything else as it came. */
function fill(node: unknown, make: (columns: number, rows: number) => RenderElement): unknown {
  if (node === null || typeof node !== 'object') {
    return node
  }
  const element = node as { props?: { key?: unknown; width?: unknown; height?: unknown }; children?: unknown }
  if (element.props?.key === SLOT) {
    return make(Number(element.props.width) || 20, Number(element.props.height) || 5)
  }
  if (Array.isArray(element.children)) {
    return { ...element, children: element.children.map(child => fill(child, make)) }
  }
  return node
}

/** True when the tree holds this Engram's slot. */
function hasSlot(node: unknown): boolean {
  if (node === null || typeof node !== 'object') {
    return false
  }
  const element = node as { props?: { key?: unknown }; children?: unknown }
  return element.props?.key === SLOT || (Array.isArray(element.children) && element.children.some(hasSlot))
}

/** Tells Eidola the drawing failed, with the file and the stack's line: it draws the fallback and marks the Engram not loading. */
async function fault($: EngineInterface, error: unknown): Promise<void> {
  try {
    await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
  } catch {
    // Eidola isn't there to tell.
  }
}

/**
 * One drawing, the pane's or the band's. Beneath Eidola (this plugin loaded
 * after it), Eidola asks with the hand-off on e.props.eidola. Above it (this
 * plugin loaded first), Eidola's tree comes back from next with a slot to
 * fill, and the state is read from Eidola's.
 */
async function answer($: EngineInterface, where: EidolaWhere, surface: RenderSurface, els: Els, props: unknown, below: () => Promise<RenderElement>): Promise<RenderElement> {
  const handoff = (props as { eidola?: EidolaHandoff }).eidola
  if (handoff) {
    if (handoff.engram !== ID) {
      return below()
    }
    try {
      return creature(els, surface, handoff, await $.clock.now())
    } catch (error) {
      await fault($, error)
      return below()
    }
  }
  const tree = await below()
  if (!hasSlot(tree)) {
    return tree
  }
  const { value: mood = 'idle' as Mood } = await $.state.get({ plugin: 'eidola', key: 'mood' })
  const { value: moodBefore = 'idle' as Mood } = await $.state.get({ plugin: 'eidola', key: 'moodBefore' })
  const { value: moodAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'moodAt' })
  const { value: ink = 0 } = await $.state.get({ plugin: 'eidola', key: 'ink' })
  const { value: inkAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'inkAt' })
  const { value: epoch = 0 } = await $.state.get({ plugin: 'eidola', key: 'epoch' })
  const now = await $.clock.now()
  try {
    return fill(tree, (columns, rows) => creature(els, surface, { contract: 1, engram: ID, where, columns, rows, mood, moodBefore, moodAt, ink, inkAt, epoch }, now)) as RenderElement
  } catch (error) {
    await fault($, error)
    return tree
  }
}

export const register: Register = on => {
  // Announce: Eidola reads engram.json from this folder. Without Eidola there
  // is nobody to announce to, and nothing else changes.
  on('session.start', async ($, e, next) => {
    try {
      await $.eidola.announce({ root: $.plugin.root })
    } catch {
      // Eidola isn't installed: this plugin draws nothing.
    }
    return next(e)
  })

  // The pane and the band, one hook each, the same way.
  on('ui.render', { component: 'Pane', requestId: 'eidola' }, ($, e, next) => answer($, 'pane', e.surface, $.ui.resolve(e) as unknown as Els, e.props, () => next(e)))
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => answer($, 'band', e.surface, $.ui.resolve(e) as unknown as Els, e.props, () => next(e)))
}
