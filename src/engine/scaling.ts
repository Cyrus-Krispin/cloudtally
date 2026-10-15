import { computeCosts } from './compute'
import { serviceByType } from './services'
import type { GraphEdge, GraphNode, Workload } from './types'

export const MIN_DAU = 1_000
export const MAX_DAU = 10_000_000

/** Daily user counts spaced evenly on a log scale from `min` to `max`. */
export function dauSteps(min = MIN_DAU, max = MAX_DAU, count = 30): number[] {
  const ratio = Math.log(max / min) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(min * Math.exp(ratio * i)))
}

export interface ScalePoint {
  dailyActiveUsers: number
  total: number
  /** Monthly cost of each non-source service, by node ID. */
  nodes: Record<string, number>
  /** Data transfer on all connections together. */
  transfer: number
}

/** Prices the same diagram at each daily user count, keeping the rest of the workload fixed. */
export function computeScaling(nodes: GraphNode[], edges: GraphEdge[], workload: Workload, steps = dauSteps()): ScalePoint[] {
  const priced = nodes.filter((n) => !serviceByType[n.type]?.isSource)
  return steps.map((dailyActiveUsers) => {
    const r = computeCosts(nodes, edges, { ...workload, dailyActiveUsers })
    return {
      dailyActiveUsers,
      total: r.total,
      nodes: Object.fromEntries(priced.map((n) => [n.id, r.nodes[n.id].total])),
      transfer: Object.values(r.edges).reduce((sum, e) => sum + e.total, 0),
    }
  })
}
