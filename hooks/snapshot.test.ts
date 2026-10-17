import { describe, expect, test } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'
import type { Engine, Mounted } from 'claude-code/testing'

import { servePackages } from './packages.data'
import { SNAPSHOTS } from './snapshot.data'

// Snapshots of the three kept Engrams (the Kraken, the Lich and the Wisp) as
// 0.6.0 draws them: their picker cards and thumbnails, their pane and band in
// each mood, the view while nothing is awake, and where each appears under
// the surfaces switches (Sprint 1.5's, in place of 0.6.0's `placement`). Each is read from what the mod draws and answers,
// never from its modules, so moving the Engrams' data or files leaves them as
// they are. The five others (Spirit, Skull, Moon, Sigil, Starfield) are left
// out of every one.
//
// The test kit has no snapshot store, so they live in snapshot.data.ts, one
// entry per snapshot, each named for its Engram. One that differs fails, its
// message holding its new value on a line of its own, `SNAPSHOT <name> <value>`:
// when the change is meant, put that value in place of the entry.

const NOW = 1_760_000_000_000
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

/** The kept Engrams. */
const KEPT = ['kraken', 'lich', 'wisp'] as const
type Kept = (typeof KEPT)[number]
const MOODS = ['idle', 'working', 'attention'] as const
/**
 * The switch combinations that matter, by name: the defaults (0.6.0's
 * `default` and `auto`), hide off (its `both`), Band off (its `pane`),
 * Pane off (its `band`), and Pane off with hide off.
 */
const SETTINGS = {
  'pane on, band on, hide on': {},
  'pane on, band on, hide off': { hideBandWhilePaneOpen: false },
  'pane on, band off': { band: false },
  'pane off, band on, hide on': { pane: false },
  'pane off, band on, hide off': { pane: false, hideBandWhilePaneOpen: false },
} as const

const PANE_PROPS = { title: 'Eidola', isFocused: false, bodyColumns: 52, placement: 'dock', scroll: { offset: 0, bodyRows: 76 }, view: {} } as const
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } as const
const SURFACES = ['desktop', 'terminal'] as const
type Surface = (typeof SURFACES)[number]

/**
 * The files a kept Engram reads, by Engram and file name, with each one's
 * viewBox. The kit reads no disk, so each is answered with a stand-in still of
 * that viewBox titled with its name: a snapshot then says which file it drew,
 * wherever the file lives.
 */
const STILLS: Record<string, string> = {
  'kraken/thumb-pane.svg': '0 0 960 722',
  'kraken/thumb-band.svg': '0 0 1200 304',
  'lich/thumb-pane.svg': '0 0 480 361',
  'lich/thumb-band.svg': '0 0 720 190',
  'wisp/thumb-band.svg': '0 0 720 171',
}

function standIn(name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${STILLS[name]}"><title>${name}</title></svg>`
}

/** `kraken/thumb-pane.svg` for any path whose folders name a kept Engram, else undefined. */
function stillName(path: string): string | undefined {
  const parts = path.split(/[\\/]+/)
  const file = parts[parts.length - 1] ?? ''
  for (let i = parts.length - 2; i >= 0; i -= 1) {
    const name = `${parts[i]}/${file}`
    if (STILLS[name] !== undefined) {
      return name
    }
  }
  return undefined
}

/**
 * The engine around the mod: the Engram `stored` as the one awake when the
 * session starts (null: none), panes that open placed, the clock fixed, the
 * bundled packages' manifests served, and the kept Engrams' thumbnails
 * answered with their stand-ins. `pane.isPlaced` is
 * whether the pane list says the pane is placed, for the band's `auto`.
 */
