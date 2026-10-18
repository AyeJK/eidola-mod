// The Engram plugin checker (hooks/check-plugin.ts, run by
// scripts/check-engram.mjs) on the exported three and the 2.3 test plugin, as
// hooks/exports.data.ts holds them, and on broken copies of each: every
// problem it finds names the file and the fix.

import { describe, expect, test } from 'claude-code/testing'

import { checkEngramPlugin, formatReport, scannedLines } from './check-plugin'
import type { PluginReport } from './check-plugin'
import { PLUGINS } from './exports.data'

const BUNDLED = ['kraken', 'lich', 'wisp']
const NAMES = Object.keys(PLUGINS).sort()

function check(name: string, files: Record<string, string>): PluginReport {
  return checkEngramPlugin({ folder: name, files }, { bundled: BUNDLED })
}

/** A plugin's files, to break. */
function copy(name: string): Record<string, string> {
  return { ...PLUGINS[name]! }
}

/** The plugin's hooks module, as its hooks.json names it. */
function hooksModule(files: Record<string, string>): string {
  const first = (JSON.parse(files['hooks/hooks.json']!) as { modules: string[] }).modules[0]!
  return `hooks/${first.replace(/^\.\//, '')}`
}

/** The plugin's engram.json, parsed. */
function engram(files: Record<string, string>): Record<string, unknown> & { id: string; vessel: Record<string, unknown> } {
  return JSON.parse(files['engram.json']!)
}

/** Every finding names a file and says how to fix it. */
function namesFileAndFix(report: PluginReport): void {
  for (const one of [...report.errors, ...report.warnings]) {
    expect(one.file.length, JSON.stringify(one)).toBeGreaterThan(0)
    expect(one.problem.length, JSON.stringify(one)).toBeGreaterThan(0)
    expect(one.fix.length, JSON.stringify(one)).toBeGreaterThan(0)
  }
}

/** The report holds an error in `file` whose problem and fix match. */
function hasError(report: PluginReport, file: string, problem: RegExp, fix: RegExp): void {
  namesFileAndFix(report)
  const found = report.errors.find(one => one.file === file && problem.test(one.problem) && fix.test(one.fix))
  expect(found, `no error in ${file} like ${problem} / ${fix}; got ${JSON.stringify(report.errors)}`).toBeDefined()
}

