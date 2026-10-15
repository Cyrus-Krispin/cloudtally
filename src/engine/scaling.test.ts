import { describe, expect, it } from 'vitest'
import { computeScaling, dauSteps, MAX_DAU, MIN_DAU } from './scaling'
import { serviceByType } from './services'
import type { GraphEdge, GraphNode, Workload } from './types'

const workload: Workload = { dailyActiveUsers: 10_000, requestsPerUserPerDay: 20, peakToAverage: 3 }

const node = (id: string, type: string): GraphNode => ({ id, type, name: id, config: { ...serviceByType[type].defaults } })
const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  config: { callsPerRequest: 1, operation: 'read', payloadKB: 4, network: 'same-az' },
})

describe('dauSteps', () => {
  it('spans 1k to 10M on a log scale', () => {
    const steps = dauSteps()
    expect(steps).toHaveLength(30)
    expect(steps[0]).toBe(MIN_DAU)
    expect(steps[29]).toBe(MAX_DAU)
    // Evenly spaced in log space: each step is the same multiple of the last.
    expect(steps[15] / steps[14]).toBeCloseTo(steps[1] / steps[0], 2)
  })
})

describe('computeScaling', () => {
  // Users hit an API backed by Lambda (per request) and EC2 (fixed), and Lambda reads from RDS (fixed).
  const nodes = [node('users', 'clients'), node('fn', 'lambda'), node('db', 'rds'), node('vm', 'ec2')]
  const edges = [edge('users', 'fn'), edge('fn', 'db'), edge('users', 'vm')]
  const points = computeScaling(nodes, edges, workload, [1_000, 10_000, 100_000, 1_000_000])

  it('scales per-request services linearly with daily users', () => {
    const lambda = points.map((p) => p.nodes.fn)
    expect(lambda[0]).toBeGreaterThan(0)
    for (let i = 1; i < lambda.length; i++) expect(lambda[i] / lambda[i - 1]).toBeCloseTo(10, 6)
  })

  it('keeps fixed-price services flat', () => {
    for (const id of ['db', 'vm']) {
      const costs = points.map((p) => p.nodes[id])
      expect(costs[0]).toBeGreaterThan(0)
      expect(new Set(costs).size).toBe(1)
    }
  })

  it('leaves out traffic sources and adds up to the total', () => {
    for (const p of points) {
      expect(p.nodes.users).toBeUndefined()
      const sum = Object.values(p.nodes).reduce((s, v) => s + v, 0) + p.transfer
      expect(sum).toBeCloseTo(p.total, 6)
    }
  })
})
