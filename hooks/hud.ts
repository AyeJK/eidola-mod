// Pictures for the HUD frame: the state's name, drawn large.

/** The state's label, drawn large: its height in pixels (two cell rows). */
export const LABEL_PX = 34

/** The state's name as a picture, large and bold in its colour: text in a pane has one size. */
export function labelSvg(name: string, colour: string): { svg: string; width: number } {
  // Generous: wide letters (W, M, G) in a heavy face run past an average width.
  const width = Math.ceil(name.length * 20 + 12)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${LABEL_PX}" width="${width}" height="${LABEL_PX}">` +
    `<text x="1" y="26" font-family="Inter,'Segoe UI',system-ui,sans-serif" font-weight="800" font-size="24" letter-spacing="1.2" fill="${colour}">${name}</text></svg>`
  return { svg, width }
}
