import { Handle, Position, type NodeProps } from '@xyflow/react'
import { serviceByType } from '../engine/services'
import type { ServiceNode as ServiceNodeType } from '../store'

export function ServiceIcon({ type, size = 36 }: { type: string; size?: number }) {
  const def = serviceByType[type]
  return (
    <div
      className="service-icon"
      style={{ background: def?.color ?? '#888', width: size, height: size, fontSize: size * (def?.short.length > 2 ? 0.3 : 0.42) }}
    >
      {def?.short ?? '?'}
    </div>
  )
}

export function ServiceNode({ data, selected }: NodeProps<ServiceNodeType>) {
  const def = serviceByType[data.type]
  return (
    <div className={`service-node${selected ? ' selected' : ''}`}>
      {!def?.isSource && <Handle type="target" position={Position.Left} />}
      <ServiceIcon type={data.type} />
      <div className="service-node-text">
        <div className="service-node-name">{data.name}</div>
        {data.name !== def?.label && <div className="service-node-type">{def?.label}</div>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
