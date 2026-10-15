import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { parseDiagram, toDiagram, type Diagram } from './diagram'

const PREFIX = '#d='

/** A link that opens the app with this diagram loaded. */
export function shareUrl(d: Diagram, base = `${location.origin}${location.pathname}`): string {
  return `${base}${PREFIX}${compressToEncodedURIComponent(JSON.stringify(toDiagram(d)))}`
}

/** Reads a diagram from a URL hash, or returns null if there isn't a valid one. */
export function diagramFromHash(hash: string): Diagram | null {
  if (!hash.startsWith(PREFIX)) return null
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(PREFIX.length))
    return json ? parseDiagram(json) : null
  } catch {
    return null
  }
}
