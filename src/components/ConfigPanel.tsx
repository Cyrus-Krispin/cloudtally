import { monthlyRequests } from '../engine/compute'
import { serviceByType } from '../engine/services'
import type { EdgeConfig, LineItem } from '../engine/types'
import { count, money, unitPrice } from '../format'
import { useStore } from '../store'
import { useCosts } from '../useCosts'
import { Field, NumberInput } from './fields'
import { ServiceIcon } from './ServiceNode'

function CostTable({ items, total }: { items: LineItem[]; total: number }) {
  if (!items.length) return null
  return (
    <section>
      <h3>Monthly cost</h3>
      <table className="cost-table">
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                {item.label}
                <div className="cost-detail">
                  {count(item.quantity)} {item.unit} × {unitPrice(item.unitPrice)}
                </div>
              </td>
              <td className="num">{money(item.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
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
  const inCycle = costs.cycleNodeIds.includes(id)

  return (
    <>
      <header className="panel-header">
        <ServiceIcon type={node.data.type} />
        <div>
          <input
            className="name-input"
            value={node.data.name}
            onChange={(e) => updateNode(id, { name: e.target.value })}
            aria-label="Name"
          />
          <div className="panel-subtitle">{def.label}</div>
        </div>
      </header>
      <p className="description">{def.description}</p>
      {inCycle && <p className="warning">This service is part of a loop, so its traffic may be undercounted.</p>}

      {def.isSource ? (
        <section>
          <h3>Traffic</h3>
          <p className="description">
            {count(workload.dailyActiveUsers)} daily users × {workload.requestsPerUserPerDay} requests ={' '}
            <strong>{count(monthlyRequests(workload))} requests/month</strong>. Change
            this in the top bar.
          </p>
        </section>
      ) : (
        <>
          {def.fields.length > 0 && (
            <section>
              <h3>Configuration</h3>
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
          <section>
            <h3>Incoming traffic</h3>
            <dl className="stats">
              <dt>Requests</dt>
              <dd>{count(cost.usage.requests)}/mo</dd>
              <dt>Reads / writes</dt>
              <dd>
                {count(cost.usage.reads)} / {count(cost.usage.writes)}
              </dd>
              <dt>Average / peak</dt>
              <dd>
                {count(cost.usage.averageRps)} / {count(cost.usage.peakRps)} req/s
              </dd>
              <dt>Data</dt>
              <dd>{count(cost.usage.gb)} GB/mo</dd>
            </dl>
          </section>
          <CostTable items={cost.items} total={cost.total} />
          {def.assumptions && (
            <ul className="assumptions">
              {def.assumptions(node.data.config).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <button className="danger" onClick={() => removeElement(id)}>
        Delete service
      </button>
    </>
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
  const fromUsers = source?.data.type === 'clients'
  const viaCloudFront = source?.data.type === 'cloudfront' || target?.data.type === 'cloudfront'

  return (
    <>
      <header className="panel-header">
        <div>
          <div className="panel-title">Connection</div>
          <div className="panel-subtitle">
            {source?.data.name} → {target?.data.name}
          </div>
        </div>
      </header>
      <section>
        <h3>Traffic</h3>
        <div className="field">
          <label htmlFor="calls">Calls per incoming request</label>
          <NumberInput id="calls" value={c.callsPerRequest} min={0} step={0.1} onChange={(v) => set({ callsPerRequest: v })} />
          <p className="help">
            For every request that reaches {source?.data.name}, how many calls go to {target?.data.name}? Use 0.5 for
            every other request.
          </p>
        </div>
        <div className="field">
          <label htmlFor="op">Operation</label>
          <select id="op" value={c.operation} onChange={(e) => set({ operation: e.target.value as EdgeConfig['operation'] })}>
            <option value="read">Read</option>
            <option value="write">Write</option>
          </select>
          <p className="help">Sets read vs write pricing on DynamoDB and S3.</p>
        </div>
        <div className="field">
          <label htmlFor="payload">
            Payload per call <span className="unit">(KB)</span>
          </label>
          <NumberInput id="payload" value={c.payloadKB} min={0} step={1} onChange={(v) => set({ payloadKB: v })} />
        </div>
        <div className="field">
          <label htmlFor="network">Network path</label>
          <select
            id="network"
            value={c.network}
            disabled={fromUsers || viaCloudFront}
            onChange={(e) => set({ network: e.target.value as EdgeConfig['network'] })}
          >
            <option value="same-az">Same availability zone (free)</option>
            <option value="cross-az">Across availability zones ($0.02/GB)</option>
            <option value="internet">Out to the internet ($0.09/GB)</option>
          </select>
          {fromUsers && !viaCloudFront && <p className="help">Responses to users are always charged as internet transfer.</p>}
          {viaCloudFront && <p className="help">CloudFront bills this traffic itself.</p>}
        </div>
      </section>
      {cost && (
        <section>
          <h3>Result</h3>
          <dl className="stats">
            <dt>Calls</dt>
            <dd>{count(cost.calls)}/mo</dd>
            <dt>Data</dt>
            <dd>{count(cost.gb)} GB/mo</dd>
          </dl>
        </section>
      )}
      {cost && <CostTable items={cost.items} total={cost.total} />}
      <button className="danger" onClick={() => removeElement(id)}>
        Delete connection
      </button>
    </>
  )
}

export function ConfigPanel() {
  const selectedNode = useStore((s) => s.nodes.find((n) => n.selected)?.id)
  const selectedEdge = useStore((s) => s.edges.find((e) => e.selected)?.id)

  return (
    <aside className="panel">
      {selectedNode ? (
        <NodePanel key={selectedNode} id={selectedNode} />
      ) : selectedEdge ? (
        <EdgePanel key={selectedEdge} id={selectedEdge} />
      ) : (
        <div className="empty-panel">
          <h3>How it works</h3>
          <ol>
            <li>Set your traffic in the top bar.</li>
            <li>Drag services onto the canvas.</li>
            <li>Connect them, dragging from the right dot of one service to another.</li>
            <li>Click a service or connection to configure it and see its cost.</li>
          </ol>
          <p className="description">
            Traffic starts at <strong>Users</strong> and flows along connections. Each connection multiplies it, for
            example 1 API request → 2 database reads.
          </p>
        </div>
      )}
    </aside>
  )
}