function engine(on: On, stored: Kept | null) {
  const pane = { isPlaced: false, opened: [] as string[] }
  servePackages(on, path => {
    const name = stillName(path)
    if (!name) {
      throw new Error(`no such file: ${path}`)
    }
    return standIn(name)
  })
  on('ui.open', ($, e) => {
    pane.opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.panes', (): { value: UiPane[] } => ({
    value: pane.opened.length ? [{ id: 'eidola', title: 'Eidola', isShown: pane.isPlaced, isFocused: false, isPlaced: pane.isPlaced }] : [],
  }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  // What the engine draws in the band when the mod passes it on: an empty Box.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('store.get', ($, e) => ({ value: e.key === 'engram' ? stored : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.now', () => ({ value: NOW }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return pane
}

async function startSession($: Engine): Promise<void> {
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
}

function mountPane($: Engine, surface: Surface) {
  return $.ui.mount({ plugin: 'eidola', surface, component: 'Pane', requestId: 'eidola', props: PANE_PROPS })
}

function mountBand($: Engine, surface: Surface) {
  return $.ui.mount({ plugin: 'eidola', surface, component: 'AbovePrompt', props: BAND_PROPS })
}

/** FNV-1a over the string's UTF-16 code units, as 8 hex digits. */
function fnv(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** A long string (an SVG's source) as its length and hash, and the stand-in files it holds. */
function short(text: string): string {
  if (text.length <= 120) {
    return text
  }
  const held = Object.keys(STILLS).filter(name => text.includes(`<title>${name}</title>`))
  return `[${text.length} chars #${fnv(text)}${held.length ? ` holding ${held.join(', ')}` : ''}]`
}

function plain(value: unknown): unknown {
  if (typeof value === 'string') {
    return short(value)
  }
  if (Array.isArray(value)) {
    return value.map(plain)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}

/**
 * A drawn tree as lines, one per element, indented by depth: its type, `#key`,
 * and its props (a Client's props among them), long strings shortened.
 */
function outline(node: unknown, depth = 0, out: string[] = []): string[] {
  const pad = '  '.repeat(depth)
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(pad + JSON.stringify(short(String(node))))
  } else if (Array.isArray(node)) {
    node.forEach(child => outline(child, depth, out))
  } else if (node && typeof node === 'object') {
    const el = node as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
    const { key, ...props } = el.props ?? {}
    const shown = Object.keys(props).length ? ` ${JSON.stringify(plain(props))}` : ''
    out.push(`${pad}${el.type}${key === undefined ? '' : `#${String(key)}`}${shown}`)
    for (const child of el.children ?? []) {
      outline(child, depth + 1, out)
    }
  }
  return out
}

/** Every string in a drawn tree, in document order. */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') {
    out.push(node)
  } else if (Array.isArray(node)) {
    node.forEach(child => texts(child, out))
  } else if (node && typeof node === 'object') {
    texts((node as { children?: unknown[] }).children ?? [], out)
  }
  return out
}

/** Checks a value against its stored snapshot; the failure of one that differs carries its new value. */
function snap(name: string, value: unknown): void {
  const actual = JSON.parse(JSON.stringify(value)) as unknown
  expect(actual, `snapshot "${name}" differs. Its new value:\nSNAPSHOT ${JSON.stringify(name)} ${JSON.stringify(actual)}\n`).toEqual(SNAPSHOTS[name])
}

/** Opens the picker from the desktop pane's corner triangle. */
async function openPicker(pane: Pick<Mounted<'desktop', 'Pane'>, 'pointer'>): Promise<void> {
  await pane.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'frame-corner' })
}

/** Picks a Surface in the picker's dropdown: its trigger, then the option. */
async function pickSurface(pane: Pick<Mounted<'desktop', 'Pane'>, 'pointer'>, surface: 'all' | 'pane' | 'band'): Promise<void> {
  await pane.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'filter-toggle:surface' })
  await pane.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: `filter-option:surface:${surface}` })
}

/** The alt of each Svg under `node`, in order. */
function alts(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach(child => alts(child, out))
  } else if (node && typeof node === 'object') {
    const el = node as { type?: string; props?: { alt?: unknown }; children?: unknown[] }
    if (el.type === 'Svg' && typeof el.props?.alt === 'string') {
      out.push(el.props.alt)
    }
    alts(el.children ?? [], out)
  }
  return out
}

