import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, type DragEvent } from 'react'
import { ConfigPanel } from './components/ConfigPanel'
import { DRAG_TYPE, Palette } from './components/Palette'
import { ServiceNode } from './components/ServiceNode'
import { TopBar } from './components/TopBar'
import { TrafficEdge } from './components/TrafficEdge'
import { serviceByType } from './engine/services'
import { markerEnd, useStore } from './store'

const nodeTypes: NodeTypes = { service: ServiceNode }
const edgeTypes: EdgeTypes = { traffic: TrafficEdge }
const defaultEdgeOptions = { type: 'traffic', markerEnd }

function Editor() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const addService = useStore((s) => s.addService)
  const { screenToFlowPosition } = useReactFlow()

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
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </main>
      <ConfigPanel />
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
