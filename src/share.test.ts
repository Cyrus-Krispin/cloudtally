import { describe, expect, it } from 'vitest'
import { computeCosts } from './engine/compute'
import { diagramFromHash, shareUrl } from './share'
import { templates } from './templates'

describe('share links', () => {
  it('round-trips a diagram through the URL', () => {
    const d = templates[1].diagram()
    const url = shareUrl(d, 'https://example.com/')
    const back = diagramFromHash(url.slice(url.indexOf('#')))!
    expect(back.nodes.map((n) => n.data)).toEqual(d.nodes.map((n) => n.data))
    expect(back.edges.map((e) => [e.source, e.target, e.data])).toEqual(d.edges.map((e) => [e.source, e.target, e.data]))
    expect(back.workload).toEqual(d.workload)
  })

  it('ignores hashes that are not valid diagrams', () => {
    expect(diagramFromHash('')).toBeNull()
    expect(diagramFromHash('#section')).toBeNull()
    expect(diagramFromHash('#d=not-a-diagram')).toBeNull()
  })
})

describe('templates', () => {
  it.each(templates.map((t) => [t.name, t]))('%s has a finite, non-zero cost', (_name, t) => {
    const d = t.diagram()
    const r = computeCosts(
      d.nodes.map((n) => ({ id: n.id, ...n.data })),
      d.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, config: e.data!.config })),
      d.workload,
    )
    expect(Number.isFinite(r.total)).toBe(true)
    expect(r.total).toBeGreaterThan(0)
    expect(r.cycleNodeIds).toEqual([])
  })
})
