export type VesselState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'attention'
  | 'success'
  | 'responding'
  | 'error'
  | 'waiting'
  | 'sleeping'

/**
 * What the drawings follow: three moods, set by the turn rather than by each
 * tool, so a turn changes the drawing two or three times, not dozens.
 */
export type Mood = 'idle' | 'working' | 'attention'

/** What the status line shows: the state and a short line of detail under it. */
export type VesselView = { state: VesselState; detail: string }

declare module 'claude-code' {
  interface PluginState {
    eidola: {
      /** The live Vessel state, resolved from engine events; the status line's. */
      view: VesselView
      /** The live mood; the pane and band draw from this alone. */
      mood: Mood
      /** The awake Engram's id, or null while asleep. Mirrors $.store. */
      engram: string | null
      /** True while the pane shows the media test (`/eidola media`). */
      media: boolean
      /** True while the pane and band show their measurements (`/eidola measure`). */
      measure: boolean
      /** The blend test's mood step (0-2), or null while it is off (`/eidola blend`). */
      blend: number | null
      /** The live test's mood, or null while it is off (`/eidola live`). */
      live: Mood | null
      /**
       * How many times something has gone wrong: a failed tool, a turn ended in
       * error, or `/eidola ink`. A live Kraken that sees it rise inks and flees;
       * the Lich is scorched.
       */
      ink: number
      /**
       * The HUD frame over the Vessel, as the person has toggled it for each
       * Engram (`/eidola frame`), by Engram id; an Engram not here shows its
       * own default.
       */
      frame: Record<string, boolean>
      /** When the mood last changed, and when the ink last rose (ms). */
      moodAt: number
      /** The mood before the last change. */
      moodBefore: Mood
      inkAt: number
      /**
       * When the session's live drawings started counting (ms): a drawing split
       * across several keeps them in step by it.
       */
      epoch: number
    }
  }
}
