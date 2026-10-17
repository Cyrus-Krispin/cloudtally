import { describe, expect, it } from 'vitest'
import { computeCosts } from './engine/compute'
import { comparisonFromHash, diagramFromHash, shareUrl } from './share'
import { comparisonTemplates, templates } from './templates'

describe('share links', () => {
  it('round-trips a diagram through the URL', () => {
    const d = templates[1].diagram()
    const url = shareUrl(d, 'https://example.com/')
    const back = diagramFromHash(url.slice(url.indexOf('#')))!
    expect(back.nodes.map((n) => n.data)).toEqual(d.nodes.map((n) => n.data))
    expect(back.edges.map((e) => [e.source, e.target, e.data])).toEqual(d.edges.map((e) => [e.source, e.target, e.data]))
    expect(back.workload).toEqual(d.workload)
  })

  it('round-trips both designs of a comparison', () => {
    const c = { ...comparisonTemplates[0].comparison(), active: 'b' as const }
    const url = shareUrl(c, 'https://example.com/')
    const hash = url.slice(url.indexOf('#'))
    expect(diagramFromHash(hash)).toBeNull()
    const back = comparisonFromHash(hash)!
    expect(back.active).toBe('b')
    expect(back.a.nodes.map((n) => n.data)).toEqual(c.a.nodes.map((n) => n.data))
    expect(back.b.nodes.map((n) => n.data)).toEqual(c.b.nodes.map((n) => n.data))
    expect(back.b.edges.map((e) => [e.source, e.target])).toEqual(c.b.edges.map((e) => [e.source, e.target]))
  })

  it('ignores hashes that are not valid diagrams', () => {
    expect(diagramFromHash('')).toBeNull()
    expect(diagramFromHash('#section')).toBeNull()
    expect(diagramFromHash('#d=not-a-diagram')).toBeNull()
    expect(comparisonFromHash('#c=not-a-comparison')).toBeNull()
    expect(comparisonFromHash(shareUrl(templates[0].diagram(), '').slice(0))).toBeNull()
  })
})

const allDesigns = [
  ...templates.map((t) => [t.name, t.diagram] as const),
  ...comparisonTemplates.flatMap((t) => [
    [`${t.name} (A)`, () => t.comparison().a] as const,
    [`${t.name} (B)`, () => t.comparison().b] as const,
  ]),
]

describe('templates', () => {
  it.each(allDesigns)('%s has a finite, non-zero cost', (_name, diagram) => {
    const d = diagram()
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
