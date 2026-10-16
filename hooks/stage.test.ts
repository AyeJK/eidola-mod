import { describe, expect, test } from 'claude-code/testing'

import { SVG_LIMIT, stageSize, stageSvg } from './stage'
import { SPRITE_PALETTE, vesselSvg } from './sprite'

const TALL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 43"><rect width="37" height="43"/></svg>'

describe('stage', () => {
  test('sizes to the body a cell short each way; inline stays short', () => {
    expect(stageSize(52, 76, 'dock')).toEqual({ width: 408, height: 1425 })
    expect(stageSize(52, 30, 'inline')).toEqual({ width: 408, height: 171 })
  })

  test('nests the Vessel by its viewBox, inside the stage', () => {
    const out = stageSvg(TALL, 'working', { width: 408, height: 1425 })
    expect(out).toBeDefined()
    expect(out!.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 408 1425"')).toBe(true)
    const nested = /<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*viewBox="0 0 37 43"/.exec(out!)
    expect(nested).not.toBeNull()
    const [x, y, w, h] = nested!.slice(1).map(Number) as [number, number, number, number]
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(408)
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y + h).toBeLessThanOrEqual(1425)
    // The width bound wins in a tall dock: 72% of it.
    expect(Math.round(w)).toBe(294)
  })

  test('every layer fades out before the edge', () => {
    const out = stageSvg(TALL, 'idle', { width: 300, height: 300 })!
    const stops = [...out.matchAll(/<radialGradient[^>]*>(.*?)<\/radialGradient>/g)].map(m => m[1] ?? '')
    expect(stops.length).toBe(3)
    for (const one of stops) {
      expect(one).toMatch(/stop-opacity="0"\/>$/)
    }
  })

  test('the wash and glow end inside the nearest edge, so no edge is tinted', () => {
    for (const size of [
      { width: 408, height: 1425 },
      { width: 140, height: 140 },
      { width: 760, height: 171 },
    ]) {
      const out = stageSvg(TALL, 'idle', size)!
      const wash = /translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+) ([\d.]+)\)/.exec(out)!
      const [cx, cy, rx, ry] = wash.slice(1).map(Number) as [number, number, number, number]
      expect(rx).toBeLessThanOrEqual(Math.min(cx, size.width - cx) + 0.1)
      expect(ry).toBeLessThanOrEqual(Math.min(cy, size.height - cy) + 0.1)
      const glow = /id="eds-glow" gradientUnits="userSpaceOnUse" cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/.exec(out)!
      expect(Number(glow[1])).toBeLessThanOrEqual(Math.min(rx, ry) + 0.1)
    }
  })

  test('the built-in sprite stages too: negative viewBox, its own size dropped', () => {
    const sprite = vesselSvg('thinking', SPRITE_PALETTE, 96)
    const out = stageSvg(sprite, 'thinking', { width: 400, height: 600 })!
    const nestedTag = /<svg x=[^>]*>/.exec(out)![0]
    expect(nestedTag).toContain('viewBox="0 -1 ')
    expect(nestedTag).not.toContain('width="96"')
  })

  test('no viewBox, or a result past the Svg limit, gives no stage', () => {
    expect(stageSvg('<svg width="10" height="10"></svg>', 'idle', { width: 300, height: 300 })).toBeUndefined()
    const huge = `<svg viewBox="0 0 10 10"><desc>${'x'.repeat(SVG_LIMIT)}</desc></svg>`
    expect(stageSvg(huge, 'idle', { width: 300, height: 300 })).toBeUndefined()
  })
})
