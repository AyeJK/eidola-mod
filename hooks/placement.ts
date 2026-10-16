// Where the Vessel appears. The Engram suggests, the person decides:
// the `placement` option (in /config, or `/eidola place <where>`) wins,
// and its `default` value defers to the awake Engram's suggestion.

import type { PluginOptions } from 'claude-code'

export const PLACEMENT_SETTINGS = ['default', 'both', 'pane', 'band', 'auto'] as const
export type PlacementSetting = (typeof PLACEMENT_SETTINGS)[number]
export type Placement = Exclude<PlacementSetting, 'default'>

/** What an Engram that names no placement gets. */
export const FALLBACK_PLACEMENT: Placement = 'auto'

export const PLACEMENT_HELP: Record<PlacementSetting, string> = {
  default: "the awake Engram's suggestion (auto, if it has none)",
  both: 'pane and band',
  pane: 'pane only',
  band: 'band only; the pane opens only when you ask (/eidola)',
  auto: 'band only while no pane is placed',
}

export function isPlacementSetting(value: unknown): value is PlacementSetting {
  return typeof value === 'string' && (PLACEMENT_SETTINGS as readonly string[]).includes(value)
}

export function readPlacement(options: PluginOptions): PlacementSetting {
  const value = options['placement']
  return isPlacementSetting(value) ? value : 'default'
}

export function readStatusLine(options: PluginOptions): boolean {
  return options['statusLine'] !== false
}

export function effectivePlacement(setting: PlacementSetting, engramDefault: Placement | undefined): Placement {
  return setting === 'default' ? (engramDefault ?? FALLBACK_PLACEMENT) : setting
}

/** Whether the pane opens by itself at session start and on attach. */
export function opensPane(placement: Placement): boolean {
  return placement !== 'band'
}

/** Whether the band draws, given whether the pane is placed right now. */
export function bandShows(placement: Placement, isPanePlaced: boolean): boolean {
  switch (placement) {
    case 'both':
    case 'band':
      return true
    case 'pane':
      return false
    case 'auto':
      return !isPanePlaced
  }
}
