import { useReactFlow } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { monthlyRequests } from '../engine/compute'
import { PRICES_AS_OF, REGION } from '../engine/prices'
import { serviceByType } from '../engine/services'
import { downloadJson, exportPng } from '../exporting'
import { count, money } from '../format'
import { exampleDiagram, parseDiagram, toDiagram, useStore } from '../store'
import { useCosts } from '../useCosts'
import { NumberInput } from './fields'
import { ScalingPanel } from './ScalingPanel'

function Breakdown() {
  const nodes = useStore((s) => s.nodes)
  const costs = useCosts()
  const rows = nodes
    .map((n) => ({ id: n.id, name: n.data.name, type: n.data.type, total: costs.nodes[n.id]?.total ?? 0 }))
    .filter((r) => !serviceByType[r.type]?.isSource)
    .sort((a, b) => b.total - a.total)
  const transfer = Object.values(costs.edges).reduce((sum, e) => sum + e.total, 0)
  const setSelected = useStore((s) => s.onNodesChange)

  return (
    <div className="breakdown">
      <table className="cost-table">
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="clickable"
              onClick={() => setSelected(nodes.map((n) => ({ type: 'select', id: n.id, selected: n.id === r.id })))}
            >
              <td>{r.name}</td>
              <td className="num">{money(r.total)}</td>
              <td className="num share">{costs.total > 0 ? Math.round((r.total / costs.total) * 100) : 0}%</td>
            </tr>
          ))}
          <tr>
            <td>Data transfer (connections)</td>
            <td className="num">{money(transfer)}</td>
            <td className="num share">{costs.total > 0 ? Math.round((transfer / costs.total) * 100) : 0}%</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total per month</td>
            <td className="num">{money(costs.total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <p className="help">
        {REGION} on-demand list prices from the AWS Price List API, as of {PRICES_AS_OF}. Estimates only.
      </p>
    </div>
  )
}

export function TopBar() {
  const workload = useStore((s) => s.workload)
  const setWorkload = useStore((s) => s.setWorkload)
  const loadDiagram = useStore((s) => s.loadDiagram)
  const clear = useStore((s) => s.clear)
  const { getNodes, fitView } = useReactFlow()
  const costs = useCosts()
  const fileInput = useRef<HTMLInputElement>(null)
  const [showScaling, setShowScaling] = useState(false)

  // Close open dropdowns when clicking anywhere else.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      document.querySelectorAll<HTMLDetailsElement>('.topbar details[open]').forEach((d) => {
        if (!d.contains(e.target as Node)) d.open = false
      })
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const onImport = async (file: File) => {
    try {
      loadDiagram(parseDiagram(await file.text()))
      setTimeout(() => fitView({ padding: 0.2 }), 50)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const nodes = useStore((s) => s.nodes)
  const onExportPng = () => {
    const rows = nodes
      .filter((n) => !serviceByType[n.data.type]?.isSource)
      .map((n) => ({ label: n.data.name, total: costs.nodes[n.id]?.total ?? 0 }))
      .sort((a, b) => b.total - a.total)
      .map((r) => ({ label: r.label, amount: money(r.total) }))
    const transfer = Object.values(costs.edges).reduce((sum, e) => sum + e.total, 0)
    return exportPng(
      getNodes(),
      `${money(costs.total)} / month`,
      `${count(workload.dailyActiveUsers)} daily users · ${workload.requestsPerUserPerDay} requests/user/day · ` +
        `${count(monthlyRequests(workload))} requests/month · ${REGION} on-demand, prices as of ${PRICES_AS_OF}` +
        (workload.applyFreeTier ? ' · free tier applied' : ''),
      [...rows, { label: 'Data transfer', amount: money(transfer) }],
    )
  }

  return (
    <header className="topbar">
      <div className="brand">
        cloud<span>tally</span>
      </div>

      <div className="workload">
        <label>
          Daily users
          <NumberInput value={workload.dailyActiveUsers} min={0} step={1000} onChange={(v) => setWorkload({ dailyActiveUsers: v })} />
        </label>
        <label>
          Requests/user/day
          <NumberInput
            value={workload.requestsPerUserPerDay}
            min={0}
            step={1}
            onChange={(v) => setWorkload({ requestsPerUserPerDay: v })}
          />
        </label>
        <label title="Peak traffic as a multiple of average. Used to size autoscaling services.">
          Peak ×
          <NumberInput value={workload.peakToAverage} min={1} step={0.5} onChange={(v) => setWorkload({ peakToAverage: v })} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={workload.applyFreeTier}
            onChange={(e) => setWorkload({ applyFreeTier: e.target.checked })}
          />
          Free tier
        </label>
        <span className="requests">= {count(monthlyRequests(workload))} req/mo</span>
      </div>

      <details className="total">
        <summary>
          <span className="total-amount">{money(costs.total)}</span>
          <span className="total-unit">/ month</span>
          <span className="total-caret">▾</span>
        </summary>
        <Breakdown />
      </details>

      <div className="actions">
        <button className="primary" onClick={() => setShowScaling(true)} title="See how cost changes with daily users">
          Scale
        </button>
        <button onClick={onExportPng}>Export PNG</button>
        <button onClick={() => downloadJson('cloudtally-diagram.json', toDiagram(useStore.getState()))}>Save JSON</button>
        <button onClick={() => fileInput.current?.click()}>Open JSON</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
        <details className="menu">
          <summary aria-label="More">⋯</summary>
          <div className="menu-items">
            <button
              onClick={() => {
                loadDiagram(exampleDiagram())
                setTimeout(() => fitView({ padding: 0.2 }), 50)
              }}
            >
              Load example
            </button>
            <button
              onClick={() => {
                if (confirm('Remove every service and connection?')) clear()
              }}
            >
              Clear canvas
            </button>
          </div>
        </details>
      </div>
      {showScaling && <ScalingPanel onClose={() => setShowScaling(false)} />}
    </header>
  )
}
