// Event -> Vessel state resolver. Pure: no `$`, no timers. The rules are in
// docs/spec/vessel-states.md: the nine states, the three moods, and the
// error effect, driven by engine events.

import type { Mood, VesselView } from '../types'

export type Model = {
  /**
   * What the drawings follow. Working from a prompt to the turn's end,
   * through every tool and gap; attention while blocked on the person;
   * idle otherwise. Tools never change it, so it holds steady.
   */
  mood: Mood
  /** Tool calls running right now (parallel tools keep `working` steady). */
  inFlight: number
  /** Tool calls since the turn began: decides `success` vs `responding`. */
  toolsThisTurn: number
}

export type TurnEndReason = 'answer' | 'aborted' | 'refusal' | 'error'

export type Signal =
  | { kind: 'session' }
  | { kind: 'prompt' }
  | { kind: 'turnStart' }
  | { kind: 'toolStart'; tool: string }
  | { kind: 'toolEnd'; tool: string; isOk: boolean }
  | { kind: 'ask'; tool: string }
  | { kind: 'compact' }
  | { kind: 'turnEnd'; reason: TurnEndReason }

export type Step = {
  model: Model
  /** Shown now. */
  view: VesselView
  /** Shown after `ms` unless another signal arrives first. */
  then?: { ms: number; view: VesselView }
}

/** Timings, from vessel.yaml's `playback` defaults. */
export const HOLD = {
  waitingMs: 900,
  errorMs: 1800,
  successMs: 3000,
  turnErrorMs: 4000,
} as const

export const EMPTY: Model = { mood: 'idle', inFlight: 0, toolsThisTurn: 0 }

/** Tools whose call waits on the person's answer: a question, a plan to approve. */
export const ASKING_TOOLS: ReadonlySet<string> = new Set(['AskUserQuestion', 'ExitPlanMode'])

const IDLE: VesselView = { state: 'idle', detail: '' }
const THINKING: VesselView = { state: 'thinking', detail: '' }

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function working(tool: string, inFlight: number): VesselView {
  return {
    state: 'working',
    detail: inFlight > 1 ? `${tool} · ${inFlight} running` : tool,
  }
}

export function step(model: Model, signal: Signal): Step {
  switch (signal.kind) {
    case 'session':
      return { model: EMPTY, view: IDLE }

    case 'prompt':
    case 'turnStart':
      return { model: { mood: 'working', inFlight: 0, toolsThisTurn: 0 }, view: THINKING }

    case 'toolStart': {
      const next: Model = {
        mood: ASKING_TOOLS.has(signal.tool) ? 'attention' : 'working',
        inFlight: model.inFlight + 1,
        toolsThisTurn: model.toolsThisTurn + 1,
      }
      return { model: next, view: working(signal.tool, next.inFlight) }
    }

    case 'toolEnd': {
      const next: Model = { ...model, mood: 'working', inFlight: Math.max(0, model.inFlight - 1) }
      if (!signal.isOk) {
        return {
          model: next,
          view: { state: 'error', detail: `${signal.tool} failed` },
          then: { ms: HOLD.errorMs, view: THINKING },
        }
      }
      if (next.inFlight > 0) {
        return { model: next, view: working(signal.tool, next.inFlight) }
      }
      return {
        model: next,
        view: { state: 'waiting', detail: `${signal.tool} done` },
        then: { ms: HOLD.waitingMs, view: THINKING },
      }
    }

    case 'ask':
      return {
        model: { ...model, mood: 'attention' },
        view: { state: 'attention', detail: `${signal.tool} needs your OK` },
      }

    case 'compact':
      return { model: { ...model, mood: 'working' }, view: { state: 'attention', detail: 'Compacting' } }

    case 'turnEnd': {
      const next: Model = { mood: 'idle', inFlight: 0, toolsThisTurn: model.toolsThisTurn }
      if (signal.reason === 'aborted') {
        return { model: next, view: IDLE }
      }
      if (signal.reason === 'error' || signal.reason === 'refusal') {
        return {
          model: next,
          view: { state: 'error', detail: 'Turn ended in an error' },
          then: { ms: HOLD.turnErrorMs, view: IDLE },
        }
      }
      const view: VesselView =
        model.toolsThisTurn > 0
          ? { state: 'success', detail: plural(model.toolsThisTurn, 'tool call') }
          : { state: 'responding', detail: 'Replied' }
      return { model: next, view, then: { ms: HOLD.successMs, view: IDLE } }
    }
  }
}
