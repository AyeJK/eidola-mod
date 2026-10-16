// Scene Engrams: each draws the whole pane and the whole band from one field
// scene per view, in whatever inks its layers name (see field.ts).

import type { VesselState } from '../types'
import type { FieldScene } from './field'
import { krakenBandScene, krakenPaneScene } from './kraken'

export type SceneViews = {
  /** The pane, docked tall beside the transcript. */
  pane: (state: VesselState, width: number, height: number) => FieldScene
  /** The band above the prompt, and a pane seated short or inline. */
  band: (state: VesselState, width: number, height: number) => FieldScene
}

export const SCENES = {
  kraken: { pane: krakenPaneScene, band: krakenBandScene },
} satisfies Record<string, SceneViews>

export type SceneId = keyof typeof SCENES
