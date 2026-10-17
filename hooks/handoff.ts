// The hand-off to an Engram plugin (docs/spec/engram-plugin.md): what Eidola
// asks for, how it judges the drawing that comes back, and the keys both
// sides use. Pure: no `$`; register.tsx makes the calls.
//
// Eidola draws its frame, HUD and corner around a slot. The awake Engram's
// plugin fills the slot from wherever its hooks sit in the chain:
//   - beneath Eidola (it loaded after): Eidola's `next` reaches it with
//     `e.props.eidola` set, and it answers a Box keyed `eidola:<id>`;
//   - above Eidola (it loaded first): it calls `next` itself, finds the Box
//     keyed `eidola-slot:<id>` in Eidola's tree, and puts its drawing there.

import type { RenderElement, TraceEntry } from 'claude-code'

import type { EidolaContract } from '../types'
import { BOX_BUDGET } from './live-pixels'

/** The public contract's version: types/index.d.ts and docs/spec/engram-plugin.md. */
export const CONTRACT: EidolaContract = 1

/** Most blocks (elements) one drawing may hold: the live drawings' own budget. */
export const BLOCK_BUDGET = BOX_BUDGET

/** How long a plugin's drawing beneath Eidola may take, its own hooks' time, before it falls back. */
export const DRAW_BUDGET_MS = 250

/** The key of the Box an Engram plugin's drawing comes back in. */
export function sceneKey(id: string): string {
  return `eidola:${id}`
}

/** The key of the slot Eidola leaves for a plugin above it to fill. */
export function slotKey(id: string): string {
  return `eidola-slot:${id}`
}

/** The key of the slot once the Engram is marked not loading: no plugin fills it. */
export function fallbackKey(id: string): string {
  return `eidola-fallback:${id}`
}

/** Why an Engram is marked not loading: the file, the line when known, and the problem. */
export type Fault = { file: string; line?: number; problem: string }

/** A fault as one line: `hooks/register.tsx:12: it threw.` */
export function faultLine(fault: Fault): string {
  return `${fault.file}${fault.line === undefined ? '' : `:${fault.line}`}: ${fault.problem}`
}

/** The line an error's stack names first (`at draw (hooks/creature.tsx:12:5)`), if any. */
export function lineOf(stack: unknown): number | undefined {
  if (typeof stack !== 'string') {
    return undefined
  }
  const found = /:(\d+):\d+\)?\s*$/m.exec(stack.split('\n').find(line => /:\d+:\d+\)?\s*$/.test(line)) ?? '')
  return found ? Number(found[1]) : undefined
}

/** How many elements a tree holds, itself included; strings are free. */
export function countBlocks(node: unknown): number {
  if (node === null || typeof node !== 'object') {
    return 0
  }
  const children = (node as { children?: unknown }).children
  let n = 1
  if (Array.isArray(children)) {
    for (const child of children) {
      n += countBlocks(child)
    }
  } else if (children !== undefined) {
    n += countBlocks(children)
  }
  return n
}

/** The key a tree's root carries, if it is an element with one. */
export function keyOf(node: unknown): string | undefined {
  if (node === null || typeof node !== 'object') {
    return undefined
  }
  const key = (node as { props?: { key?: unknown } }).props?.key
  return typeof key === 'string' ? key : undefined
}

/** One link of the chain beneath Eidola, as much of `next.trace` as the judge reads. */
export type Link = Pick<TraceEntry, 'plugin' | 'outcome'> & Partial<Pick<TraceEntry, 'ms'>>

/** What the judge is handed: the Engram, what came back from beneath, and how. */
export type Asked = {
  engram: string
  /** The plugin's name, as its plugin.json gives it. */
  plugin: string
  /** Its hooks module, relative to its folder: where a throw is reported. */
  module: string
  got: unknown
  trace: readonly Link[]
  /** The whole `next()` chain's time, every plugin beneath Eidola included. */
  tookMs: number
}

/**
 * How long the Engram's own plugin took: its links' own time, which the
 * trace gives with their `next()` calls taken out, so a slow plugin elsewhere
 * in the chain isn't counted against it. Where its plugin isn't in the trace
 * by name (or a link has no time), the whole chain's.
 */
export function ownMs(mine: readonly Link[], tookMs: number): number {
  return mine.length > 0 && mine.every(link => typeof link.ms === 'number') ? mine.reduce((sum, link) => sum + (link.ms ?? 0), 0) : tookMs
}

/**
 * The drawing to place, a fault, or neither (nothing beneath answered: the
 * plugin's hooks sit above Eidola, so the slot is left for it to fill).
 */
export type Verdict = { tree: RenderElement } | { fault: Fault } | { slot: true }

export function judge(asked: Asked): Verdict {
  const { engram, plugin, module, got, trace, tookMs } = asked
  const at = sceneKey(engram)
  const mine = plugin ? trace.filter(link => link.plugin === plugin) : []
  if (keyOf(got) === at) {
    const blocks = countBlocks(got)
    if (blocks > BLOCK_BUDGET) {
      return { fault: { file: module, problem: `its drawing holds ${blocks} blocks, over the ${BLOCK_BUDGET} a drawing may hold.` } }
    }
    const took = ownMs(mine, tookMs)
    if (took > DRAW_BUDGET_MS) {
      return { fault: { file: module, problem: `its drawing took ${Math.round(took)} ms, over the ${DRAW_BUDGET_MS} ms a drawing may take.` } }
    }
    return { tree: got as RenderElement }
  }
  if (mine.length === 0) {
    return { slot: true }
  }
  if (mine.some(link => link.outcome === 'expired')) {
    return { fault: { file: module, problem: 'its ui.render hook ran out of time.' } }
  }
  if (mine.some(link => link.outcome === 'skipped' || link.outcome === 'kept' || link.outcome === 'rejected' || link.outcome === 'caught')) {
    return { fault: { file: module, problem: 'its ui.render hook threw.' } }
  }
  return { fault: { file: module, problem: `it drew nothing Eidola can place: its drawing must be one Box keyed "${at}".` } }
}
