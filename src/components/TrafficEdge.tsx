import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { count, money } from '../format'
import type { TrafficEdge as TrafficEdgeType } from '../store'
import { useCosts } from '../useCosts'

export function TrafficEdge(props: EdgeProps<TrafficEdgeType>) {
  const { id, data, selected, markerEnd } = props
  const [path, labelX, labelY] = getBezierPath(props)
  const cost = useCosts().edges[id]
  const config = data?.config

  return (
    <>
      {/* Inline stroke so PNG export (which ignores stylesheet rules on SVG) still draws the line. */}
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: '#8d99a8', strokeWidth: 1.6 }} />
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan${selected ? ' selected' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {config && config.callsPerRequest !== 1 && <span>×{config.callsPerRequest} </span>}
          {config?.operation === 'write' ? 'write' : 'read'}
          {cost && <span className="edge-label-dim"> · {count(cost.calls)}/mo</span>}
          {cost && cost.total > 0 && <span className="edge-label-cost"> · {money(cost.total)}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
