import { describe, expect, test } from 'claude-code/testing'
import type { PromptComposeSection, PromptSubmitInput } from 'claude-code'

import { servePackages } from './packages.data'

// Sprint 1.3 removed the Soul: Eidola is the visual companion only and adds
// nothing to the prompt, on either path. A typed prompt reaches the engine as
// it was typed, with no context beside it, and the system prompt is the
// engine's own, with no Eidola section, whichever Engram is awake or none.

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const
const PROMPT = 'Fix the failing build, then run the tests.'
/** The facts a system prompt is composed from. */
const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: ['Bash', 'Read'], outputStyle: null, traits: [] } as const
/** The engine's own system prompt, beneath the mod. */
const SECTIONS: PromptComposeSection[] = [
  { id: 'core:identity', text: 'You are Claude Code.', scope: 'shared' },
  { id: 'core:env', text: 'Working directory: /work', scope: 'session' },
]

for (const stored of ['kraken', 'lich', 'wisp', null] as const) {
  const who = stored ?? 'nothing'
  describe(`no Soul: with ${who} awake`, () => {
    test('prompt.submit passes the prompt through unchanged, and prompt.compose adds no Eidola section', async ($, on) => {
      servePackages(on)
      on('store.get', ($2, e) => ({ value: e.key === 'engram' ? stored : undefined }))
      on('store.set', () => ({ value: undefined }))
      on('ui.open', () => ({ value: { isPlaced: true as const } }))
      on('ui.panes', () => ({ value: [] }))
      on('ui.invalidate', () => ({ value: undefined }))
      on('ui.status', () => ({ value: undefined }))
      on('clock.now', () => ({ value: NOW }))
      on('command.register', ($2, e) => ({ value: { command: e.name } }))
      on('session.start', ($2, e) => ({ cwd: e.cwd }))
      // What reaches the engine beneath the mod.
      const submitted: PromptSubmitInput[] = []
      on('prompt.submit', ($2, e) => {
        submitted.push(e)
        return { text: e.text, context: e.context }
      })
      on('prompt.compose', () => ({ sections: SECTIONS }))

      await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
      const listed = (await $.command.run({ command: 'engrams', args: '', ...TYPED })).text ?? ''
      if (stored === null) {
        expect(listed).not.toContain('(awake)')
      } else {
        expect(listed).toContain(`${stored} (awake)`)
      }

      // A prompt typed at the composer, as the engine raises it.
      const entered = await $.prompt.submit({ text: PROMPT, wait: false, origin: { kind: 'composer' } })
      expect(submitted.length).toBe(1)
      expect(submitted[0]?.text).toBe(PROMPT)
      expect(submitted[0]?.context ?? []).toEqual([])
      expect(entered.text).toBe(PROMPT)
      expect(entered.context ?? []).toEqual([])
      expect(JSON.stringify(submitted)).not.toMatch(/eidola-soul|Active Engram/)

      const composed = await $.prompt.compose(COMPOSE)
      expect(composed.sections).toEqual(SECTIONS)
      expect(composed.sections.some(one => one.id.startsWith('eidola'))).toBe(false)
    })
  })
}
