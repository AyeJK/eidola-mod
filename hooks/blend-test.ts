// /eidola blend: can a drawing change mood without being replaced?
//
// The source never changes; only the drawing's height does, by 0, 1 or 2px.
// CSS media queries inside it read that height and pick a mood, and CSS
// transitions carry it there. If the surface only resizes the frame, the
// disc glides and the colour shifts while the bar keeps filling; if it
// reloads the frame, the bar and the ring start over.

/** Pixels the drawing loses for each mood: the signal itself. */
export const BLEND_STEPS = ['idle', 'working', 'attention'] as const

export function blendTestSvg(width: number, height: number): string {
  const W = Math.round(width)
  const H = Math.round(height)
  const cx = W / 2
  // Height H is mood 0, H - 1 mood 1, H - 2 mood 2.
  const mq = (k: number) =>
    k === 0 ? `(min-height:${H - 0.5}px)` : k === 1 ? `(max-height:${H - 0.5}px) and (min-height:${H - 1.5}px)` : `(max-height:${H - 1.5}px)`
  const looks = [
    { bg: '#0b2a36', x: -W * 0.28, label: 'idle' },
    { bg: '#123d24', x: 0, label: 'working' },
    { bg: '#4a1a12', x: W * 0.28, label: 'attention' },
  ]
  const css =
    // Smooth moves between moods.
    '.bg{transition:fill 1.2s ease}.disc{transition:transform 1.2s cubic-bezier(.4,0,.2,1)}' +
    '.lab{display:none}' +
    looks
      .map((l, k) => `@media ${mq(k)}{.bg{fill:${l.bg}}.disc{transform:translateX(${Math.round(l.x)}px)}.l${k}{display:inline}}`)
      .join('') +
    // Clocks that start over if the frame reloads.
    '@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '.bar{transform-box:fill-box;transform-origin:0 50%;animation:fill 20s linear infinite}' +
    '@keyframes spin{to{transform:rotate(360deg)}}' +
    `.ring{transform-origin:${cx}px 200px;animation:spin 6s linear infinite}`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` +
    `<style>${css}</style>` +
    `<rect class="bg" width="100%" height="100%" fill="#222"/>` +
    `<text x="${cx}" y="60" fill="#fff" font-family="sans-serif" font-size="20" text-anchor="middle">Blend test</text>` +
    looks.map((l, k) => `<text class="lab l${k}" x="${cx}" y="95" fill="#ffd27a" font-family="sans-serif" font-size="26" font-weight="700" text-anchor="middle">${l.label}</text>`).join('') +
    `<g class="ring"><circle cx="${cx}" cy="200" r="60" fill="none" stroke="#5ff6ff" stroke-width="6" stroke-dasharray="90 287"/></g>` +
    `<circle class="disc" cx="${cx}" cy="360" r="34" fill="#fff"/>` +
    `<text x="${cx}" y="450" fill="#aaa" font-family="sans-serif" font-size="13" text-anchor="middle">20s bar: keeps filling = no reload</text>` +
    `<rect x="${Math.round(W * 0.1)}" y="465" width="${Math.round(W * 0.8)}" height="12" fill="#333"/>` +
    `<rect class="bar" x="${Math.round(W * 0.1)}" y="465" width="${Math.round(W * 0.8)}" height="12" fill="#5ff6ff"/>` +
    '</svg>'
  )
}
