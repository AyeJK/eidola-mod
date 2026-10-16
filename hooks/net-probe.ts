// Network probes for /eidola: can hook code on this session's host reach
// the places a Shrine bridge would post to? In a cloud session the host is
// the cloud machine, so 127.0.0.1 there is the container, not your computer.

// The probe itself (probeLine) lives in register.tsx: the engine follows $
// only into functions declared in the same file.

export type NetProbe = { label: string; url: string }

export const NET_PROBES: readonly NetProbe[] = [
  { label: 'eidola.app (hosted relay)', url: 'https://eidola.app/' },
  { label: 'example.com (control)', url: 'https://example.com/' },
  { label: 'api.github.com (a host cloud environments usually allow)', url: 'https://api.github.com/' },
  { label: 'Shrine on this host (127.0.0.1:9743)', url: 'http://127.0.0.1:9743/shrine/' },
]

export const PROBE_TIMEOUT_MS = 6000

export type Outcome =
  | { kind: 'status'; status: number }
  | { kind: 'error'; message: string }
  | { kind: 'timeout' }

function shorten(text: string, max = 140): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function describeOutcome(probe: NetProbe, outcome: Outcome): string {
  switch (outcome.kind) {
    case 'status':
      return `${probe.label}: reached, HTTP ${outcome.status}`
    case 'timeout':
      return `${probe.label}: no answer in ${PROBE_TIMEOUT_MS / 1000}s`
    case 'error':
      return `${probe.label}: failed (${shorten(outcome.message) || 'no reason given'})`
  }
}