describe('the checker on good Engram plugins', () => {
  test('the data holds the exported three and the 2.3 test plugin', () => {
    expect(NAMES).toEqual(['exported-kraken', 'exported-lich', 'exported-wisp', 'fixture'])
  })

  for (const name of NAMES) {
    test(`${name} passes: no error, no warning`, () => {
      const report = check(name, copy(name))
      expect(report.errors).toEqual([])
      expect(report.warnings).toEqual([])
      expect(report.id).toBe(name)
      const text = formatReport(report)
      expect(text.split('\n')[0]).toBe(`${name}: ok`)
      expect(text).toContain('draws: its own creature, remixed from')
      expect(text).toContain('all in the folder')
    })
  }

  test("an exported one draws with its own copy of its live drawing, and names nothing outside its folder", () => {
    for (const [name, live] of [
      ['exported-kraken', 'hooks/kraken-live.tsx'],
      ['exported-lich', 'hooks/lich-live.tsx'],
      ['exported-wisp', 'hooks/wisp-live.tsx'],
    ] as const) {
      const files = copy(name)
      expect(Object.keys(files)).toContain(live)
      expect(check(name, files).notes.join('\n')).toContain(`surface modules ${live}`)
      for (const [path, text] of Object.entries(files)) {
        expect(text, `${name}/${path}`).not.toMatch(/from '\.\.\//)
        expect(text, `${name}/${path}`).not.toMatch(/module="\.\.\//)
      }
    }
  })
})

describe('the checker on broken copies', () => {
  for (const name of NAMES) {
    describe(name, () => {
      test('the plugin manifest: missing, unparsable, nameless, or not depending on Eidola', () => {
        const gone = copy(name)
        delete gone['.claude-plugin/plugin.json']
        hasError(check(name, gone), '.claude-plugin/plugin.json', /no plugin manifest/, /Add \.claude-plugin\/plugin\.json/)

        const bad = copy(name)
        bad['.claude-plugin/plugin.json'] = '{ "name": "x", }'
        hasError(check(name, bad), '.claude-plugin/plugin.json', /doesn't parse/, /Fix the JSON/)

        const nameless = copy(name)
        nameless['.claude-plugin/plugin.json'] = JSON.stringify({ version: '0.1.0', dependencies: ['eidola'] })
        hasError(check(name, nameless), '.claude-plugin/plugin.json', /no name/, /kebab-case/)

        const alone = copy(name)
        alone['.claude-plugin/plugin.json'] = JSON.stringify({ name: 'x', version: '0.1.0' })
        hasError(check(name, alone), '.claude-plugin/plugin.json', /doesn't depend on Eidola/, /"dependencies": \["eidola"\]/)
      })

      test("engram.json through the validator: missing, a bundled id, another scene, a field it lacks", () => {
        const gone = copy(name)
        delete gone['engram.json']
        hasError(check(name, gone), 'engram.json', /no engram\.json/, /Add an engram\.json/)

        const taken = copy(name)
        taken['engram.json'] = JSON.stringify({ ...engram(taken), id: 'lich', remixOf: 'kraken' })
        hasError(check(name, taken), 'engram.json', /bundled Engram's id/, /new id/)

        const scene = copy(name)
        const json = engram(scene)
        scene['engram.json'] = JSON.stringify({ ...json, vessel: { ...json.vessel, scene: 'kraken' } })
        hasError(check(name, scene), 'engram.json', /vessel\.scene is "kraken"/, /Set vessel\.scene to "self"/)

        const rightless = copy(name)
        const { rights: _rights, ...rest } = engram(rightless)
        rightless['engram.json'] = JSON.stringify(rest)
        hasError(check(name, rightless), 'engram.json', /rights is missing/, /"original"/)
      })

      test('the thumbnails, against their limit and rules', () => {
        const json = engram(copy(name))
        const file = `vessel/${Object.values(json.vessel['thumbnails'] as Record<string, string>)[0]}`

        const big = copy(name)
        big[file] = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(20_000)}</svg>`
        hasError(check(name, big), file, /131,072/, /Simplify it/)

        const scripted = copy(name)
        scripted[file] = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        hasError(check(name, scripted), file, /<script>/, /Remove it/)

        const missing = copy(name)
        delete missing[file]
        hasError(check(name, missing), file, /isn't in the package/, /Add vessel\//)
      })

      test('the announce call: missing, or from no session.start hook', () => {
        const silent = copy(name)
        const module = hooksModule(silent)
        silent[module] = silent[module]!.replaceAll('$.eidola.announce', '$.eidola.ignore')
        hasError(check(name, silent), module, /never calls \$\.eidola\.announce/, /session\.start/)

        const startless = copy(name)
        startless[module] = startless[module]!.replaceAll("on('session.start'", "on('session.end'")
        hasError(check(name, startless), module, /no session\.start hook/, /on\('session\.start'/)
      })

      test('the drawing module: no hooks manifest, a module that is not there, no pane hook, the wrong id', () => {
        const unhooked = copy(name)
        delete unhooked['hooks/hooks.json']
        hasError(check(name, unhooked), 'hooks/hooks.json', /no hooks manifest/, /"modules": \["\.\/register\.tsx"\]/)

        const lost = copy(name)
        lost['hooks/hooks.json'] = '{ "modules": ["./creature.tsx"] }'
        hasError(check(name, lost), 'hooks/hooks.json', /no hooks\/creature\.tsx/, /Add hooks\/creature\.tsx/)

        const paneless = copy(name)
        const module = hooksModule(paneless)
        paneless[module] = paneless[module]!.replaceAll("component: 'Pane'", "component: 'Panel'")
        const isInPane = ((engram(paneless).vessel['shows'] as string[] | undefined) ?? ['pane']).includes('pane')
        if (isInPane) {
          hasError(check(name, paneless), module, /draws nothing in the pane/, /Add the pane hook/)
        } else {
          // Band only: no pane hook is needed.
          expect(check(name, paneless).errors).toEqual([])
        }
        const bandless = copy(name)
        bandless[module] = bandless[module]!.replaceAll("component: 'AbovePrompt'", "component: 'BelowPrompt'")
        const isInBand = ((engram(bandless).vessel['shows'] as string[] | undefined) ?? ['pane']).includes('band')
        if (isInBand) {
          hasError(check(name, bandless), module, /draws nothing in the band/, /Add the band hook/)
        } else {
          // Pane only: no band hook is needed.
          expect(check(name, bandless).errors).toEqual([])
        }

        const renamed = copy(name)
        renamed[module] = renamed[module]!.replace(/const ID = '[^']+'/, "const ID = 'someone-else'")
        hasError(check(name, renamed), module, /Its ID is "someone-else"/, new RegExp(`const ID = '${name}'`))

        const slotless = copy(name)
        slotless[module] = slotless[module]!.replaceAll('eidola-slot:', 'eidola-nothing:')
        const report = check(name, slotless)
        namesFileAndFix(report)
        expect(report.errors).toEqual([])
        expect(report.warnings.find(one => one.file === module && /never looks for its slot/.test(one.problem))).toBeDefined()
      })

      test("nothing reaches outside the folder: an import, a surface module, a package", () => {
        const files = copy(name)
        const module = hooksModule(files)
        // The drawing module where there is one beside the hooks, else the hooks module itself.
        const drawing = files['hooks/draw.tsx'] !== undefined ? 'hooks/draw.tsx' : module

        const reaching = copy(name)
        reaching[drawing] = `import { renderScene } from '../../../hooks/field'\n${reaching[drawing]}`
        hasError(check(name, reaching), drawing, /outside the plugin's folder/, /Copy that file into the plugin's hooks\//)

        const absent = copy(name)
        absent[drawing] = `import { gone } from './gone'\n${absent[drawing]}`
        hasError(check(name, absent), drawing, /"\.\/gone", which isn't in the plugin/, /Add the file/)

        const packaged = copy(name)
        packaged[drawing] = `import { merge } from 'lodash'\n${packaged[drawing]}`
        hasError(check(name, packaged), drawing, /"lodash", a package/, /import it by path/)

        const client = copy(name)
        const live = Object.keys(client).find(path => path.endsWith('-live.tsx'))
        if (live) {
          // An export: its live drawing left out of the folder.
          delete client[live]
        } else {
          client[drawing] = `${client[drawing]}\n// <Client key="creature" module="./creature.tsx" />\nconst creature = { module: './creature.tsx' }\n`
        }
        hasError(check(name, client), drawing, /surface module "\.\/[a-z-]+\.tsx", which isn't in the plugin/, /Add the surface module/)

        const outside = copy(name)
        outside[drawing] = `${outside[drawing]}\nconst far = { module: '../../../hooks/kraken-live.tsx' }\n`
        hasError(check(name, outside), drawing, /surface module "\.\.\/\.\.\/\.\.\/hooks\/kraken-live\.tsx", which is outside/, /Copy that surface module/)
      })

      test('what it must never do: prompt text, a transcript row, Eidola\'s state, a CLAUDE.md', () => {
        const module = hooksModule(copy(name))

        const prompting = copy(name)
        prompting[module] = `${prompting[module]}\nexport const more = (on: any) => on('prompt.submit', ($: any, e: any, next: any) => next(e))\n`
        hasError(check(name, prompting), module, /hooks prompt\.submit/, /Remove the prompt\.submit hook/)

        const appending = copy(name)
        appending[module] = `${appending[module]}\nexport const row = ($: any) => $.session.append({ text: 'hi' })\n`
        hasError(check(name, appending), module, /\$\.session\.append/, /Remove the call/)

        const writing = copy(name)
        writing[module] = `${writing[module]}\nexport const write = ($: any) => $.state.set({ plugin: 'eidola', key: 'mood', value: 'idle' })\n`
        hasError(check(name, writing), module, /writes Eidola's state/, /read the state with \$\.state\.get/)

        const hooking = copy(name)
        hooking[module] = `${hooking[module]}\nexport const hook = (on: any) => on('state.set', ($: any, e: any, next: any) => next(e))\n`
        hasError(check(name, hooking), module, /hooks state\.set/, /Remove the state\.set hook/)

        const persona = copy(name)
        persona['CLAUDE.md'] = 'You are a lich.'
        hasError(check(name, persona), 'CLAUDE.md', /prompt text/, /Delete CLAUDE\.md/)
      })
    })
  }
})

describe('the checker itself', () => {
  test('prints ok and what it found, or the problems, each with its file and fix', () => {
    const good = formatReport(check('exported-lich', copy('exported-lich')))
    expect(good).toMatch(/^exported-lich: ok\n {2}draws: its own creature, remixed from lich · shows pane \+ shrine\n/)
    expect(good).toMatch(/\n {2}thumbnails: pane \(largest [\d,]+ \/ 131,072\)/)

    const broken = copy('exported-lich')
    delete broken['.claude-plugin/plugin.json']
    const { rights: _rights, ...rightless } = engram(broken)
    broken['engram.json'] = JSON.stringify(rightless)
    const report = check('exported-lich', broken)
    const lines = formatReport(report).split('\n')
    expect(lines[0]).toBe('exported-lich: 2 problems')
    expect(lines[1]).toBe('2 errors:')
    for (const [i, one] of report.errors.entries()) {
      expect(lines[2 + i]).toBe(`  ${one.file}: ${one.problem} ${one.fix}`)
    }
  })

  test('never throws, whatever it is handed', () => {
    for (const given of [undefined, null, 7, 'plugin', { folder: 'x' }, { folder: 'x', files: [] }, { folder: 'x', files: { 'engram.json': '{' } }]) {
      const report = checkEngramPlugin(given)
      expect(report.errors.length).toBeGreaterThan(0)
      namesFileAndFix(report)
    }
  })

  test('a library file reads the same, to the checker, whole or as the lines it scans', () => {
    const whole = [
      '// A comment that mentions from "./nowhere" and module="./ghost.tsx" in prose.',
      "import { a } from './a'",
      'import {',
      '  b,',
      "} from '../../outside'",
      'export const C = 1',
      'const view = <Client key="x" module="./missing.tsx" />',
      "$.state.set({ plugin: 'eidola', key: 'mood', value: 'idle' })",
      'export default C',
    ].join('\n')
    const files = { ...copy('fixture'), 'hooks/lib.tsx': whole, 'hooks/a.ts': '' }
    const digest = { ...files, 'hooks/lib.tsx': scannedLines(whole) }
    expect(scannedLines(whole).split('\n').length).toBeLessThan(whole.split('\n').length)
    const a = check('fixture', files)
    const b = check('fixture', digest)
    expect(JSON.stringify({ errors: b.errors, warnings: b.warnings })).toBe(JSON.stringify({ errors: a.errors, warnings: a.warnings }))
    expect(a.errors.map(one => one.problem).join('\n')).toMatch(/outside the plugin's folder/)
    expect(a.errors.map(one => one.problem).join('\n')).toMatch(/"\.\/missing\.tsx", which isn't in the plugin/)
    expect(a.errors.map(one => one.problem).join('\n')).toMatch(/writes Eidola's state/)
  })
})
