// /eidola measure: what the pane and band report about their size, beside
// drawings of a known size, so a screenshot gives pixels per cell on each
// surface. The stage is sized from those numbers, not from a guess.

/** The reference square's side, in CSS pixels. */
export const REFERENCE_PX = 100

/** A REFERENCE_PX square: a 10px grid, every 50px darker, a red edge. */
export function referenceSvg(): string {
  const n = REFERENCE_PX
  const lines: string[] = []
  for (let at = 10; at < n; at += 10) {
    const stroke = at % 50 === 0 ? '#333' : '#bbb'
    lines.push(`<path d="M${at} 0V${n}M0 ${at}H${n}" stroke="${stroke}" stroke-width="1"/>`)
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n}" height="${n}">` +
    `<rect width="${n}" height="${n}" fill="#fff"/>` +
    lines.join('') +
    `<rect x="1" y="1" width="${n - 2}" height="${n - 2}" fill="none" stroke="#e00" stroke-width="2"/>` +
    `<text x="${n / 2}" y="${n / 2 + 5}" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#e00">${n}px</text>` +
    `</svg>`
  )
}

/** The lines the pane prints in measure mode. */
export function paneReport(surface: string, placement: string, bodyColumns: number, bodyRows: number): string[] {
  return [
    `Measure · ${surface} · pane (${placement})`,
    `bodyColumns ${bodyColumns} · bodyRows ${bodyRows}`,
    'Blue: a Box at height 100%. Yellow: a Box bodyColumns × bodyRows cells.',
  ]
}

/** The lines the band prints in measure mode. */
export function bandReport(surface: string, bodyColumns: number, maxRows: number, bodyRows: number): string[] {
  return [`Measure · ${surface} · band`, `bodyColumns ${bodyColumns} · maxRows ${maxRows} · bodyRows ${bodyRows}`]
}

export const MEASURE_HELP =
  'Measure on. The pane and band show their reported size beside a 100px square:\n' +
  '  blue fills a Box at height 100%, if the surface honours it\n' +
  '  yellow outlines a Box sized bodyColumns × bodyRows in cells\n' +
  'Screenshot the whole window and send it. Run /eidola measure again to turn it off.'

/** The measure view's colours: a blue ground, its box outlined in yellow. */
export const MEASURE_GROUND = '#1e3a5f'
export const MEASURE_EDGE = 'yellow'
