// Eidola's type contract. Two parts:
//
// - The PUBLIC contract (contract 1, docs/spec/engram-plugin.md): the `eidola`
//   noun an Engram plugin calls (`$.eidola.announce`, `$.eidola.fault`), the
//   hand-off it reads off `e.props.eidola`, and the PluginState values marked
//   "Public" below: engram, mood, moodBefore, moodAt, ink, inkAt, epoch and
//   contract. An Engram plugin that lists "eidola" under `dependencies` in its
//   plugin.json gets this file laid into its .claude-plugin/types/eidola/.
//   A change that breaks any of it raises `contract`.
// - Eidola's own UI values, marked "Internal": the pane's screens and tests.
//   Another plugin may read them, but they change without notice.
//
// Self-contained: no import or reference.

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

/**
 * An Engram page's HUD preview: the mood its chips set, or the error its Error
 * button shows, drawn in the preview alone and never in the session.
 */
export type Preview = {
  mood: Mood
  /** The Error button was pressed since the last mood chip. */
  isError: boolean
  /** How many times the Error button was pressed: the preview's own ink. */
  ink: number
  /** When it was last pressed, and when the preview's mood last changed (ms). */
  inkAt: number
  moodAt: number
  /** The preview's mood before the last change. */
  moodBefore: Mood
}

/** The version of the public contract this Eidola keeps. */
export type EidolaContract = 1

/** What an Engram plugin passes to `$.eidola.announce`. */
export type EidolaAnnounceInput = {
  /** The plugin's own folder, the one holding engram.json: `$.plugin.root`. */
  root: string
}

/** One reason Eidola could not take an Engram plugin's engram.json. */
export type EidolaIssue = { file: string; problem: string; fix: string }

/** What `$.eidola.announce` answers. */
export type EidolaAnnounced = {
  /** The contract this Eidola keeps. */
  contract: EidolaContract
  /** The Engram's id when it is in the registry; null when it isn't. */
  engram: string | null
  /** Why it isn't: each file, problem and fix. Empty when it is. */
  issues: EidolaIssue[]
}

/** What an Engram plugin passes to `$.eidola.fault` when its own drawing fails. */
export type EidolaFaultInput = {
  /** The Engram's id. */
  engram: string
  /** What went wrong, in a line. */
  message: string
  /** The file that failed, relative to the plugin's folder (`hooks/creature.tsx`). */
  file?: string
  /** The line in that file, when known. */
  line?: number
  /** The error's stack, when there is one: Eidola reads the line off it when `line` is left out. */
  stack?: string
}

/** What `$.eidola.fault` answers: whether Eidola marked the Engram not loading. */
export type EidolaFaulted = { isMarked: boolean }

/** Where Eidola is handing the drawing off: its pane, or the band above the prompt. */
export type EidolaWhere = 'pane' | 'band'

/**
 * The hand-off, on `e.props.eidola` of the `ui.render` Eidola passes to
 * `next`: present only when Eidola asks the awake Engram's plugin for its
 * drawing. Draw `columns` × `rows` cells, in one Box keyed `eidola:<engram>`.
 */
export type EidolaHandoff = {
  contract: EidolaContract
  /** The awake Engram's id: draw only when it is yours. */
  engram: string
  where: EidolaWhere
  /** The drawing area inside Eidola's frame, in cells. */
  columns: number
  rows: number
  mood: Mood
  moodBefore: Mood
  moodAt: number
  ink: number
  inkAt: number
  epoch: number
}

/** The `eidola` noun Eidola adds to `$`: what an Engram plugin calls. */
export type Eidola = {
  /**
   * Tells Eidola an Engram plugin is here. Call it from `session.start`:
   * Eidola reads `<root>/engram.json`, checks it, and adds the Engram to its
   * registry. Works whichever plugin loaded first.
   *
   * @example
   * on('session.start', async ($, e, next) => {
   *   await $.eidola.announce({ root: $.plugin.root })
   *   return next(e)
   * })
   */
  announce: (input: EidolaAnnounceInput) => Promise<EidolaAnnounced>
  /**
   * Tells Eidola the plugin's own drawing failed: Eidola draws the Engram it
   * was remixed from (or the resting sprite) instead, and marks it not
   * loading with the file and line, until the plugin announces again.
   */
  fault: (input: EidolaFaultInput) => Promise<EidolaFaulted>
}

declare module 'claude-code' {
  interface EngineInterface {
    eidola: Eidola
  }

  interface PluginState {
    eidola: {
      /** Public (contract 1): the version of the public contract, 1. A plugin built for another version should not draw. */
      contract: EidolaContract
      /** Public (contract 1): the awake Engram's id, or null while asleep. Mirrors $.store. */
      engram: string | null
      /** Public (contract 1): the live mood; the pane and band draw from this alone. */
      mood: Mood
      /** Public (contract 1): the mood before the last change. */
      moodBefore: Mood
      /** Public (contract 1): when the mood last changed (ms since the epoch of the clock, as $.clock.now). */
      moodAt: number
      /**
       * Public (contract 1): how many times something has gone wrong: a failed
       * tool, a turn ended in error, or `/eidola ink`. A creature that sees it
       * rise plays its error effect once (the Kraken inks, the Lich is scorched).
       */
      ink: number
      /** Public (contract 1): when the ink last rose (ms). */
      inkAt: number
      /**
       * Public (contract 1): when the session's live drawings started counting
       * (ms): a drawing split across several keeps them in step by it.
       */
      epoch: number
      /** Internal: the live Vessel state, resolved from engine events; the status line's. */
      view: VesselView
      /** Internal: true while the pane shows the media test (`/eidola media`). */
      media: boolean
      /** Internal: true while the pane and band show their measurements (`/eidola measure`). */
      measure: boolean
      /** Internal: the blend test's mood step (0-2), or null while it is off (`/eidola blend`). */
      blend: number | null
      /** Internal: the live test's mood, or null while it is off (`/eidola live`). */
      live: Mood | null
      /**
       * Internal: the HUD frame over the Vessel, as the person has toggled it
       * for each Engram (`/eidola frame`), by Engram id; an Engram not here
       * shows its own default.
       */
      frame: Record<string, boolean>
      /** Internal: true while the pane shows the Engram picker, opened by its corner triangle. */
      picker: boolean
      /** Internal: which Engrams the picker lists: all, those that draw in a pane, in the band, or yours (Engram plugins). */
      pickerFilter: 'all' | 'pane' | 'band' | 'yours'
      /** Internal: which of the picker's dropdowns is open, if either. */
      pickerMenu: 'surface' | 'source' | null
      /** Internal: the surface the picker lists Engrams for: all, those that draw in a pane, or in the band. */
      pickerSurface: 'all' | 'pane' | 'band'
      /** Internal: where the listed Engrams come from: all, bundled with Eidola, or yours (Engram plugins). */
      pickerSource: 'all' | 'bundled' | 'yours'
      /** Internal: the Engram whose page the pane shows, over the picker or by itself (`/engrams <id>`); null for none. */
      page: string | null
      /** Internal: the page's HUD preview: its own mood and error, apart from the session's. */
      preview: Preview
      /**
       * Internal: true while the pane shows the Surfaces screen, over the
       * picker or a page or by itself (`/eidola place`); its back button
       * returns to what is under it.
       */
      surfaces: boolean
      /**
       * Internal: how many times a switch was written from the Surfaces screen
       * or `/eidola place`: the pane reads it, so it redraws at once.
       */
      switched: number
      /** Internal: how many times an Engram plugin was found or marked not loading: the picker reads it. */
      plugins: number
    }
  }
}