describe('snapshot: picker cards', () => {
  test('each kept Engram\'s card, where it is listed, and their order among themselves', async ($, on) => {
    engine(on, null)
    await startSession($)
    const pane = await mountPane($, 'desktop')
    await openPicker(pane)

    const listed = async () => {
      const cards = await pane.findAll({ type: 'Box' })
      return cards.map(card => /^card:(.+)$/.exec(String(card.key))?.[1]).filter((id): id is Kept => (KEPT as readonly string[]).includes(id ?? ''))
    }
    snap('cards: order of the kept Engrams', await listed())

    const under: Record<Kept, string[]> = { kraken: [], lich: [], wisp: [] }
    for (const filter of ['all', 'pane', 'band'] as const) {
      await pickSurface(pane, filter)
      for (const id of await listed()) {
        under[id].push(filter)
      }
    }
    await pickSurface(pane, 'all')

    for (const id of KEPT) {
      const card = await pane.find({ type: 'Box', key: `card:${id}` })
      // Its name, drawn large (the Svg after its still); what it is, the card's one text.
      const name = alts(card?.children ?? [])[1]
      const [description] = texts(card?.children ?? [])
      // Its button: a label drawn by pill.tsx, keyed by what it does.
      const button = (await pane.findAll({ type: 'Client' })).find(one => String(one.key).endsWith(`:${id}`) && /pill\.tsx$/.test(String(one.props?.module)))
      const label = (button?.props?.props as { label?: string } | undefined)?.label
      snap(`card: ${id}`, { id, name, description, button: { key: button?.key, label }, listedUnder: under[id] })
    }
    await pane.unmount()
  })
})

describe('snapshot: picker thumbnails', () => {
  // A card shows its Engram where it draws: the pane view (ten rows tall) for
  // one that shows in a pane, the band view (four rows) for one that shows
  // only in the band. A docked pane lays the cards two to a row; a narrow one,
  // one to a row and wider.
  for (const [layout, bodyColumns] of [
    ['docked pane, two cards a row', 52],
    ['narrow pane, one card a row', 32],
  ] as const) {
    test(`each kept Engram's thumbnail in a ${layout}`, async ($, on) => {
      engine(on, null)
      await startSession($)
      const pane = await $.ui.mount({ plugin: 'eidola', surface: 'desktop', component: 'Pane', requestId: 'eidola', props: { ...PANE_PROPS, bodyColumns } })
      await openPicker(pane)
      for (const id of KEPT) {
        // The card's first child holds the still's rows in the flow; its second
        // is the still, laid over them and bleeding past the card's inset.
        type Drawn = { props?: Record<string, unknown>; children?: Drawn[] }
        const card = await pane.find({ type: 'Box', key: `card:${id}` })
        const [spacer, layer] = (card?.children ?? []) as Drawn[]
        const svg = layer?.children?.[0]
        snap(`thumbnail: ${id}, ${layout}`, {
          rows: spacer?.props?.height,
          alt: svg?.props?.alt,
          width: svg?.props?.width,
          height: svg?.props?.height,
          source: svg?.props?.source,
        })
      }
      await pane.unmount()
    })
  }
})

describe('snapshot: the pane and band in each mood', () => {
  // Desktop draws the scenes (the Kraken's water under its live Client, the
  // Lich's dark under its four slices, the Wisp's fen under its own); the
  // terminal draws the face. The band is drawn with the pane not placed, so
  // `auto` shows it. The Wisp draws only in the band: its desktop pane is the
  // picker, covered by the card and thumbnail snapshots.
  for (const id of KEPT) {
    for (const mood of MOODS) {
      test(`the ${id}, ${mood}`, async ($, on) => {
        engine(on, id)
        await startSession($)
        expect((await $.command.run({ command: 'eidola', args: `mood ${mood}`, ...TYPED })).text).toContain(`Mood: ${mood}.`)
        for (const surface of SURFACES) {
          if (!(id === 'wisp' && surface === 'desktop')) {
            const pane = await mountPane($, surface)
            snap(`scene: ${id}, ${mood}, ${surface} pane`, outline(await pane.drawn()))
            await pane.unmount()
          }
          const band = await mountBand($, surface)
          snap(`scene: ${id}, ${mood}, ${surface} band`, outline(await band.drawn()))
          await band.unmount()
        }
      })
    }
  }
})

