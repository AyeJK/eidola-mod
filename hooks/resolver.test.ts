import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, HOLD, step } from './resolver'
import type { Model, Signal } from './resolver'
import { ANIMATIONS, compose, GRID, SPRITE_PALETTE, vesselSvg } from './sprite'

function run(signals: Signal[], from: Model = EMPTY) {
  let model = from
  const states: string[] = []
  const moods: string[] = []
  for (const s of signals) {
    const out = step(model, s)
    model = out.model
    states.push(out.view.state)
    moods.push(model.mood)
  }
  return { model, states, moods }
}

describe('mood', () => {
  test('a turn is working throughout, whatever its tools do, then idle', () => {
    const { moods } = run([
      { kind: 'prompt' },
      { kind: 'toolStart', tool: 'Read' },
      { kind: 'toolEnd', tool: 'Read', isOk: true },
      { kind: 'toolStart', tool: 'Bash' },
      { kind: 'toolEnd', tool: 'Bash', isOk: false },
      { kind: 'compact' },
      { kind: 'turnEnd', reason: 'answer' },
    ])
    expect(moods).toEqual(['working', 'working', 'working', 'working', 'working', 'working', 'idle'])
  })

  test('a permission ask needs attention until the tool goes on', () => {
    const { moods } = run([
      { kind: 'prompt' },
      { kind: 'toolStart', tool: 'Bash' },
      { kind: 'ask', tool: 'Bash' },
      { kind: 'toolEnd', tool: 'Bash', isOk: true },
    ])
    expect(moods).toEqual(['working', 'working', 'attention', 'working'])
  })

  test('a question or a plan to approve needs attention while it waits', () => {
    for (const tool of ['AskUserQuestion', 'ExitPlanMode']) {
      const { moods } = run([{ kind: 'prompt' }, { kind: 'toolStart', tool }, { kind: 'toolEnd', tool, isOk: true }])
      expect(moods, tool).toEqual(['working', 'attention', 'working'])
    }
  })

  test('every way a turn ends is idle', () => {
    for (const reason of ['answer', 'aborted', 'refusal', 'error'] as const) {
      expect(step({ ...EMPTY, mood: 'working' }, { kind: 'turnEnd', reason }).model.mood, reason).toBe('idle')
    }
  })
})

describe('resolver', () => {
  test('a prompt thinks, a tool works, the turn ends in success', () => {
    const { states } = run([
      { kind: 'prompt' },
      { kind: 'toolStart', tool: 'Bash' },
      { kind: 'toolEnd', tool: 'Bash', isOk: true },
      { kind: 'turnEnd', reason: 'answer' },
    ])
    expect(states).toEqual(['thinking', 'working', 'waiting', 'success'])
  })

  test('a text-only turn ends in responding', () => {
    const { states } = run([{ kind: 'prompt' }, { kind: 'turnEnd', reason: 'answer' }])
    expect(states).toEqual(['thinking', 'responding'])
  })

  test('parallel tools stay working until the last one finishes', () => {
    const { states, model } = run([
      { kind: 'toolStart', tool: 'Read' },
      { kind: 'toolStart', tool: 'Grep' },
      { kind: 'toolEnd', tool: 'Read', isOk: true },
      { kind: 'toolEnd', tool: 'Grep', isOk: true },
    ])
    expect(states).toEqual(['working', 'working', 'working', 'waiting'])
    expect(model.inFlight).toBe(0)
  })

  test('a failed tool shows error, then falls back to thinking', () => {
    const out = step({ mood: 'working', inFlight: 1, toolsThisTurn: 1 }, { kind: 'toolEnd', tool: 'Bash', isOk: false })
    expect(out.view.state).toBe('error')
    expect(out.then?.ms).toBe(HOLD.errorMs)
    expect(out.then?.view.state).toBe('thinking')
  })

  test('an approval ask needs attention', () => {
    expect(step(EMPTY, { kind: 'ask', tool: 'Bash' }).view.state).toBe('attention')
  })

  test('an aborted turn goes straight to idle', () => {
    expect(step(EMPTY, { kind: 'turnEnd', reason: 'aborted' }).view.state).toBe('idle')
  })
})

describe('sprite', () => {
  test('every frame of every state is a full grid', () => {
    for (const anim of Object.values(ANIMATIONS)) {
      for (const frame of anim.frames) {
        const grid = compose(frame)
        expect(grid.length).toBe(GRID)
        for (const row of grid) expect(row.length).toBe(GRID)
      }
    }
  })

  test('every state renders under the 131,072-character Svg limit', () => {
    for (const state of Object.keys(ANIMATIONS)) {
      const svg = vesselSvg(state as keyof typeof ANIMATIONS, SPRITE_PALETTE, 208)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.length < 131072).toBe(true)
    }
  })
})
