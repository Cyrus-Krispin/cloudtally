import { count } from '../format'
import { computeCosts } from './compute'
import { computeScaling, dauSteps, MAX_DAU, MIN_DAU } from './scaling'
import type { GraphEdge, GraphNode, Workload } from './types'

export type DesignId = 'a' | 'b'

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ComparePoint {
  dailyActiveUsers: number
  a: number
  b: number
}

export interface Crossover {
  dailyActiveUsers: number
  /** The cheaper design just below this point. */
  below: DesignId
  /** The cheaper design just above this point. */
  above: DesignId
  /** What both designs cost here. */
  cost: number
}

/** Totals this close (as a share of the larger one) count as a tie. */
const TIE = 0.005

/** The cheaper of two totals, or null when they are effectively the same. */
export function cheaper(a: number, b: number): DesignId | null {
  if (Math.abs(a - b) <= Math.max(a, b) * TIE + 0.005) return null
  return a < b ? 'a' : 'b'
}

/**
 * Daily user counts where the cheaper design changes. Each change found between two points is
 * narrowed down by bisecting on a log scale, repricing both designs with `costAt`.
 */
export function findCrossovers(points: ComparePoint[], costAt: (dau: number) => { a: number; b: number }, iterations = 40): Crossover[] {
  const found: Crossover[] = []
  let last: { index: number; winner: DesignId } | null = null
  points.forEach((p, i) => {
    const winner = cheaper(p.a, p.b)
    if (!winner) return
    if (last && winner !== last.winner) {
      const below = last.winner
      let lo = Math.log(points[last.index].dailyActiveUsers)
      let hi = Math.log(p.dailyActiveUsers)
      for (let n = 0; n < iterations; n++) {
        const mid = (lo + hi) / 2
        const c = costAt(Math.exp(mid))
        // Bisect on the sign of the difference, so a near-tie doesn't stop short of the real change.
        if (below === 'a' ? c.a < c.b : c.b < c.a) lo = mid
        else hi = mid
      }
      const dailyActiveUsers = Math.exp((lo + hi) / 2)
      const c = costAt(dailyActiveUsers)
      found.push({ dailyActiveUsers, below, above: winner, cost: (c.a + c.b) / 2 })
    }
    last = { index: i, winner }
  })
  return found
}

/** Prices both designs across the daily user range and finds where the cheaper one changes. */
export function compareDesigns(a: Graph, b: Graph, workload: Workload, steps = dauSteps(MIN_DAU, MAX_DAU, 60)) {
  const sa = computeScaling(a.nodes, a.edges, workload, steps)
  const sb = computeScaling(b.nodes, b.edges, workload, steps)
  const points = steps.map((dailyActiveUsers, i) => ({ dailyActiveUsers, a: sa[i].total, b: sb[i].total }))
  const costAt = (dailyActiveUsers: number) => ({
    a: computeCosts(a.nodes, a.edges, { ...workload, dailyActiveUsers }).total,
    b: computeCosts(b.nodes, b.edges, { ...workload, dailyActiveUsers }).total,
  })
  return { points, crossovers: findCrossovers(points, costAt) }
}

const letter = (id: DesignId) => id.toUpperCase()

/** A one-line answer to "which design is cheaper, and when?" */
export function verdict(points: ComparePoint[], crossovers: Crossover[]): string {
  const first = points.map((p) => cheaper(p.a, p.b)).find((w) => w)
  if (!first) return 'A and B cost the same'
  if (!crossovers.length) return `${letter(first)} is cheaper from ${count(points[0].dailyActiveUsers)} to ${count(points[points.length - 1].dailyActiveUsers)} daily users`
  const [head, ...rest] = crossovers
  const parts = [`${letter(head.below)} is cheaper below ${count(head.dailyActiveUsers)} daily users`]
  rest.forEach((c) => parts.push(`${letter(c.below)} up to ${count(c.dailyActiveUsers)}`))
  parts.push(`${letter(crossovers[crossovers.length - 1].above)} above`)
  return parts.join(', ')
}