describe('snapshot: nothing awake', () => {
  // The resting Wisp's scene, dimmed, where its sleeping frame drew until
  // Sprint 1.3 changed this view on purpose (removal.test.ts tests it).
  test('the pane and band while no Engram is awake', async ($, on) => {
    engine(on, null)
    await startSession($)
    for (const surface of SURFACES) {
      const pane = await mountPane($, surface)
      snap(`nothing awake: ${surface} pane`, outline(await pane.drawn()))
      await pane.unmount()
      const band = await mountBand($, surface)
      snap(`nothing awake: ${surface} band`, outline(await band.drawn()))
      await band.unmount()
    }
  })
})

describe('snapshot: placement', () => {
  // Where each kept Engram appears under each switch combination: the
  // switches as `/eidola place` reads them, whether the pane opens by itself
  // at session start, what the desktop pane shows once open (by itself, or
  // when `/eidola` asks for it), and whether the band draws with the pane
  // placed and not.
  //
  // 0.6.0's band-only bug is fixed here: under `both`, `pane` and `auto` it
  // opened the pane at session start over the band-only Wisp, which showed
  // the picker there. Now the Wisp never opens the pane by itself, and the
  // pane, asked for, draws its band view. As in 0.6.0, the band-only Wisp
  // keeps its band while the pane is open; only an Engram that shows in the
  // pane hides its band for it.
  for (const id of KEPT) {
    for (const [setting, options] of Object.entries(SETTINGS)) {
      test(`the ${id} with ${setting}`, { options }, async ($, on) => {
        const pane = engine(on, id)
        // A terminal session, so /eidola place prints its switches: on the desktop it opens a screen in the pane instead.
        on('session.surfaces', () => ({ value: ['terminal' as const] }))
        on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '' } }))
        await startSession($)
        const place = (await $.command.run({ command: 'eidola', args: 'place', ...TYPED })).text
        const paneOpensAtStart = pane.opened.includes('eidola')
        if (!paneOpensAtStart) {
          await $.command.run({ command: 'eidola', args: '', ...TYPED })
        }
        const drawn = await mountPane($, 'desktop')
        const paneShows = (await drawn.find({ type: 'Button', key: `awaken:${id === 'wisp' ? 'kraken' : 'wisp'}` }))
          ? 'the picker'
          : (await drawn.find({ type: 'Client', key: 'wisp-band' }))
            ? 'the band view'
            : 'the pane view'
        await drawn.unmount()
        const bandDraws = async (isPlaced: boolean) => {
          pane.isPlaced = isPlaced
          const band = await mountBand($, 'desktop')
          // Nothing of the mod's: the hook passed the band on to the engine.
          const draws = (await band.findAll({ type: 'Svg' })).length > 0
          await band.unmount()
          return draws
        }
        snap(`placement: ${id}, ${setting}`, {
          surfaces: /^Surfaces: (.+)\.$/m.exec(place ?? '')?.[1],
          paneOpensAtStart,
          paneShows,
          bandWithPanePlaced: await bandDraws(true),
          bandWithPaneNotPlaced: await bandDraws(false),
        })
      })
    }
  }
})

describe('snapshot: coverage', () => {
  test('no snapshot covers Spirit, Skull, Moon, Sigil or Starfield', () => {
    const all = JSON.stringify(SNAPSHOTS)
    expect(all).not.toMatch(/\b(Spirit|Skull|Moon|Sigil|Starfield)\b/)
    expect(all).not.toMatch(/\b(spirit|skull|moon|sigil|starfield)(\/|:| view)/)
    for (const name of Object.keys(SNAPSHOTS)) {
      expect(KEPT.some(id => name.includes(id)) || name.startsWith('nothing awake') || name.startsWith('cards:'), name).toBe(true)
    }
  })
})
