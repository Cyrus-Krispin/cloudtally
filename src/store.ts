import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  defaultWorkload,
  makeEdge,
  makeNode,
  toDiagram,
  type Comparison,
  type Diagram,
  type ServiceNode,
  type ServiceNodeData,
  type TrafficEdge,
} from './diagram'
import type { DesignId } from './engine/compare'
import type { Config, EdgeConfig, Workload } from './engine/types'
import { defaultTemplate } from './templates'

export * from './diagram'

interface Snapshot {
  workload: Workload
  nodes: ServiceNode[]
  edges: TrafficEdge[]
}

/** One design's canvas and its own undo history. The workload is shared by both designs. */
export interface Design {
  nodes: ServiceNode[]
  edges: TrafficEdge[]
  past: Snapshot[]
  future: Snapshot[]
}

interface State extends Snapshot {
  past: Snapshot[]
  future: Snapshot[]
  clipboard: Snapshot | null
  /** The design on the canvas. */
  active: DesignId
  /** The design not on the canvas, or null until design B is started. */
  other: Design | null
  /** Shows a design on the canvas. Design B starts as a copy of A. */
  switchDesign: (id: DesignId) => void
  removeDesignB: () => void
  loadComparison: (c: Comparison) => void
  onNodesChange: (changes: NodeChange<ServiceNode>[]) => void
  onEdgesChange: (changes: EdgeChange<TrafficEdge>[]) => void
  onConnect: (connection: Connection) => void
  /** Saves an undo point before a node drag starts. */
  beginDrag: () => void
  addService: (type: string, position: { x: number; y: number }) => void
  updateNode: (id: string, patch: Partial<Pick<ServiceNodeData, 'name'>> & { config?: Config }) => void
  updateEdge: (id: string, patch: Partial<EdgeConfig>) => void
  setWorkload: (patch: Partial<Workload>) => void
  removeElement: (id: string) => void
  removeSelected: () => void
  selectAll: () => void
  copySelected: () => void
  paste: () => void
  undo: () => void
  redo: () => void
  loadDiagram: (diagram: Diagram) => void
  clear: () => void
}

const HISTORY_LIMIT = 100
// Edits to the same field within this window (typing, stepping a number) form one undo step.
const COALESCE_MS = 1000

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

const deselected = <T extends { selected?: boolean }>(items: T[]) => items.map((i) => (i.selected ? { ...i, selected: false } : i))

interface Saved extends Snapshot {
  active: DesignId
  other: Pick<Design, 'nodes' | 'edges'> | null
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      let lastKey: string | null = null
      let lastTime = 0

      const pushed = (past: Snapshot[], snapshot: Snapshot) => [...past.slice(-(HISTORY_LIMIT - 1)), snapshot]

      // The workload is shared, so a design coming back on the canvas takes the current one into its
      // history. Undo there then can't revert a workload change made while the other design was showing.
      const rebased = (d: Design, workload: Workload): Design => ({
        ...d,
        past: d.past.map((s) => ({ ...s, workload })),
        future: d.future.map((s) => ({ ...s, workload })),
      })

      const onCanvas = (): Design => {
        const { nodes, edges, past, future } = get()
        return { nodes: deselected(nodes), edges: deselected(edges), past, future }
      }

      /** Records the current diagram as an undo point. */
      const checkpoint = (key?: string) => {
        const now = Date.now()
        if (key && key === lastKey && now - lastTime < COALESCE_MS) {
          lastTime = now
          return
        }
        lastKey = key ?? null
        lastTime = now
        const { workload, nodes, edges, past } = get()
        set({ past: pushed(past, { workload, nodes: deselected(nodes), edges: deselected(edges) }), future: [] })
      }

      const restore = (from: 'past' | 'future') => {
        const { workload, nodes, edges, past, future } = get()
        const stack = from === 'past' ? past : future
        if (!stack.length) return
        const target = stack[stack.length - 1]
        const current = { workload, nodes: deselected(nodes), edges: deselected(edges) }
        lastKey = null
        set({
          ...target,
          past: from === 'past' ? past.slice(0, -1) : [...past, current],
          future: from === 'past' ? [...future, current] : future.slice(0, -1),
        })
      }

