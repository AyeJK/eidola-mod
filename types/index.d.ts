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

/** What the pane shows: the state and a short line of detail under it. */
export type VesselView = { state: VesselState; detail: string }

declare module 'claude-code' {
  interface PluginState {
    eidola: {
      /** The live Vessel state, resolved from engine events. */
      view: VesselView
      /** The awake Engram's id, or null while asleep. Mirrors $.store. */
      engram: string | null
    }
  }
}
