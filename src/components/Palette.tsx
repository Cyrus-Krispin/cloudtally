import { services } from '../engine/services'
import type { ServiceDef } from '../engine/types'
import { ServiceIcon } from './ServiceNode'

export const DRAG_TYPE = 'application/cloudtally-service'

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const groups = new Map<string, ServiceDef[]>()
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s])

  return (
    <aside className="palette">
      <p className="hint">Drag onto the canvas, or click to add.</p>
      {[...groups].map(([category, defs]) => (
        <section key={category}>
          <h3>{category}</h3>
          {defs.map((def) => (
            <button
              key={def.type}
              className="palette-item"
              draggable
              title={def.description}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, def.type)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => onAdd(def.type)}
            >
              <ServiceIcon type={def.type} size={26} />
              <span>{def.label}</span>
            </button>
          ))}
        </section>
      ))}
    </aside>
  )
}
