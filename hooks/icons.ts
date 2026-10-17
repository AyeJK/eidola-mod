// The three surface icons, each a small `Svg` drawn in the colour it is
// given: amber where the surface is on (or the Engram can draw there),
// faint or `iconOff` where not. Two cells wide, under a row tall.

/** The surfaces an icon can stand for. */
export type SurfaceIcon = 'pane' | 'band' | 'shrine'

/** An icon's size in px: two cells across, inside one row. */
export const ICON_PX = 14

/** Each icon's drawing in a 14 × 14 box, `currentColor` its ink. */
const SHAPES: Record<SurfaceIcon, string> = {
  // A window with a docked pane down its right side.
  pane: '<rect x="1.5" y="2.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor"/><rect x="8" y="3" width="4" height="8" fill="currentColor"/>',
  // A window with a band across its foot, above the prompt.
  band: '<rect x="1.5" y="2.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor"/><rect x="2" y="8" width="10" height="2.5" fill="currentColor"/>',
  // A display on a stand: the Shrine.
  shrine: '<rect x="1.5" y="1.5" width="11" height="8" rx="1.5" fill="none" stroke="currentColor"/><path d="M7 9.5v2.5M4 12.5h6" fill="none" stroke="currentColor"/><circle cx="7" cy="5.5" r="1.5" fill="currentColor"/>',
}

/** An icon in a colour, as an `Svg` source. */
export function iconSvg(icon: SurfaceIcon, colour: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" width="${ICON_PX}" height="${ICON_PX}" color="${colour}">${SHAPES[icon]}</svg>`
}

/** What each icon stands for, for its alt text and the terminal. */
export const ICON_NAMES: Record<SurfaceIcon, string> = { pane: 'Pane', band: 'Band', shrine: 'Shrine' }
