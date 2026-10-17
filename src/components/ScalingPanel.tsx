import { useMemo, useState, type MouseEvent } from 'react'
import { computeScaling, dauSteps, MAX_DAU, MIN_DAU, type ScalePoint } from '../engine/scaling'
import { serviceByType } from '../engine/services'
import { count, money } from '../format'
import { useStore } from '../store'
import { useGraph } from '../useCosts'
import { axisMoney, DAU_TICKS, HEIGHT, MARGIN, useEscape, useWidth } from './chart'
import { Icon } from './Icon'

/** Categorical colors in fixed order, checked for colour-blind separation between neighbours. */
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

type Mode = 'lines' | 'stacked' | 'table'

interface Series {
  key: string
  label: string
  color: string
  value: (p: ScalePoint) => number
}

/** One series per service plus data transfer. Past eight, the cheapest services fold into "Other". */
function buildSeries(names: { id: string; name: string }[], points: ScalePoint[]): Series[] {
  const last = points[points.length - 1]
  let services = names
  let other: string[] = []
  const hasTransfer = points.some((p) => p.transfer > 0)
  const room = PALETTE.length - (hasTransfer ? 1 : 0)
  if (names.length > room) {
    const ranked = [...names].sort((a, b) => (last?.nodes[b.id] ?? 0) - (last?.nodes[a.id] ?? 0))
    const keep = new Set(ranked.slice(0, room - 1).map((n) => n.id))
    services = names.filter((n) => keep.has(n.id))
    other = names.filter((n) => !keep.has(n.id)).map((n) => n.id)
  }
  const series: Series[] = services.map((n) => ({ key: n.id, label: n.name, color: '', value: (p) => p.nodes[n.id] ?? 0 }))
  if (other.length) {
    series.push({ key: '__other', label: `Other (${other.length})`, color: '', value: (p) => other.reduce((s, id) => s + (p.nodes[id] ?? 0), 0) })
  }
  if (hasTransfer) series.push({ key: '__transfer', label: 'Data transfer', color: '', value: (p) => p.transfer })
  return series.map((s, i) => ({ ...s, color: PALETTE[i] }))
}

