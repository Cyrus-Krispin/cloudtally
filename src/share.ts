import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { parseDiagram, toDiagram, validateDiagram, type Comparison, type Diagram } from './diagram'

const PREFIX = '#d='
const COMPARE_PREFIX = '#c='

const encode = (value: unknown) => compressToEncodedURIComponent(JSON.stringify(value))

const decode = (hash: string, prefix: string) =>
  hash.startsWith(prefix) ? decompressFromEncodedURIComponent(hash.slice(prefix.length)) || null : null

/** A link that opens the app with this diagram, or both designs of a comparison, loaded. */
export function shareUrl(d: Diagram | Comparison, base = `${location.origin}${location.pathname}`): string {
  if ('a' in d) return `${base}${COMPARE_PREFIX}${encode({ active: d.active, a: toDiagram(d.a), b: toDiagram(d.b) })}`
  return `${base}${PREFIX}${encode(toDiagram(d))}`
}

/** Reads a diagram from a URL hash, or returns null if there isn't a valid one. */
export function diagramFromHash(hash: string): Diagram | null {
  try {
    const json = decode(hash, PREFIX)
    return json ? parseDiagram(json) : null
  } catch {
    return null
  }
}

/** Reads both designs of a comparison from a URL hash, or returns null if there aren't valid ones. */
export function comparisonFromHash(hash: string): Comparison | null {
  try {
    const json = decode(hash, COMPARE_PREFIX)
    if (!json) return null
    const c = JSON.parse(json)
    return { a: validateDiagram(c.a), b: validateDiagram(c.b), active: c.active === 'b' ? 'b' : 'a' }
  } catch {
    return null
  }
}
