// Pictures for the HUD frame: the state's name, drawn large.

/** The state's label, drawn large: its height in pixels (two cell rows). */
export const LABEL_PX = 34

/**
 * The state's name as a picture, large in its colour: text in a pane has one
 * size. `bold`, a heavy sans in capitals; `serif`, an old-style serif in
 * small capitals, as a grimoire heads its chapters.
 */
export function labelSvg(name: string, colour: string, style: 'bold' | 'serif' = 'bold'): { svg: string; width: number } {
  // Generous: wide letters (W, M, G) in a heavy face run past an average width.
  const width = Math.ceil(name.length * 20 + 12)
  const text =
    style === 'serif'
      ? `<text x="1" y="26" font-family="'Cormorant Garamond','Garamond','Palatino Linotype','Book Antiqua',Georgia,serif" font-weight="700" font-size="27" font-variant="small-caps" letter-spacing="1.5" fill="${colour}">${name.charAt(0)}${name.slice(1).toLowerCase()}</text>`
      : `<text x="1" y="26" font-family="Inter,'Segoe UI',system-ui,sans-serif" font-weight="800" font-size="24" letter-spacing="1.2" fill="${colour}">${name}</text>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${LABEL_PX}" width="${width}" height="${LABEL_PX}">${text}</svg>`
  return { svg, width }
}

/** The sigil's size, square, in pixels: three cell rows. */
export const SIGIL_PX = 56

/**
 * An arcane sigil: two rings turning against each other, a seven-pointed
 * star between them, ticks round the rim like runes. Faster while it works.
 * Drawn in the mood's colour, fading in from the last mood's (`from`), since
 * a new picture is drawn when the mood changes.
 */
export function sigilSvg(colour: string, from: string, level: 'idle' | 'working' | 'attention'): string {
  const c = SIGIL_PX / 2
  const R = c - 2
  const r = (n: number) => Math.round(n * 10) / 10
  const turn = level === 'working' ? 9 : level === 'attention' ? 18 : 40
  const at = (deg: number, rad: number) => `${r(c + rad * Math.cos((deg * Math.PI) / 180))} ${r(c + rad * Math.sin((deg * Math.PI) / 180))}`
  const star = Array.from({ length: 7 }, (_, i) => `${i ? 'L' : 'M'}${at(-90 + i * ((360 * 3) / 7), R * 0.66)}`).join('') + 'Z'
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const deg = (i * 360) / 21
    const long = i % 3 === 0
    return `M${at(deg, R * 0.8)}L${at(deg, long ? R * 0.95 : R * 0.88)}`
  }).join('')
  const css =
    `@keyframes spin{to{transform:rotate(360deg)}}@keyframes back{to{transform:rotate(-360deg)}}` +
    `@keyframes ink{from{stroke:${from}}to{stroke:${colour}}}` +
    `.o{transform-origin:${c}px ${c}px;animation:spin ${turn}s linear infinite}` +
    `.i{transform-origin:${c}px ${c}px;animation:back ${turn * 1.6}s linear infinite}` +
    `g{animation:ink 1.6s ease-out both}` +
    `@media (prefers-reduced-motion:reduce){.o,.i{animation:none}}`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGIL_PX} ${SIGIL_PX}" width="${SIGIL_PX}" height="${SIGIL_PX}"><style>${css}</style>` +
    `<g fill="none" stroke="${colour}" stroke-linecap="round">` +
    `<g class="o"><circle cx="${c}" cy="${c}" r="${R}" stroke-opacity=".7"/><path d="${ticks}" stroke-opacity=".7"/></g>` +
    `<g class="i"><circle cx="${c}" cy="${c}" r="${r(R * 0.72)}" stroke-opacity=".45"/><path d="${star}" stroke-opacity=".85"/></g>` +
    `<circle cx="${c}" cy="${c}" r="${r(R * 0.16)}" stroke-opacity=".9"/></g></svg>`
  )
}
