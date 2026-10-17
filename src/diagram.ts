import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { serviceByType } from './engine/services'
import type { Config, EdgeConfig, Workload } from './engine/types'

export type ServiceNodeData = { type: string; name: string; config: Config }
export type TrafficEdgeData = { config: EdgeConfig }
export type ServiceNode = Node<ServiceNodeData, 'service'>
export type TrafficEdge = Edge<TrafficEdgeData, 'traffic'>

/** The saved form of a design, used for files, share links and templates. */
export interface Diagram {
  version: 1
  workload: Workload
  nodes: ServiceNode[]
  edges: TrafficEdge[]
}

export const defaultWorkload: Workload = {
  dailyActiveUsers: 10_000,
  requestsPerUserPerDay: 20,
  peakToAverage: 3,
}

export const markerEnd = { type: MarkerType.ArrowClosed, width: 18, height: 18 }

export const defaultEdgeConfig = (targetType = ''): EdgeConfig => ({
  callsPerRequest: 1,
  operation: targetType === 'sqs' ? 'write' : 'read',
  payloadKB: 4,
  network: 'same-az',
})

export const makeNode = (id: string, type: string, x: number, y: number, config: Config = {}, name?: string): ServiceNode => ({
  id,
  type: 'service',
  position: { x, y },
  data: { type, name: name ?? serviceByType[type].label, config: { ...serviceByType[type].defaults, ...config } },
})

export const makeEdge = (source: string, target: string, config: Partial<EdgeConfig> = {}, targetType = ''): TrafficEdge => ({
  id: `e-${source}-${target}`,
  source,
  target,
  type: 'traffic',
  markerEnd,
  data: { config: { ...defaultEdgeConfig(targetType), ...config } },
})

/** Strips everything that can be rebuilt on load, keeping saved files and links small. */
export const toDiagram = (s: Pick<Diagram, 'workload' | 'nodes' | 'edges'>): Diagram => ({
  version: 1,
  workload: s.workload,
  nodes: s.nodes.map(({ id, position, data }) => ({ id, type: 'service', position, data })),
  edges: s.edges.map(({ id, source, target, sourceHandle, targetHandle, data }) => ({
    id,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    type: 'traffic',
    data,
  })),
})

/** Two designs on the same workload, shared together. */
export interface Comparison {
  a: Diagram
  b: Diagram
  active: 'a' | 'b'
}

/** Validates a saved diagram and fills in anything left out when it was saved. */
export const parseDiagram = (text: string): Diagram => validateDiagram(JSON.parse(text))

export function validateDiagram(d: any): Diagram {
  if (!d || d.version !== 1 || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) {
    throw new Error('This is not a cloudtally diagram.')
  }
  for (const n of d.nodes) {
    if (!serviceByType[n?.data?.type]) throw new Error(`Unknown service type: ${n?.data?.type}`)
  }
  const nodeIds = new Set(d.nodes.map((n: ServiceNode) => n.id))
  return {
    version: 1,
    workload: { ...defaultWorkload, ...d.workload },
    nodes: d.nodes.map((n: ServiceNode) => ({
      id: String(n.id),
      type: 'service',
      position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 },
      data: {
        type: n.data.type,
        name: String(n.data.name ?? serviceByType[n.data.type].label),
        config: { ...serviceByType[n.data.type].defaults, ...n.data.config },
      },
    })),
    edges: d.edges
      .filter((e: TrafficEdge) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e: TrafficEdge) => ({
        ...e,
        type: 'traffic',
        markerEnd,
        data: { config: { ...defaultEdgeConfig(), ...e.data?.config } },
      })),
  }
}
