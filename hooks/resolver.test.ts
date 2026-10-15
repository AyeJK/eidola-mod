import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, HOLD, step } from './resolver'
import type { Model, Signal } from './resolver'
import { ANIMATIONS, compose, GRID, vesselSvg } from './sprite'
import { ENGRAMS } from './engrams'

function run(signals: Signal[], from: Model = EMPTY) {
  let model = from
  const states: string[] = []
  for (const s of signals) {
    const out = step(model, s)
    model = out.model
    states.push(out.view.state)
  }
  return { model, states }
}

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
    const out = step({ inFlight: 1, toolsThisTurn: 1 }, { kind: 'toolEnd', tool: 'Bash', isOk: false })
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
    for (const engram of Object.values(ENGRAMS)) {
      for (const state of Object.keys(ANIMATIONS)) {
        const svg = vesselSvg(state as keyof typeof ANIMATIONS, engram.vessel.palette, 208)
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.length < 131072).toBe(true)
      }
    }
  })
})
