import { Handle, Position, type NodeProps } from '@xyflow/react'
import { serviceByType } from '../engine/services'
import { iconByType } from '../icons'
import type { ServiceNode as ServiceNodeType } from '../store'

export function ServiceIcon({ type, size = 36 }: { type: string; size?: number }) {
  const def = serviceByType[type]
  const icon = iconByType[type]
  if (icon) return <img className="service-icon" src={icon} alt="" width={size} height={size} draggable={false} />
  return (
    <div className="service-icon" style={{ background: def?.color ?? '#888', width: size, height: size, fontSize: size * 0.4 }}>
      {def?.label.slice(0, 2) ?? '?'}
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
