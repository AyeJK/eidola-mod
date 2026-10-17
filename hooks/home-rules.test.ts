// Where the Eidola skill's scripts write (hooks/home-rules.ts): which Engram
// home scripts/engram-home.mjs uses and why, that a home or an export inside
// Eidola's folder is refused, and that scripts/export-engram.mjs writes under
// the mod's test/ only with --fixture. The scripts resolve symlinks
// (realpath) before asking these rules; the kit reads no disk, so that step
// is checked by hand (a junction into hooks/ is refused), not here.

import { describe, expect, test } from 'claude-code/testing'

import { EVAL_MARKER, chooseHome, exportRefusal, homeRefusal, isInside } from './home-rules'

const DEFAULT = '/home/ana/.claude/eidola'
const ROOT = '/home/ana/.claude/plugins/cache/eidola-mod/eidola/0.7.0'
const WIN_ROOT = 'C:\\Users\\Ana\\.claude\\plugins\\cache\\eidola-mod\\eidola\\0.7.0'

describe('the Engram home', () => {
  test('--home, then EIDOLA_HOME, then EVAL_EIDOLA_HOME, then the default', () => {
    const all = { flag: '/a', eidolaHome: '/b', evalHome: '/c', defaultHome: DEFAULT }
    expect(chooseHome(all)).toEqual({ home: '/a', source: '--home', base: undefined })
    expect(chooseHome({ ...all, flag: undefined })).toEqual({ home: '/b', source: 'EIDOLA_HOME', base: undefined })
    expect(chooseHome({ ...all, flag: undefined, eidolaHome: '' })).toEqual({ home: '/c', source: 'EVAL_EIDOLA_HOME', base: undefined })
  })

  test('the default is never taken silently: it comes with a notice naming it and why', () => {
    const choice = chooseHome({ defaultHome: DEFAULT, eidolaHome: '  ' })
    expect(choice.source).toBe('default')
    expect(choice.home).toBe(DEFAULT)
    expect(choice.refusal).toBeUndefined()
    expect(choice.notice).toBe(`eidola: using the default Engram home, ${DEFAULT} (no --home, EIDOLA_HOME or EVAL_EIDOLA_HOME given)`)
  })

  test("inside an eval's workspace, the default is refused: a missing EVAL_EIDOLA_HOME fails loudly", () => {
    const choice = chooseHome({ defaultHome: DEFAULT, evalMarkerDir: '/tmp/claude-eval-1/work' })
    expect(choice.refusal).toContain(`/tmp/claude-eval-1/work holds ${EVAL_MARKER}`)
    expect(choice.refusal).toContain('Nothing was written')
    expect(choice.refusal).toContain('EVAL_EIDOLA_HOME')
  })

  test("inside an eval's workspace, a given home is read from the workspace's top", () => {
    expect(chooseHome({ defaultHome: DEFAULT, evalHome: 'eidola-home', evalMarkerDir: '/tmp/claude-eval-1/work' })).toEqual({
      home: 'eidola-home',
      source: 'EVAL_EIDOLA_HOME',
      base: '/tmp/claude-eval-1/work',
    })
  })

  test("a home inside Eidola's folder is refused; one beside it is not", () => {
    expect(homeRefusal(ROOT, `${ROOT}/engrams`)).toContain("is inside Eidola's own folder")
    expect(homeRefusal(ROOT, ROOT)).toContain("is inside Eidola's own folder")
    expect(homeRefusal(ROOT, DEFAULT)).toBeUndefined()
    // A sibling whose name starts the same is not inside.
    expect(homeRefusal(ROOT, `${ROOT}-mine`)).toBeUndefined()
  })

  test('Windows paths compare without regard to case or slash direction', () => {
    expect(isInside(WIN_ROOT, 'c:/users/ana/.claude/plugins/cache/eidola-mod/eidola/0.7.0/hooks')).toBe(true)
    expect(isInside(WIN_ROOT, 'C:\\Users\\Ana\\.claude\\eidola')).toBe(false)
    expect(isInside('/Home/ana', '/home/ana/x')).toBe(false)
  })
})

describe('where an export may land', () => {
  test("outside Eidola's folder: anywhere", () => {
    expect(exportRefusal(ROOT, `${DEFAULT}/engrams/frost-lich`, false)).toBeUndefined()
  })

  test("inside Eidola's folder: refused, test/ included, unless --fixture", () => {
    expect(exportRefusal(ROOT, `${ROOT}/hooks/x`, false)).toContain('is inside the Eidola mod')
    expect(exportRefusal(ROOT, `${ROOT}/hooks/x`, true)).toContain('is inside the Eidola mod')
    expect(exportRefusal(ROOT, ROOT, true)).toContain('is inside the Eidola mod')
    expect(exportRefusal(ROOT, `${ROOT}/test`, true)).toContain('is inside the Eidola mod')
    expect(exportRefusal(ROOT, `${ROOT}/test/fixtures/exported-lich`, false)).toContain('only with --fixture')
    expect(exportRefusal(ROOT, `${ROOT}/test/fixtures/exported-lich`, true)).toBeUndefined()
  })
})
