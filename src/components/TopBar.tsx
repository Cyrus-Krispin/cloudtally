import { useReactFlow } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { computeCosts, monthlyRequests } from '../engine/compute'
import { PRICES_AS_OF, REGION } from '../engine/prices'
import { serviceByType } from '../engine/services'
import { downloadJson, exportPng } from '../exporting'
import { count, money } from '../format'
import { shareUrl } from '../share'
import { designs, parseDiagram, toDiagram, useStore, type Comparison, type Diagram } from '../store'
import { comparisonTemplates, templates } from '../templates'
import { toGraph, useCosts } from '../useCosts'
import { ComparePanel } from './ComparePanel'
import { NumberInput } from './fields'
import { GitHubMark, Icon, type IconName } from './Icon'
import { ScalingPanel } from './ScalingPanel'
import { ServiceIcon } from './ServiceNode'
import { REPO_URL } from '../links'

/** A button with a popover that closes on outside click or Escape. */
function Popover({
  button,
  label,
  className,
  children,
}: {
  button: ReactNode
  label?: string
  className: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`popover-anchor ${className}`} ref={ref}>
      <button className={`popover-trigger${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label}>
        {button}
      </button>
      {open && <div className="popover">{children(() => setOpen(false))}</div>}
    </div>
  )
}

function useServiceTotals() {
  const nodes = useStore((s) => s.nodes)
  const costs = useCosts()
  const rows = nodes
    .filter((n) => !serviceByType[n.data.type]?.isSource)
    .map((n) => ({ id: n.id, name: n.data.name, type: n.data.type, total: costs.nodes[n.id]?.total ?? 0 }))
    .sort((a, b) => b.total - a.total)
  const transfer = Object.values(costs.edges).reduce((sum, e) => sum + e.total, 0)
  return { rows, transfer, total: costs.total }
}

function Breakdown({ close }: { close: () => void }) {
  const { rows, transfer, total } = useServiceTotals()
  const nodes = useStore((s) => s.nodes)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const select = (id: string) => {
    onNodesChange(nodes.map((n) => ({ type: 'select', id: n.id, selected: n.id === id })))
    close()
  }
  const share = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <div className="breakdown">
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <button className="breakdown-row" onClick={() => select(r.id)}>
              <ServiceIcon type={r.type} size={18} />
              <span className="breakdown-name">{r.name}</span>
              <span className="breakdown-amount">{money(r.total)}</span>
              <span className="breakdown-bar" style={{ width: `${share(r.total)}%` }} />
            </button>
          </li>
        ))}
        {transfer > 0 && (
          <li>
            <div className="breakdown-row">
              <span className="breakdown-spacer" />
              <span className="breakdown-name">Data transfer</span>
              <span className="breakdown-amount">{money(transfer)}</span>
              <span className="breakdown-bar" style={{ width: `${share(transfer)}%` }} />
            </div>
          </li>
        )}
      </ul>
      <div className="breakdown-footer">
        {REGION} · on-demand · {PRICES_AS_OF}
      </div>
    </div>
  )
}

/** Switches the canvas between design A and B, with each one's monthly total. */
function DesignTabs() {
  const active = useStore((s) => s.active)
  const other = useStore((s) => s.other)
  const workload = useStore((s) => s.workload)
  const switchDesign = useStore((s) => s.switchDesign)
  const shownTotal = useCosts().total
  const hiddenTotal = useMemo(() => {
    if (!other) return null
    const g = toGraph(other.nodes, other.edges)
    return computeCosts(g.nodes, g.edges, workload).total
  }, [other, workload])

  return (
    <div className="segmented designs" role="tablist" aria-label="Designs">
      {(['a', 'b'] as const).map((id) => {
        const total = id === active ? shownTotal : hiddenTotal
        const name = id.toUpperCase()
        if (total === null) {
          return (
            <button key={id} title="Start design B as a copy of A" onClick={() => switchDesign(id)}>
              + {name}
            </button>
          )
        }
        return (
          <button
            key={id}
            role="tab"
            aria-selected={id === active}
            className={id === active ? 'active' : ''}
            title={`Design ${name}: ${money(total)}/mo`}
            onClick={() => switchDesign(id)}
          >
            <span className="design-letter">{name}</span>
            {other && <span className="design-total">{money(total)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function MenuItem({ icon, onClick, children, danger }: { icon: IconName; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button className={`menu-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <Icon name={icon} />
      {children}
    </button>
  )
}

