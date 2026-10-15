import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { serviceByType } from './engine/services'
import type { Config, EdgeConfig, Workload } from './engine/types'

export type ServiceNodeData = { type: string; name: string; config: Config }
export type TrafficEdgeData = { config: EdgeConfig }
export type ServiceNode = Node<ServiceNodeData, 'service'>
export type TrafficEdge = Edge<TrafficEdgeData, 'traffic'>

export interface Diagram {
  version: 1
  workload: Workload
  nodes: ServiceNode[]
  edges: TrafficEdge[]
}

interface State {
  workload: Workload
  nodes: ServiceNode[]
  edges: TrafficEdge[]
  onNodesChange: (changes: NodeChange<ServiceNode>[]) => void
  onEdgesChange: (changes: EdgeChange<TrafficEdge>[]) => void
  onConnect: (connection: Connection) => void
  addService: (type: string, position: { x: number; y: number }) => void
  updateNode: (id: string, patch: Partial<Pick<ServiceNodeData, 'name'>> & { config?: Config }) => void
  updateEdge: (id: string, patch: Partial<EdgeConfig>) => void
  setWorkload: (patch: Partial<Workload>) => void
  removeElement: (id: string) => void
  loadDiagram: (diagram: Diagram) => void
  clear: () => void
}

export const defaultWorkload: Workload = {
  dailyActiveUsers: 10_000,
  requestsPerUserPerDay: 20,
  peakToAverage: 3,
}

const defaultEdgeConfig = (targetType: string): EdgeConfig => ({
  callsPerRequest: 1,
  operation: targetType === 'sqs' ? 'write' : 'read',
  payloadKB: 4,
  network: 'same-az',
})

export const markerEnd = { type: MarkerType.ArrowClosed, width: 18, height: 18 }

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

const makeNode = (id: string, type: string, x: number, y: number, config: Config = {}): ServiceNode => ({
  id,
  type: 'service',
  position: { x, y },
  data: { type, name: serviceByType[type].label, config: { ...serviceByType[type].defaults, ...config } },
})

const makeEdge = (source: string, target: string, config: Partial<EdgeConfig> = {}, targetType = ''): TrafficEdge => ({
  id: `e-${source}-${target}`,
  source,
  target,
  type: 'traffic',
  markerEnd,
  data: { config: { ...defaultEdgeConfig(targetType), ...config } },
})

/** A small serverless API shown on first launch. */
export const exampleDiagram = (): Diagram => ({
  version: 1,
  workload: defaultWorkload,
  nodes: [
    makeNode('users', 'clients', 0, 120),
    makeNode('cdn', 'cloudfront', 280, 120, { cacheHitPercent: 60 }),
    makeNode('api', 'apigateway', 560, 120),
    makeNode('fn', 'lambda', 840, 120),
    makeNode('db', 'dynamodb', 1120, 20),
    makeNode('assets', 's3', 560, 300),
  ],
  edges: [
    makeEdge('users', 'cdn', { payloadKB: 20 }),
    makeEdge('cdn', 'api', { payloadKB: 4 }),
    makeEdge('cdn', 'assets', { callsPerRequest: 0.5, payloadKB: 50 }),
    makeEdge('api', 'fn'),
    makeEdge('fn', 'db', { callsPerRequest: 2, payloadKB: 2 }),
  ],
})

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...exampleDiagram(),
      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (connection) => {
        if (connection.source === connection.target) return
        const target = get().nodes.find((n) => n.id === connection.target)
        const edge = makeEdge(connection.source, connection.target, {}, target?.data.type)
        set({ edges: addEdge({ ...edge, ...connection, id: newId('e') }, get().edges) })
      },
      addService: (type, position) => {
        const node = makeNode(newId(type), type, position.x, position.y)
        set({
          nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), { ...node, selected: true }],
          edges: get().edges.map((e) => ({ ...e, selected: false })),
        })
      },
      updateNode: (id, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, name: patch.name ?? n.data.name, config: { ...n.data.config, ...patch.config } } }
              : n,
          ),
        }),
      updateEdge: (id, patch) =>
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { config: { ...e.data!.config, ...patch } } } : e,
          ),
        }),
      setWorkload: (patch) => set({ workload: { ...get().workload, ...patch } }),
      removeElement: (id) =>
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.id !== id && e.source !== id && e.target !== id),
        }),
      loadDiagram: (d) => set({ workload: { ...defaultWorkload, ...d.workload }, nodes: d.nodes, edges: d.edges }),
      clear: () => set({ nodes: [], edges: [] }),
    }),
    {
      name: 'cloudtally-diagram',
      version: 1,
      partialize: (s) => ({ workload: s.workload, nodes: s.nodes, edges: s.edges }),
    },
  ),
)

export const toDiagram = (s: Pick<State, 'workload' | 'nodes' | 'edges'>): Diagram => ({
  version: 1,
  workload: s.workload,
  nodes: s.nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
  edges: s.edges.map(({ id, source, target, sourceHandle, targetHandle, type, markerEnd, data }) => ({
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type,
    markerEnd,
    data,
  })),
})

/** Checks that an imported file looks like a diagram before loading it. */
export function parseDiagram(text: string): Diagram {
  const d = JSON.parse(text)
  if (!d || d.version !== 1 || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) {
    throw new Error('This file is not a cloudtally diagram.')
  }
  for (const n of d.nodes) {
    if (!serviceByType[n?.data?.type]) throw new Error(`Unknown service type: ${n?.data?.type}`)
  }
  return d
}
