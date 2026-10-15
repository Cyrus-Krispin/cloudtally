import { useMemo } from 'react'
import { computeCosts } from './engine/compute'
import type { GraphEdge, GraphNode } from './engine/types'
import { useStore } from './store'

/** The cost-relevant parts of the diagram, as plain engine input. */
export function useGraph() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const workload = useStore((s) => s.workload)

  // Moving or selecting nodes creates new objects but doesn't change cost,
  // so recompute only when the cost-relevant data changes.
  const key = JSON.stringify([
    nodes.map((n) => [n.id, n.data]),
    edges.map((e) => [e.id, e.source, e.target, e.data]),
    workload,
  ])

  return useMemo(() => {
    const [graphNodes, graphEdges, w] = JSON.parse(key) as [
      [string, GraphNode][],
      [string, string, string, { config: GraphEdge['config'] }][],
      typeof workload,
    ]
    return {
      nodes: graphNodes.map(([id, d]): GraphNode => ({ ...d, id })),
      edges: graphEdges.map(([id, source, target, d]): GraphEdge => ({ id, source, target, config: d.config })),
      workload: w,
    }
  }, [key])
}

export function useCosts() {
  const graph = useGraph()
  return useMemo(() => computeCosts(graph.nodes, graph.edges, graph.workload), [graph])
}
