// A test Engram plugin for Eidola, written to docs/spec/engram-plugin.md:
// a small creature, one face and colour per mood, that plays an error
// effect while Eidola's ink is fresh. It announces itself to Eidola, and
// draws inside Eidola's pane and band through the hand-off, from wherever
// its hooks sit in the chain. It writes none of Eidola's state and adds
// nothing to any prompt.
//
// Everything sits inside `register`, so Eidola's tests (hooks/handoff.test.ts)
// can load this very function as an inline plugin.

import type { Register, RenderElement } from 'claude-code'

export const register: Register = on => {
  /** This Engram's id: engram.json's. */
  const ID = 'fixture'
  /** The Box its drawing comes back in, and the slot Eidola leaves for it. */
  const SCENE = `eidola:${ID}`
  const SLOT = `eidola-slot:${ID}`
  /** How long the error effect plays after the ink rises, in ms. */
  const ERROR_MS = 2000

  type Mood = 'idle' | 'working' | 'attention'
  type Look = { face: string; colour: string; line: string }
  const LOOKS: Record<Mood | 'error', Look> = {
    idle: { face: '( o_o )', colour: '#4ad6c8', line: 'drifting' },
    working: { face: '( >_< )', colour: '#c9a84c', line: 'busy busy' },
    attention: { face: '( O_O )!', colour: '#ffcf3a', line: 'look here' },
    error: { face: '( x_x )', colour: '#ff3b3b', line: 'ouch' },
  }
  /** What the drawing needs: the room, the mood, and whether the error effect plays. */
  type Seen = { columns: number; rows: number; mood: Mood; isError: boolean }
  type Els = { Box: (props: Record<string, unknown>) => RenderElement; Text: (props: Record<string, unknown>) => RenderElement }

  /** The creature, `columns` × `rows`, in one Box keyed eidola:<id>. */
  const draw = (els: Els, seen: Seen): RenderElement => {
    const { Box, Text } = els
    const look = LOOKS[seen.isError ? 'error' : seen.mood] ?? LOOKS.idle
    const body = Math.max(1, Math.min(3, seen.rows - 2))
    return Box({
      key: SCENE,
      width: seen.columns,
      height: seen.rows,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      children: [
        Box({
          key: 'fixture-body',
          flexDirection: 'column',
          alignItems: 'center',
          borderStyle: 'round',
          borderColor: look.colour,
          children: [Text({ color: look.colour, bold: true, children: look.face }), ...(body > 1 ? [Text({ color: look.colour, children: look.line })] : [])],
        }),
      ],
    })
  }

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
  on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => {
    const handoff = (e.props as { eidola?: { engram: string; columns: number; rows: number; mood: Mood; ink: number; inkAt: number } }).eidola
    // Beneath Eidola: it asks, with the room and the state.
    if (handoff) {
      if (handoff.engram !== ID) {
        return next(e)
      }
      const now = await $.clock.now()
      try {
        return draw($.ui.resolve(e) as unknown as Els, { columns: handoff.columns, rows: handoff.rows, mood: handoff.mood, isError: handoff.ink > 0 && now - handoff.inkAt < ERROR_MS })
      } catch (error) {
        await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: 'hooks/register.tsx', stack: error instanceof Error ? error.stack : undefined })
        return next(e)
      }
    }
    // Above Eidola: its tree comes back from next, with a slot to fill.
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
      await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: 'hooks/register.tsx', stack: error instanceof Error ? error.stack : undefined })
      return tree
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const handoff = (e.props as { eidola?: { engram: string; columns: number; rows: number; mood: Mood; ink: number; inkAt: number } }).eidola
    if (handoff) {
      if (handoff.engram !== ID) {
        return next(e)
      }
      const now = await $.clock.now()
      try {
        return draw($.ui.resolve(e) as unknown as Els, { columns: handoff.columns, rows: handoff.rows, mood: handoff.mood, isError: handoff.ink > 0 && now - handoff.inkAt < ERROR_MS })
      } catch (error) {
        await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: 'hooks/register.tsx', stack: error instanceof Error ? error.stack : undefined })
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
      await $.eidola.fault({ engram: ID, message: error instanceof Error ? error.message : String(error), file: 'hooks/register.tsx', stack: error instanceof Error ? error.stack : undefined })
      return tree
    }
  })
}
