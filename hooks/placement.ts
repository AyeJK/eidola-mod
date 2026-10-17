// Where an Engram draws. One surfaces setting for every Engram, set in
// /config or with `/eidola place <switch> on|off`: the Pane and Band
// switches, and "hide the band while the pane is open". An Engram draws on a
// surface only if its switch is on and the Engram's `shows` lists it.
// (`shows` may list the Shrine; nothing draws there until the Shrine and its
// switch arrive.)

import type { PluginOptions } from 'claude-code'

import type { ShowPlace } from './engram-types'

/** The surfaces setting: one switch per surface, and the band's manners. */
export type Surfaces = {
  /** The pane: the awake Engram draws there, and the pane opens by itself. */
  pane: boolean
  /** The band above the prompt. */
  band: boolean
  /** The band steps aside while the pane is open, for an Engram that shows in the pane. */
  hideBand: boolean
}

/** Pane on, Band on, the band hidden while the pane is open: 0.6.0's `auto`. */
export const DEFAULT_SURFACES: Surfaces = { pane: true, band: true, hideBand: true }

/** The switches, in the order `/eidola place` lists them. */
export const SWITCHES = ['pane', 'band', 'hide'] as const
export type Switch = (typeof SWITCHES)[number]

/** Each switch's field in the surfaces setting. */
const FIELDS: Record<Switch, keyof Surfaces> = { pane: 'pane', band: 'band', hide: 'hideBand' }

/** Each switch's `userConfig` option. */
export const OPTION_KEYS: Record<Switch, string> = { pane: 'pane', band: 'band', hide: 'hideBandWhilePaneOpen' }

export const SWITCH_HELP: Record<Switch, string> = {
  pane: 'the pane; on, it opens by itself for an Engram that shows there',
  band: 'the band above the prompt',
  hide: 'hide the band while the pane is open',
}

export function isSwitch(value: unknown): value is Switch {
  return typeof value === 'string' && (SWITCHES as readonly string[]).includes(value)
}

/** `on` or `off` as a boolean; anything else, undefined. */
export function readOnOff(value: string): boolean | undefined {
  return value === 'on' ? true : value === 'off' ? false : undefined
}

/** A switch's value in the setting. */
export function switchOf(surfaces: Surfaces, one: Switch): boolean {
  return surfaces[FIELDS[one]]
}

/** The surfaces setting from the options; a missing or odd value reads as its default. */
export function readSurfaces(options: PluginOptions): Surfaces {
  const flag = (one: Switch): boolean => {
    const value = options[OPTION_KEYS[one]]
    return typeof value === 'boolean' ? value : DEFAULT_SURFACES[FIELDS[one]]
  }
  return { pane: flag('pane'), band: flag('band'), hideBand: flag('hide') }
}

export function readStatusLine(options: PluginOptions): boolean {
  return options['statusLine'] !== false
}

/** The setting in one line: `pane on · band on (hidden while the pane is open)`. */
export function surfacesLine(surfaces: Surfaces): string {
  const onOff = (is: boolean) => (is ? 'on' : 'off')
  const hidden = surfaces.band && surfaces.hideBand ? ' (hidden while the pane is open)' : ''
  return `pane ${onOff(surfaces.pane)} · band ${onOff(surfaces.band)}${hidden}`
}

/** Where an Engram draws, as `whereItDraws` decides it. */
export type Drawing = {
  /** The pane opens by itself for it (at session start, on attach, on /awaken). */
  opensPane: boolean
  /**
   * What the pane draws of it when the pane is open, by itself or because you
   * asked: its pane view where its `shows` lists the pane, else its band view.
   * An Engram never stops you opening the pane.
   */
  paneView: 'pane' | 'band'
  /** The band draws it now. */
  band: boolean
}

/**
 * Where an Engram draws: on a surface only if that switch is on and its
 * `shows` lists it; the band steps aside while the pane is open if that option
 * is on and the Engram shows in the pane; and one that doesn't show in the
 * pane (band-only) never opens the pane by itself, and keeps its band.
 */
export function whereItDraws(
  surfaces: Surfaces,
  engram: { vessel: { shows: readonly ShowPlace[] } },
  isPaneOpen: boolean,
): Drawing {
  const shows = engram.vessel.shows
  const isPane = shows.includes('pane')
  return {
    opensPane: surfaces.pane && isPane,
    paneView: isPane ? 'pane' : 'band',
    band: surfaces.band && shows.includes('band') && !(surfaces.hideBand && isPaneOpen && isPane),
  }
}

/** Every switch on and the band never hidden: where an Engram can draw at all. */
const EVERYWHERE: Surfaces = { pane: true, band: true, hideBand: false }

/** Where an Engram can draw, of the pane and the band, whatever the switches: the picker's filters. */
export function drawsIn(engram: { vessel: { shows: readonly ShowPlace[] } }): { pane: boolean; band: boolean } {
  const drawn = whereItDraws(EVERYWHERE, engram, false)
  return { pane: drawn.opensPane, band: drawn.band }
}

/**
 * The picker's "where it shows" text, from the list form of `shows`: the
 * places it draws, `pane + band`, or the one place, `band only`. The Shrine
 * isn't a surface yet, so it is named only for an Engram that shows nowhere
 * else (`shrine only`).
 */
export function showsLabel(engram: { vessel: { shows: readonly ShowPlace[] } }): string {
  const drawn = drawsIn(engram)
  const places = (['pane', 'band'] as const).filter(place => drawn[place])
  if (places.length === 0) {
    return `${engram.vessel.shows.join(' + ')} only`
  }
  return places.length === 1 ? `${places[0]} only` : places.join(' + ')
}
