import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, type DragEvent } from 'react'
import { ConfigPanel } from './components/ConfigPanel'
import { DRAG_TYPE, Palette } from './components/Palette'
import { ServiceNode } from './components/ServiceNode'
import { TopBar } from './components/TopBar'
import { Icon } from './components/Icon'
import { TrafficEdge } from './components/TrafficEdge'
import { serviceByType } from './engine/services'
import { diagramFromHash } from './share'
import { markerEnd, useStore } from './store'

const nodeTypes: NodeTypes = { service: ServiceNode }
const edgeTypes: EdgeTypes = { traffic: TrafficEdge }
const defaultEdgeOptions = { type: 'traffic', markerEnd }

/** Editor keyboard shortcuts. Ignored while typing in a field. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }
      if (mod && key === 'z') run(e.shiftKey ? s.redo : s.undo)
      else if (mod && key === 'y') run(s.redo)
      else if (mod && key === 'c') s.copySelected()
      else if (mod && key === 'x') run(() => (s.copySelected(), s.removeSelected()))
      else if (mod && key === 'v') run(s.paste)
      else if (mod && key === 'd') run(() => (s.copySelected(), s.paste()))
      else if (mod && key === 'a') run(s.selectAll)
      else if (!mod && (key === 'delete' || key === 'backspace')) run(s.removeSelected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Editor() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const addService = useStore((s) => s.addService)
  const loadDiagram = useStore((s) => s.loadDiagram)
  const beginDrag = useStore((s) => s.beginDrag)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  useShortcuts()
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Open a shared link's diagram, then drop the hash so later edits don't fight the URL.
  useEffect(() => {
    const shared = diagramFromHash(location.hash)
    if (!shared) return
    loadDiagram(shared)
    history.replaceState(null, '', location.pathname + location.search)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }, [loadDiagram, fitView])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(DRAG_TYPE)
      if (!serviceByType[type]) return
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addService(type, { x: p.x - 70, y: p.y - 25 })
    },
    [addService, screenToFlowPosition],
  )

  const addAtCenter = (type: string) => {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect()
    const p = screenToFlowPosition({ x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 })
    // Offset a little each time so repeated clicks don't stack exactly.
    const jitter = (nodes.length % 5) * 20
    addService(type, { x: p.x - 70 + jitter, y: p.y - 25 + jitter })
  }

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <Palette onAdd={addAtCenter} />
        <main className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={beginDrag}
            onSelectionDragStart={beginDrag}
            deleteKeyCode={null}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panOnScroll
            panActivationKeyCode="Space"
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            fitView
            fitViewOptions={{ padding: 0.2 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#d4d4d8" />
            <Controls showInteractive={false}>
              <ControlButton onClick={undo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo">
                <Icon name="undo" size={14} />
              </ControlButton>
              <ControlButton onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)" aria-label="Redo">
                <Icon name="redo" size={14} />
              </ControlButton>
            </Controls>
          </ReactFlow>
        </main>
        <ConfigPanel />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  )
}
