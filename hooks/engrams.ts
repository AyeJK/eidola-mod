// The bundled Engrams are packages now, engrams/<id>/ in the mod, loaded at
// session start by hooks/loader.ts. Their shape is hooks/engram-types.ts.
// This holds no Engram data: only which one rests.

/**
 * The resting Engram: its scene, dimmed, is what the pane and band show while
 * nothing is awake; it is awake in a session that has stored nothing yet, and
 * `/awaken` alone wakes it.
 */
export const RESTING_ID = 'wisp'
