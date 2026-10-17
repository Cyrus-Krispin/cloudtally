import { describe, expect, it } from 'vitest'
import { cheaper, compareDesigns, findCrossovers, verdict, type ComparePoint } from './compare'
import { computeCosts } from './compute'
import { dauSteps } from './scaling'
import { serviceByType } from './services'
import type { GraphEdge, GraphNode, Workload } from './types'

const workload: Workload = { dailyActiveUsers: 10_000, requestsPerUserPerDay: 20, peakToAverage: 3 }

/** Samples two cost curves at the standard daily user steps. */
const sample = (a: (dau: number) => number, b: (dau: number) => number, steps = dauSteps()): ComparePoint[] =>
  steps.map((d) => ({ dailyActiveUsers: d, a: a(d), b: b(d) }))

describe('cheaper', () => {
  it('picks the lower total and treats near-equal totals as a tie', () => {
    expect(cheaper(10, 20)).toBe('a')
    expect(cheaper(20, 10)).toBe('b')
    expect(cheaper(100, 100.2)).toBeNull()
    expect(cheaper(0, 0)).toBeNull()
  })
})

describe('findCrossovers', () => {
  // A grows with traffic ($1 per 1k users), B is a flat $500: they cross at 500k users.
  const perUser = (d: number) => d / 1000
  const flat = () => 500

  it('finds where a linear and a flat design cross', () => {
    const points = sample(perUser, flat)
    const [c, ...rest] = findCrossovers(points, (d) => ({ a: perUser(d), b: flat() }))
    expect(rest).toHaveLength(0)
    expect(c.below).toBe('a')
    expect(c.above).toBe('b')
    expect(c.dailyActiveUsers).toBeCloseTo(500_000, -2)
    expect(c.cost).toBeCloseTo(500, 0)
  })

  it('finds every crossover when the cheaper design changes more than once', () => {
    // B is flat at $100 up to 1M users, then jumps to $50,000: A is cheaper, then B, then A again.
    const a = (d: number) => d / 1000
    const b = (d: number) => (d < 1_000_000 ? 100 : 50_000)
    const found = findCrossovers(sample(a, b), (d) => ({ a: a(d), b: b(d) }))
    expect(found.map((c) => [c.below, c.above])).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ])
    expect(found[0].dailyActiveUsers).toBeCloseTo(100_000, -2)
    expect(found[1].dailyActiveUsers).toBeCloseTo(1_000_000, -2)
  })

  it('finds none when one design is always cheaper or they tie', () => {
    const never = () => {
      throw new Error('should not reprice')
    }
    expect(findCrossovers(sample(perUser, (d) => d / 500), never)).toEqual([])
    expect(findCrossovers(sample(flat, flat), never)).toEqual([])
  })

  it('looks past a stretch of ties to the next change', () => {
    const points: ComparePoint[] = [
      { dailyActiveUsers: 1_000, a: 10, b: 20 },
      { dailyActiveUsers: 10_000, a: 20, b: 20 },
      { dailyActiveUsers: 100_000, a: 30, b: 20 },
    ]
    // A costs the same as B at exactly 10k users and more beyond it.
    const [c] = findCrossovers(points, (d) => ({ a: 10 + 10 * Math.log10(d / 1_000), b: 20 }))
    expect(c).toMatchObject({ below: 'a', above: 'b' })
    expect(c.dailyActiveUsers).toBeCloseTo(10_000, -1)
  })
})

describe('verdict', () => {
  it('names the cheaper design on each side of a crossover', () => {
    const points = sample(() => 500, (d) => d / 1000)
    expect(verdict(points, findCrossovers(points, (d) => ({ a: 500, b: d / 1000 })))).toBe('B is cheaper below 500K daily users, A above')
  })

  it('handles no crossover, a tie, and several crossovers', () => {
    expect(verdict(sample((d) => d, (d) => 2 * d), [])).toBe('A is cheaper from 1K to 10M daily users')
    expect(verdict(sample(() => 5, () => 5), [])).toBe('A and B cost the same')
    const a = (d: number) => d / 1000
    const b = (d: number) => (d < 1_000_000 ? 100 : 50_000)
    const points = sample(a, b)
    expect(verdict(points, findCrossovers(points, (d) => ({ a: a(d), b: b(d) })))).toBe(
      'A is cheaper below 100K daily users, B up to 1M, A above',
    )
  })
})

describe('compareDesigns', () => {
  const node = (id: string, type: string): GraphNode => ({ id, type, name: id, config: { ...serviceByType[type].defaults } })
  const edge = (source: string, target: string): GraphEdge => ({
    id: `${source}-${target}`,
    source,
    target,
    config: { callsPerRequest: 1, operation: 'read', payloadKB: 4, network: 'same-az' },
  })

  it('prices both designs and finds where per-request beats fixed', () => {
    const serverless = { nodes: [node('users', 'clients'), node('fn', 'lambda')], edges: [edge('users', 'fn')] }
    const server = { nodes: [node('users', 'clients'), node('vm', 'ec2')], edges: [edge('users', 'vm')] }
    const { points, crossovers } = compareDesigns(serverless, server, workload)
    expect(points[0].a).toBeLessThan(points[0].b)
    expect(points[points.length - 1].a).toBeGreaterThan(points[points.length - 1].b)
    expect(crossovers).toHaveLength(1)
    const c = crossovers[0]
    expect(c).toMatchObject({ below: 'a', above: 'b' })
    // At the crossover both designs cost about the same.
    const at = { ...workload, dailyActiveUsers: c.dailyActiveUsers }
    const a = computeCosts(serverless.nodes, serverless.edges, at).total
    const b = computeCosts(server.nodes, server.edges, at).total
    expect(a / b).toBeCloseTo(1, 3)
    expect(c.cost).toBeCloseTo(a, 0)
  })
})
