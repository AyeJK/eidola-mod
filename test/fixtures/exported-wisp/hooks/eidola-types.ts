// Eidola's public types (contract 1), copied from the Eidola mod's
// types/index.d.ts by scripts/export-engram.mjs: what the drawing reads off
// the hand-off and Eidola's state. Types alone; $.eidola and Eidola's state
// are typed by the contract the engine lays into .claude-plugin/types/eidola/
// once this plugin loads beside Eidola.

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