/** Round up to 1, 2 or 5 × a power of ten, for a linear axis maximum. */
const niceCeil = (v: number) => {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

function Chart({ points, series, mode, currentDau }: { points: ScalePoint[]; series: Series[]; mode: 'lines' | 'stacked'; currentDau: number }) {
  const setWorkload = useStore((s) => s.setWorkload)
  const [wrapRef, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 10)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const logMin = Math.log10(MIN_DAU)
  const logSpan = Math.log10(MAX_DAU) - logMin
  const x = (dau: number) => MARGIN.left + ((Math.log10(dau) - logMin) / logSpan) * innerW

  const maxTotal = Math.max(...points.map((p) => p.total), 0)
  let y: (v: number) => number
  let yTicks: number[]
  if (mode === 'lines') {
    // Log scale, so services that differ by orders of magnitude are all readable.
    const positives = points.flatMap((p) => [p.total, ...series.map((s) => s.value(p))]).filter((v) => v > 0)
    const top = Math.ceil(Math.log10(Math.max(maxTotal, 1)))
    const bottom = Math.max(Math.floor(Math.log10(Math.min(...positives, 10 ** top))), top - 6, -2)
    const lo = bottom === top ? top - 1 : bottom
    y = (v) => MARGIN.top + innerH - ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (top - lo)) * innerH
    yTicks = Array.from({ length: top - lo + 1 }, (_, i) => 10 ** (lo + i))
  } else {
    const top = niceCeil(maxTotal)
    y = (v) => MARGIN.top + innerH - (v / top) * innerH
    yTicks = Array.from({ length: 5 }, (_, i) => (top * i) / 4)
  }

  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(points[i].dailyActiveUsers)},${y(v)}`).join('')

  // Running totals for the stacked view: each band sits on the ones before it.
  const stacks = useMemo(() => {
    const base = points.map(() => 0)
    return series.map((s) => {
      const lower = [...base]
      points.forEach((p, i) => (base[i] += s.value(p)))
      return { series: s, lower, upper: [...base] }
    })
  }, [points, series])

  const nearest = (e: MouseEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.dailyActiveUsers) - px) < Math.abs(x(points[best].dailyActiveUsers) - px)) best = i
    })
    return best
  }

  const hovered = hover === null ? null : points[hover]
  const hoverX = hovered ? x(hovered.dailyActiveUsers) : 0
  const inRange = currentDau >= MIN_DAU && currentDau <= MAX_DAU

  return (
    <div className="scaling-chart" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Monthly cost by daily users"
        onPointerMove={(e) => setHover(nearest(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => setWorkload({ dailyActiveUsers: points[nearest(e)].dailyActiveUsers })}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line className="grid" x1={MARGIN.left} x2={MARGIN.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={MARGIN.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {axisMoney(t)}
            </text>
          </g>
        ))}
        {DAU_TICKS.map((t) => (
          <text key={t} className="tick" x={x(t)} y={HEIGHT - 10} textAnchor="middle">
            {count(t)}
          </text>
        ))}

        {mode === 'stacked'
          ? stacks.map(({ series: s, lower, upper }) => (
              <path
                key={s.key}
                className="band"
                fill={s.color}
                d={`${path(upper)}${[...lower].reverse().map((v, j) => `L${x(points[points.length - 1 - j].dailyActiveUsers)},${y(v)}`).join('')}Z`}
              />
            ))
          : series.map((s) => <path key={s.key} className="series-line" stroke={s.color} d={path(points.map(s.value))} />)}
        <path className="total-line" d={path(points.map((p) => p.total))} />

        {inRange && (
          <g className="current">
            <line x1={x(currentDau)} x2={x(currentDau)} y1={MARGIN.top} y2={MARGIN.top + innerH} />
            <text x={x(currentDau) + 4} y={MARGIN.top + 10}>
              Now: {count(currentDau)}
            </text>
          </g>
        )}

        {hovered && (
          <g className="hover">
            <line x1={hoverX} x2={hoverX} y1={MARGIN.top} y2={MARGIN.top + innerH} />
            {mode === 'lines' &&
              series.map((s) => <circle key={s.key} cx={hoverX} cy={y(s.value(hovered))} r={4} fill={s.color} />)}
            <circle cx={hoverX} cy={y(hovered.total)} r={4} className="total-dot" />
          </g>
        )}
        <rect className="hit" x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} />
      </svg>

      {hovered && (
        <div className="scaling-tooltip" style={hoverX > width / 2 ? { right: width - hoverX + 12 } : { left: hoverX + 12 }}>
          <div className="scaling-tooltip-head">
            {count(hovered.dailyActiveUsers)} daily users
            <strong>{money(hovered.total)}</strong>
          </div>
          <table>
            <tbody>
              {[...series]
                .sort((a, b) => b.value(hovered) - a.value(hovered))
                .map((s) => (
                  <tr key={s.key}>
                    <td>
                      <span className="swatch" style={{ background: s.color }} />
                      {s.label}
                    </td>
                    <td className="num">{money(s.value(hovered))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="scaling-tooltip-foot">Click to use this many users</div>
        </div>
      )}
    </div>
  )
}

function ScaleTable({ points, series }: { points: ScalePoint[]; series: Series[] }) {
  return (
    <div className="scaling-table">
      <table className="cost-table">
        <thead>
          <tr>
            <td>Daily users</td>
            {series.map((s) => (
              <td key={s.key} className="num">
                {s.label}
              </td>
            ))}
            <td className="num">Total</td>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.dailyActiveUsers}>
              <td>{count(p.dailyActiveUsers)}</td>
              {series.map((s) => (
                <td key={s.key} className="num">
                  {money(s.value(p))}
                </td>
              ))}
              <td className="num">
                <strong>{money(p.total)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ScalingPanel({ onClose }: { onClose: () => void }) {
  const graph = useGraph()
  const [mode, setMode] = useState<Mode>('lines')
  const currentDau = graph.workload.dailyActiveUsers

  useEscape(onClose)

  const { points, tablePoints, series } = useMemo(() => {
    const steps = dauSteps()
    // Include the current user count so the tooltip can land exactly on it.
    if (currentDau > MIN_DAU && currentDau < MAX_DAU && !steps.includes(currentDau)) steps.push(currentDau)
    steps.sort((a, b) => a - b)
    const points = computeScaling(graph.nodes, graph.edges, graph.workload, steps)
    const tablePoints = computeScaling(graph.nodes, graph.edges, graph.workload, DAU_TICKS)
    const names = graph.nodes.filter((n) => !serviceByType[n.type]?.isSource).map((n) => ({ id: n.id, name: n.name }))
    return { points, tablePoints, series: buildSeries(names, points) }
  }, [graph, currentDau])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal scaling" role="dialog" aria-label="Cost at scale">
        <header className="modal-header">
          <div>
            <div className="panel-title">Cost at scale</div>
            <div className="panel-subtitle">
              {count(MIN_DAU)}–{count(MAX_DAU)} daily users
            </div>
          </div>
          <div className="segmented" role="tablist">
            {(['lines', 'stacked', 'table'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {m === 'lines' ? 'Lines' : m === 'stacked' ? 'Stacked' : 'Table'}
              </button>
            ))}
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        {series.length === 0 ? (
          <p className="empty">Add a service to see how cost scales.</p>
        ) : mode === 'table' ? (
          <ScaleTable points={tablePoints} series={series} />
        ) : (
          <>
            <ul className="legend">
              <li>
                <span className="swatch total" />
                Total
              </li>
              {series.map((s) => (
                <li key={s.key}>
                  <span className="swatch" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
            <Chart points={points} series={series} mode={mode} currentDau={currentDau} />
          </>
        )}
      </section>
    </div>
  )
}
