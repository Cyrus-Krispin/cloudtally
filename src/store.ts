import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  defaultWorkload,
  makeEdge,
  makeNode,
  type Diagram,
  type ServiceNode,
  type ServiceNodeData,
  type TrafficEdge,
} from './diagram'
import type { Config, EdgeConfig, Workload } from './engine/types'
import { defaultTemplate } from './templates'

export * from './diagram'

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

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...defaultTemplate.diagram(),
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