export function TopBar() {
  const workload = useStore((s) => s.workload)
  const setWorkload = useStore((s) => s.setWorkload)
  const loadDiagram = useStore((s) => s.loadDiagram)
  const loadComparison = useStore((s) => s.loadComparison)
  const removeDesignB = useStore((s) => s.removeDesignB)
  const hasB = useStore((s) => s.other !== null)
  const clear = useStore((s) => s.clear)
  const { getNodes, fitView } = useReactFlow()
  const { rows, transfer, total } = useServiceTotals()
  const fileInput = useRef<HTMLInputElement>(null)
  const [showScaling, setShowScaling] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const load = (d: Diagram) => {
    loadDiagram(d)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }

  const loadPair = (c: Comparison) => {
    loadComparison(c)
    setTimeout(() => fitView({ padding: 0.2 }), 50)
  }

  const onCopyLink = async () => {
    const s = useStore.getState()
    const { a, b } = designs(s)
    try {
      await navigator.clipboard.writeText(shareUrl(b ? { a, b, active: s.active } : a))
      setToast('Link copied')
    } catch {
      setToast('Could not copy the link')
    }
  }

  const onImport = async (file: File) => {
    try {
      load(parseDiagram(await file.text()))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  const onExportPng = () =>
    exportPng(
      getNodes(),
      `${money(total)} / month`,
      `${count(workload.dailyActiveUsers)} daily users · ${workload.requestsPerUserPerDay} requests per user · ` +
        `${REGION} on-demand · prices as of ${PRICES_AS_OF}`,
      [...rows.map((r) => ({ label: r.name, amount: money(r.total) })), { label: 'Data transfer', amount: money(transfer) }],
    )

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/favicon.svg" alt="" width={22} height={22} />
        cloudtally
      </div>

      <DesignTabs />

      <div className="workload" title={`${count(monthlyRequests(workload))} requests per month`}>
        <label>
          <span>Daily users</span>
          <NumberInput value={workload.dailyActiveUsers} min={0} step={1000} onChange={(v) => setWorkload({ dailyActiveUsers: v })} />
        </label>
        <label>
          <span>Requests / user</span>
          <NumberInput value={workload.requestsPerUserPerDay} min={0} step={1} onChange={(v) => setWorkload({ requestsPerUserPerDay: v })} />
        </label>
        <label title="Peak traffic as a multiple of the average">
          <span>Peak</span>
          <NumberInput value={workload.peakToAverage} min={1} step={0.5} onChange={(v) => setWorkload({ peakToAverage: v })} />
          <span className="suffix">×</span>
        </label>
      </div>

      <div className="topbar-right">
        <Popover
          className="total"
          label="Cost breakdown"
          button={
            <>
              <span className="total-amount">{money(total)}</span>
              <span className="total-unit">/mo</span>
              <Icon name="chevronDown" size={14} />
            </>
          }
        >
          {(close) => <Breakdown close={close} />}
        </Popover>

        <button className="button" onClick={() => setShowScaling(true)} title="Cost at scale">
          <Icon name="chart" />
          Scale
        </button>

        <button
          className="button"
          onClick={() => setShowCompare(true)}
          disabled={!hasB}
          title={hasB ? 'Compare design A and B' : 'Add design B to compare'}
        >
          <Icon name="compare" />
          Compare
        </button>

        <a className="icon-button github" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="cloudtally on GitHub" title="GitHub">
          <GitHubMark size={18} />
        </a>

        <Popover className="menu" label="More actions" button={<Icon name="more" size={18} />}>
          {(close) => (
            <div className="menu-items" onClick={close}>
              <MenuItem icon="link" onClick={onCopyLink}>
                Copy share link
              </MenuItem>
              <MenuItem icon="image" onClick={onExportPng}>
                Export PNG
              </MenuItem>
              <MenuItem icon="download" onClick={() => downloadJson('cloudtally-diagram.json', toDiagram(useStore.getState()))}>
                Save JSON
              </MenuItem>
              <MenuItem icon="upload" onClick={() => fileInput.current?.click()}>
                Open JSON
              </MenuItem>
              <hr />
              <div className="menu-label">Templates</div>
              {templates.map((t) => (
                <MenuItem key={t.id} icon="template" onClick={() => load(t.diagram())}>
                  {t.name}
                </MenuItem>
              ))}
              {comparisonTemplates.map((t) => (
                <MenuItem key={t.id} icon="compare" onClick={() => loadPair(t.comparison())}>
                  {t.name}
                </MenuItem>
              ))}
              <hr />
              <MenuItem icon="info" onClick={() => (location.href = '/about')}>
                About cloudtally
              </MenuItem>
              <MenuItem icon="trash" danger onClick={() => confirm('Remove every service and connection?') && clear()}>
                Clear canvas
              </MenuItem>
              {hasB && (
                <MenuItem icon="trash" danger onClick={() => confirm('Remove design B?') && removeDesignB()}>
                  Remove design B
                </MenuItem>
              )}
            </div>
          )}
        </Popover>
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
      </div>
      {showScaling && <ScalingPanel onClose={() => setShowScaling(false)} />}
      {showCompare && <ComparePanel onClose={() => setShowCompare(false)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </header>
  )
}
