import { useState } from 'react'
import { services } from '../engine/services'
import type { ServiceDef } from '../engine/types'
import { Icon } from './Icon'
import { ServiceIcon } from './ServiceNode'

export const DRAG_TYPE = 'application/cloudtally-service'

const readCollapsed = () => {
  try {
    return localStorage.getItem('cloudtally-palette') === 'collapsed'
  } catch {
    return false
  }
}

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed(!collapsed)
    try {
      localStorage.setItem('cloudtally-palette', collapsed ? 'open' : 'collapsed')
    } catch {
      // Preference only; ignore storage failures.
    }
  }

  const groups = new Map<string, ServiceDef[]>()
  for (const s of services) groups.set(s.category, [...(groups.get(s.category) ?? []), s])

  return (
    <aside className={`palette${collapsed ? ' collapsed' : ''}`}>
      <div className="palette-header">
        {!collapsed && <span>Services</span>}
        <button className="icon-button" onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
        </button>
      </div>
      <div className="palette-list">
        {[...groups].map(([category, defs]) => (
          <section key={category}>
            {!collapsed && <h3>{category}</h3>}
            {defs.map((def) => (
              <button
                key={def.type}
                className="palette-item"
                draggable
                title={collapsed ? def.label : undefined}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, def.type)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => onAdd(def.type)}
              >
                <ServiceIcon type={def.type} size={24} />
                {!collapsed && <span>{def.label}</span>}
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}
