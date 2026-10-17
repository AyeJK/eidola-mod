// The starter Engram plugin for Eidola (contract 1, docs/spec/engram-plugin.md
// in the Eidola mod): a small creature, a mote of light, in the three moods,
// with an error effect. The Eidola skill copies this folder to make a new
// Engram "from nothing", then changes the creature with you.
//
// What to change to make it yours:
//   - LOOKS: the creature itself, one look per mood and one for the error
//     effect. Each look is a colour, a body (lines of text, all the same
//     width) and a caption.
//   - draw(): how a look is laid out in the room Eidola hands over.
//   - ID: engram.json's id. The skill sets both when it copies the starter.
// The rest (announcing, the two seats of the hand-off, the fault report) is
// the contract, and works as it is.
//
// It writes none of Eidola's state and adds nothing to any prompt.
//
// Everything sits inside `register`, so a test can load this function as an
// inline plugin (Eidola's hooks/starter.test.ts does).

import type { Register, RenderElement } from 'claude-code'

export const register: Register = on => {
  /** This Engram's id: engram.json's. */
  const ID = 'starter'
  /** The Box its drawing comes back in, and the slot Eidola leaves for it. */
  const SCENE = `eidola:${ID}`
  const SLOT = `eidola-slot:${ID}`
  /** Where a failure is reported from. */
  const FILE = 'hooks/register.tsx'
  /** How long the error effect plays after the ink rises, in ms. */
  const ERROR_MS = 2000

  type Mood = 'idle' | 'working' | 'attention'
  /** One look: its colour, its body (lines of equal width) and the caption under it. */
  type Look = { colour: string; glow: string; body: readonly string[]; caption: string }

  // ── The creature ───────────────────────────────────────────────────────
  const LOOKS: Record<Mood | 'error', Look> = {
    // At rest: a soft blue mote, eyes half open, drifting.
    idle: { colour: '#7fd4ff', glow: '#2f6f8f', body: ['  .--.  ', ' ( -.- ) ', "  `~~'  "], caption: 'drifting' },
    // Busy: amber, eyes squeezed, sparks flying off it.
    working: { colour: '#ffb347', glow: '#a8641c', body: [' *.--.* ', ' ( >.< ) ', " *`~~'* "], caption: 'busy busy' },
    // Asking to be looked at: bright yellow, eyes wide, arms up.
    attention: { colour: '#ffe14d', glow: '#b39a1f', body: ['\\ .--. /', ' ( O.O ) ', "  `~~'  "], caption: 'look here!' },
    // The error effect, over any mood for ERROR_MS: red, crossed eyes, smoke.
    error: { colour: '#ff4d4d', glow: '#8f1f1f', body: [' ~.--.~ ', ' ( x.x ) ', "  `~~'  "], caption: 'ouch' },
  }

  /** What the drawing needs: the room, the mood, and whether the error effect plays. */
  type Seen = { columns: number; rows: number; mood: Mood; isError: boolean }
  type Els = { Box: (props: Record<string, unknown>) => RenderElement; Text: (props: Record<string, unknown>) => RenderElement }

  /** The creature, `columns` × `rows`, in one Box keyed eidola:<id>. */
  const draw = (els: Els, seen: Seen): RenderElement => {
    const { Box, Text } = els
    const look = (seen.isError ? LOOKS.error : LOOKS[seen.mood]) ?? LOOKS.idle
    // A border and a caption only where there is room for them.
    const hasBorder = seen.rows >= look.body.length + 2 && seen.columns >= 14
    const hasCaption = seen.rows >= look.body.length + (hasBorder ? 3 : 1)
    const lines = look.body.map((line, i) => Text({ key: `${ID}-body-${i}`, color: look.colour, bold: true, children: line }))
    return Box({
      key: SCENE,
      width: seen.columns,
      height: seen.rows,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      children: [
        Box({
          key: `${ID}-body`,
          flexDirection: 'column',
          alignItems: 'center',
          paddingX: hasBorder ? 1 : 0,
          ...(hasBorder ? { borderStyle: 'round', borderColor: look.glow } : {}),
          children: lines,
        }),
        ...(hasCaption ? [Text({ key: `${ID}-caption`, color: look.glow, children: look.caption })] : []),
      ],
    })
  }

  // ── The contract: no need to change anything below ─────────────────────

  /** Eidola's tree with this Engram's slot, wherever it is, filled; anything else as it came. */
  const fill = (node: unknown, make: (columns: number, rows: number) => RenderElement): unknown => {
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
  const hasSlot = (node: unknown): boolean => {
    if (node === null || typeof node !== 'object') {
      return false
    }
    const element = node as { props?: { key?: unknown }; children?: unknown }
    return element.props?.key === SLOT || (Array.isArray(element.children) && element.children.some(hasSlot))
  }

  type Handoff = { engram: string; columns: number; rows: number; mood: Mood; ink: number; inkAt: number }

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

  // The pane and the band, one hook each, the same way. Beneath Eidola (this
  // plugin loaded after it), Eidola asks with the hand-off on e.props.eidola.
  // Above it (this plugin loaded first), Eidola's tree comes back from next
  // with a slot to fill, and the state is read from Eidola's.
  on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => {
    const handoff = (e.props as { eidola?: Handoff }).eidola
    if (handoff) {
      if (handoff.engram !== ID) {
        return next(e)
      }
      const now = await $.clock.now()
      try {
        return draw($.ui.resolve(e) as unknown as Els, { columns: handoff.columns, rows: handoff.rows, mood: handoff.mood, isError: handoff.ink > 0 && now - handoff.inkAt < ERROR_MS })
      } catch (error) {
        await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
        return next(e)
      }
    }
    const tree = await next(e)
    if (!hasSlot(tree)) {
      return tree
    }
    const { value: mood = 'idle' } = await $.state.get({ plugin: 'eidola', key: 'mood' })
    const { value: ink = 0 } = await $.state.get({ plugin: 'eidola', key: 'ink' })
    const { value: inkAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'inkAt' })
    const now = await $.clock.now()
    const els = $.ui.resolve(e) as unknown as Els
    try {
      return fill(tree, (columns, rows) => draw(els, { columns, rows, mood, isError: ink > 0 && now - inkAt < ERROR_MS })) as RenderElement
    } catch (error) {
      await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
      return tree
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const handoff = (e.props as { eidola?: Handoff }).eidola
    if (handoff) {
      if (handoff.engram !== ID) {
        return next(e)
      }
      const now = await $.clock.now()
      try {
        return draw($.ui.resolve(e) as unknown as Els, { columns: handoff.columns, rows: handoff.rows, mood: handoff.mood, isError: handoff.ink > 0 && now - handoff.inkAt < ERROR_MS })
      } catch (error) {
        await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
        return next(e)
      }
    }
    const tree = await next(e)
    if (!hasSlot(tree)) {
      return tree
    }
    const { value: mood = 'idle' } = await $.state.get({ plugin: 'eidola', key: 'mood' })
    const { value: ink = 0 } = await $.state.get({ plugin: 'eidola', key: 'ink' })
    const { value: inkAt = 0 } = await $.state.get({ plugin: 'eidola', key: 'inkAt' })
    const now = await $.clock.now()
    const els = $.ui.resolve(e) as unknown as Els
    try {
      return fill(tree, (columns, rows) => draw(els, { columns, rows, mood, isError: ink > 0 && now - inkAt < ERROR_MS })) as RenderElement
    } catch (error) {
      await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: FILE, stack: error instanceof Error ? error.stack : undefined })
      return tree
    }
  })
}
