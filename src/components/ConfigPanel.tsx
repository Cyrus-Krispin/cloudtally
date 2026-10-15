import type { ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { monthlyRequests } from '../engine/compute'
import { serviceByType } from '../engine/services'
import type { EdgeConfig, LineItem } from '../engine/types'
import { count, money, unitPrice } from '../format'
import { useStore } from '../store'
import { useCosts } from '../useCosts'
import { Field, NumberInput } from './fields'
import { Icon } from './Icon'
import { ServiceIcon } from './ServiceNode'

function Costs({ items, total }: { items: LineItem[]; total: number }) {
  if (!items.length) return null
  return (
    <section className="panel-section">
      <div className="panel-total">
        <span>Monthly cost</span>
        <strong>{money(total)}</strong>
      </div>
      <ul className="line-items">
        {items.map((item, i) => (
          <li key={i} title={`${count(item.quantity)} ${item.unit} × ${unitPrice(item.unitPrice)}`}>
            <span>{item.label}</span>
            <span className="num">{money(item.cost)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stats({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="stats">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PanelShell({ icon, title, subtitle, children, onDelete }: { icon?: ReactNode; title: ReactNode; subtitle: string; children: ReactNode; onDelete: () => void }) {
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const deselect = () => {
    onNodesChange(nodes.filter((n) => n.selected).map((n) => ({ type: 'select', id: n.id, selected: false })))
    onEdgesChange(edges.filter((e) => e.selected).map((e) => ({ type: 'select', id: e.id, selected: false })))
  }

  return (
    <>
      <header className="panel-header">
        {icon}
        <div className="panel-heading">
          {title}
          <div className="panel-subtitle">{subtitle}</div>
        </div>
        <button className="icon-button" onClick={deselect} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="panel-body">{children}</div>
      <footer className="panel-footer">
        <button className="text-button danger" onClick={onDelete}>
          <Icon name="trash" size={14} />
          Delete
        </button>
      </footer>
    </>
  )
}

function NodePanel({ id }: { id: string }) {
  const node = useStore((s) => s.nodes.find((n) => n.id === id))!
  const updateNode = useStore((s) => s.updateNode)
  const removeElement = useStore((s) => s.removeElement)
  const workload = useStore((s) => s.workload)
  const costs = useCosts()
  const def = serviceByType[node.data.type]
  const cost = costs.nodes[id]
  const { usage } = cost

  return (
    <PanelShell
      icon={<ServiceIcon type={node.data.type} size={32} />}
      title={<input className="name-input" value={node.data.name} onChange={(e) => updateNode(id, { name: e.target.value })} aria-label="Name" />}
      subtitle={def.label}
      onDelete={() => removeElement(id)}
    >
      {costs.cycleNodeIds.includes(id) && <p className="warning">Part of a loop. Traffic may be undercounted.</p>}

      {def.isSource ? (
        <section className="panel-section">
          <Stats rows={[['Requests', `${count(monthlyRequests(workload))}/mo`]]} />
        </section>
      ) : (
        <>
          {def.fields.length > 0 && (
            <section className="panel-section">
              {def.fields.map((f) => (
                <Field
                  key={f.key}
                  field={f}
                  value={node.data.config[f.key] ?? def.defaults[f.key]}
                  onChange={(v) => updateNode(id, { config: { [f.key]: v } })}
                />
              ))}
            </section>
          )}
          <section className="panel-section">
            <h3>Traffic</h3>
            <Stats
              rows={[
                ['Requests', `${count(usage.requests)}/mo`],
                ...(usage.writes > 0 && usage.reads > 0
                  ? ([['Reads / writes', `${count(usage.reads)} / ${count(usage.writes)}`]] as [string, string][])
                  : []),
                ['Peak', `${count(usage.peakRps)} req/s`],
                ...(usage.gb > 0 ? ([['Data', `${count(usage.gb)} GB/mo`]] as [string, string][]) : []),
              ]}
            />
          </section>
          <Costs items={cost.items} total={cost.total} />
        </>
      )}
    </PanelShell>
  )
}

function EdgePanel({ id }: { id: string }) {
  const edge = useStore((s) => s.edges.find((e) => e.id === id))!
  const source = useStore((s) => s.nodes.find((n) => n.id === edge.source))
  const target = useStore((s) => s.nodes.find((n) => n.id === edge.target))
  const updateEdge = useStore((s) => s.updateEdge)
  const removeElement = useStore((s) => s.removeElement)
  const cost = useCosts().edges[id]
  const c = edge.data!.config
  const set = (patch: Partial<EdgeConfig>) => updateEdge(id, patch)
  const networkApplies = source?.data.type !== 'clients' && source?.data.type !== 'cloudfront' && target?.data.type !== 'cloudfront'

  return (
    <PanelShell title={<div className="panel-title">Connection</div>} subtitle={`${source?.data.name} → ${target?.data.name}`} onDelete={() => removeElement(id)}>
      <section className="panel-section">
        <div className="field">
          <label htmlFor="calls" title={`Calls to ${target?.data.name} for each request reaching ${source?.data.name}`}>
            Calls per request
          </label>
          <NumberInput id="calls" value={c.callsPerRequest} min={0} step={0.1} onChange={(v) => set({ callsPerRequest: v })} />
        </div>
        <div className="field">
          <label>Operation</label>
          <div className="segmented full">
            {(['read', 'write'] as const).map((op) => (
              <button key={op} className={c.operation === op ? 'active' : ''} onClick={() => set({ operation: op })}>
                {op === 'read' ? 'Read' : 'Write'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="payload">
            Payload <span className="unit">KB</span>
          </label>
          <NumberInput id="payload" value={c.payloadKB} min={0} step={1} onChange={(v) => set({ payloadKB: v })} />
        </div>
        {networkApplies && (
          <div className="field">
            <label htmlFor="network">Network</label>
            <select id="network" value={c.network} onChange={(e) => set({ network: e.target.value as EdgeConfig['network'] })}>
              <option value="same-az">Same AZ</option>
              <option value="cross-az">Cross-AZ</option>
              <option value="internet">Internet</option>
            </select>
          </div>
        )}
      </section>
      {cost && (
        <section className="panel-section">
          <h3>Traffic</h3>
          <Stats
            rows={[
              ['Calls', `${count(cost.calls)}/mo`],
              ['Data', `${count(cost.gb)} GB/mo`],
            ]}
          />
        </section>
      )}
      {cost && <Costs items={cost.items} total={cost.total} />}
    </PanelShell>
  )
}

function MultiPanel() {
  const nodes = useStore(useShallow((s) => s.nodes.filter((n) => n.selected)))
  const edgeCount = useStore((s) => s.edges.filter((e) => e.selected).length)
  const removeSelected = useStore((s) => s.removeSelected)
  const costs = useCosts()
  const total = nodes.reduce((sum, n) => sum + (costs.nodes[n.id]?.total ?? 0), 0)
  const parts = [nodes.length && `${nodes.length} service${nodes.length === 1 ? '' : 's'}`, edgeCount && `${edgeCount} connection${edgeCount === 1 ? '' : 's'}`]

  return (
    <PanelShell title={<div className="panel-title">{parts.filter(Boolean).join(', ')}</div>} subtitle="Selected" onDelete={removeSelected}>
      <section className="panel-section">
        <div className="panel-total">
          <span>Monthly cost</span>
          <strong>{money(total)}</strong>
        </div>
        <ul className="line-items">
          {nodes.map((n) => (
            <li key={n.id}>
              <span>{n.data.name}</span>
              <span className="num">{money(costs.nodes[n.id]?.total ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>
    </PanelShell>
  )
}

export function ConfigPanel() {
  const selectedCount = useStore((s) => s.nodes.filter((n) => n.selected).length + s.edges.filter((e) => e.selected).length)
  const selectedNode = useStore((s) => s.nodes.find((n) => n.selected)?.id)
  const selectedEdge = useStore((s) => s.edges.find((e) => e.selected)?.id)
  if (!selectedCount) return null
  if (selectedCount > 1) {
    return (
      <aside className="panel">
        <MultiPanel />
      </aside>
    )
  }

  return (
    <aside className="panel">
      {selectedNode ? <NodePanel key={selectedNode} id={selectedNode} /> : <EdgePanel key={selectedEdge} id={selectedEdge!} />}
    </aside>
  )
}