      return {
        ...defaultTemplate.diagram(),
        past: [],
        future: [],
        clipboard: null,
        active: 'a',
        other: null,
        switchDesign: (id) => {
          const { active, other, workload } = get()
          if (id === active) return
          const current = onCanvas()
          const next = other ?? { nodes: current.nodes, edges: current.edges, past: [], future: [] }
          lastKey = null
          set({ ...rebased(next, workload), active: id, other: current })
        },
        removeDesignB: () => {
          const { active, other, workload } = get()
          if (!other) return
          lastKey = null
          set(active === 'b' ? { ...rebased(other, workload), active: 'a', other: null } : { other: null })
        },
        loadComparison: (c) => {
          const { workload, active, other } = get()
          const current = onCanvas()
          const slots = { [active]: current, [active === 'a' ? 'b' : 'a']: other } as Record<DesignId, Design | null>
          // Each design keeps its history, so undo on either one brings back what it showed before.
          const next = (id: DesignId): Design => {
            const was = slots[id]
            return {
              nodes: c[id].nodes,
              edges: c[id].edges,
              past: was ? pushed(was.past, { workload, nodes: was.nodes, edges: deselected(was.edges) }) : [],
              future: [],
            }
          }
          const hidden = c.active === 'a' ? 'b' : 'a'
          lastKey = null
          set({ ...next(c.active), workload: { ...defaultWorkload, ...c.a.workload }, active: c.active, other: next(hidden) })
        },
        onNodesChange: (changes) => {
          if (changes.some((c) => c.type === 'remove')) checkpoint()
          set({ nodes: applyNodeChanges(changes, get().nodes) })
        },
        onEdgesChange: (changes) => {
          if (changes.some((c) => c.type === 'remove')) checkpoint()
          set({ edges: applyEdgeChanges(changes, get().edges) })
        },
        onConnect: (connection) => {
          if (connection.source === connection.target) return
          checkpoint()
          const target = get().nodes.find((n) => n.id === connection.target)
          const edge = makeEdge(connection.source, connection.target, {}, target?.data.type)
          set({ edges: addEdge({ ...edge, ...connection, id: newId('e') }, get().edges) })
        },
        beginDrag: () => checkpoint(),
        addService: (type, position) => {
          checkpoint()
          const node = makeNode(newId(type), type, position.x, position.y)
          set({ nodes: [...deselected(get().nodes), { ...node, selected: true }], edges: deselected(get().edges) })
        },
        updateNode: (id, patch) => {
          checkpoint(`node:${id}:${Object.keys(patch.config ?? { name: 1 }).join()}`)
          set({
            nodes: get().nodes.map((n) =>
              n.id === id
                ? { ...n, data: { ...n.data, name: patch.name ?? n.data.name, config: { ...n.data.config, ...patch.config } } }
                : n,
            ),
          })
        },
        updateEdge: (id, patch) => {
          checkpoint(`edge:${id}:${Object.keys(patch).join()}`)
          set({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { config: { ...e.data!.config, ...patch } } } : e)) })
        },
        setWorkload: (patch) => {
          checkpoint(`workload:${Object.keys(patch).join()}`)
          set({ workload: { ...get().workload, ...patch } })
        },
        removeElement: (id) => {
          checkpoint()
          set({
            nodes: get().nodes.filter((n) => n.id !== id),
            edges: get().edges.filter((e) => e.id !== id && e.source !== id && e.target !== id),
          })
        },
        removeSelected: () => {
          const { nodes, edges } = get()
          const gone = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
          if (!gone.size && !edges.some((e) => e.selected)) return
          checkpoint()
          set({
            nodes: nodes.filter((n) => !gone.has(n.id)),
            edges: edges.filter((e) => !e.selected && !gone.has(e.source) && !gone.has(e.target)),
          })
        },
        selectAll: () =>
          set({
            nodes: get().nodes.map((n) => ({ ...n, selected: true })),
            edges: get().edges.map((e) => ({ ...e, selected: true })),
          }),
        copySelected: () => {
          const { nodes, edges, workload } = get()
          const picked = nodes.filter((n) => n.selected)
          if (!picked.length) return
          const ids = new Set(picked.map((n) => n.id))
          set({
            clipboard: {
              workload,
              nodes: deselected(picked),
              edges: deselected(edges.filter((e) => ids.has(e.source) && ids.has(e.target))),
            },
          })
        },
        paste: () => {
          const { clipboard, nodes, edges } = get()
          if (!clipboard) return
          checkpoint()
          const idMap = new Map(clipboard.nodes.map((n) => [n.id, newId(n.data.type)]))
          const pasted = clipboard.nodes.map((n) => ({
            ...n,
            id: idMap.get(n.id)!,
            position: { x: n.position.x + 40, y: n.position.y + 40 },
            selected: true,
          }))
          const pastedEdges = clipboard.edges.map((e) => ({
            ...e,
            id: newId('e'),
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
          }))
          set({
            nodes: [...deselected(nodes), ...pasted],
            edges: [...deselected(edges), ...pastedEdges],
            // Paste the next copy a further step away.
            clipboard: { ...clipboard, nodes: deselected(pasted), edges: pastedEdges },
          })
        },
        undo: () => restore('past'),
        redo: () => restore('future'),
        loadDiagram: (d) => {
          checkpoint()
          set({ workload: { ...defaultWorkload, ...d.workload }, nodes: d.nodes, edges: d.edges })
        },
        clear: () => {
          checkpoint()
          set({ nodes: [], edges: [] })
        },
      }
    },
    {
      name: 'cloudtally-diagram',
      version: 1,
      partialize: (s): Saved => ({
        workload: s.workload,
        nodes: s.nodes,
        edges: s.edges,
        active: s.active,
        other: s.other && { nodes: s.other.nodes, edges: s.other.edges },
      }),
      merge: (saved, current) => {
        const s = saved as Partial<Saved> | undefined
        const other = s?.other ? { ...s.other, past: [], future: [] } : null
        // Older saves have one design and no `active`.
        return { ...current, ...s, active: other ? (s?.active ?? 'a') : 'a', other }
      },
    },
  ),
)

/** Both designs as saved diagrams, with B null until it is started. */
export function designs(s: Pick<State, 'workload' | 'nodes' | 'edges' | 'active' | 'other'>): { a: Diagram; b: Diagram | null } {
  const shown = toDiagram(s)
  const hidden = s.other && toDiagram({ workload: s.workload, nodes: s.other.nodes, edges: s.other.edges })
  return s.active === 'a' ? { a: shown, b: hidden } : { a: hidden!, b: shown }
}
