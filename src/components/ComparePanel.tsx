import { useMemo, useState, type MouseEvent } from 'react'
import { cheaper, compareDesigns, verdict, type ComparePoint, type Crossover, type DesignId } from '../engine/compare'
import { computeCosts } from '../engine/compute'
import { dauSteps, MAX_DAU, MIN_DAU } from '../engine/scaling'
import { serviceByType } from '../engine/services'
import { count, money } from '../format'
import { useStore } from '../store'
import { toGraph } from '../useCosts'
import { axisMoney, DAU_TICKS, DESIGN_COLORS, HEIGHT, MARGIN, useEscape, useWidth } from './chart'
import { Icon } from './Icon'

const DESIGNS = ['a', 'b'] as const

function Chart({ points, crossovers, currentDau }: { points: ComparePoint[]; crossovers: Crossover[]; currentDau: number }) {
  const setWorkload = useStore((s) => s.setWorkload)
  const [wrapRef, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const innerW = Math.max(width - MARGIN.left - MARGIN.right, 10)
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom
  const logMin = Math.log10(MIN_DAU)
  const logSpan = Math.log10(MAX_DAU) - logMin
  const x = (dau: number) => MARGIN.left + ((Math.log10(dau) - logMin) / logSpan) * innerW

  // Log scale, so a flat design and one that grows with traffic are both readable.
  const values = points.flatMap((p) => [p.a, p.b])
  const positives = values.filter((v) => v > 0)
  const top = Math.ceil(Math.log10(Math.max(...values, 1)))
  const bottom = Math.max(Math.floor(Math.log10(Math.min(...positives, 10 ** top))), top - 6, -2)
  const lo = bottom === top ? top - 1 : bottom
  const y = (v: number) => MARGIN.top + innerH - ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (top - lo)) * innerH
  const yTicks = Array.from({ length: top - lo + 1 }, (_, i) => 10 ** (lo + i))

  const path = (id: DesignId) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.dailyActiveUsers)},${y(p[id])}`).join('')

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
        aria-label="Monthly cost of design A and B by daily users"
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

        {DESIGNS.map((id) => (
          <path key={id} className="series-line" stroke={DESIGN_COLORS[id]} d={path(id)} />
        ))}

        {crossovers.map((c) => (
          <g key={c.dailyActiveUsers} className="crossover">
            <line x1={x(c.dailyActiveUsers)} x2={x(c.dailyActiveUsers)} y1={MARGIN.top} y2={MARGIN.top + innerH} />
            <circle cx={x(c.dailyActiveUsers)} cy={y(c.cost)} r={5} />
            <text x={x(c.dailyActiveUsers)} y={y(c.cost) - 10} textAnchor="middle">
              {count(c.dailyActiveUsers)}
            </text>
          </g>
        ))}

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
            {DESIGNS.map((id) => (
              <circle key={id} cx={hoverX} cy={y(hovered[id])} r={4} fill={DESIGN_COLORS[id]} />
            ))}
          </g>
        )}
        <rect className="hit" x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} />
      </svg>

      {hovered && (
        <div className="scaling-tooltip" style={hoverX > width / 2 ? { right: width - hoverX + 12 } : { left: hoverX + 12 }}>
          <div className="scaling-tooltip-head">{count(hovered.dailyActiveUsers)} daily users</div>
          <table>
            <tbody>
              {DESIGNS.map((id) => (
                <tr key={id} className={cheaper(hovered.a, hovered.b) === id ? 'winner' : ''}>
                  <td>
                    <span className="swatch" style={{ background: DESIGN_COLORS[id] }} />
                    Design {id.toUpperCase()}
                  </td>
                  <td className="num">{money(hovered[id])}</td>
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

export function ComparePanel({ onClose }: { onClose: () => void }) {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const other = useStore((s) => s.other)
  const active = useStore((s) => s.active)
  const workload = useStore((s) => s.workload)
  const currentDau = workload.dailyActiveUsers
  useEscape(onClose)

  const result = useMemo(() => {
    if (!other) return null
    const shown = toGraph(nodes, edges)
    const hidden = toGraph(other.nodes, other.edges)
    const [a, b] = active === 'a' ? [shown, hidden] : [hidden, shown]
    const priced = [...a.nodes, ...b.nodes].some((n) => !serviceByType[n.type]?.isSource)
    const steps = dauSteps(MIN_DAU, MAX_DAU, 60)
    // Include the current user count so the tooltip can land exactly on it.
    if (currentDau > MIN_DAU && currentDau < MAX_DAU && !steps.includes(currentDau)) steps.push(currentDau)
    steps.sort((p, q) => p - q)
    const { points, crossovers } = compareDesigns(a, b, workload, steps)
    const now = { a: computeCosts(a.nodes, a.edges, workload).total, b: computeCosts(b.nodes, b.edges, workload).total }
    return { priced, points, crossovers, now, verdict: verdict(points, crossovers) }
  }, [nodes, edges, other, active, workload, currentDau])

  const winner = result && cheaper(result.now.a, result.now.b)

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal scaling" role="dialog" aria-label="Compare designs">
        <header className="modal-header">
          <div>
            <div className="panel-title">Compare designs</div>
            <div className="panel-subtitle">
              {count(MIN_DAU)}–{count(MAX_DAU)} daily users
            </div>
          </div>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        {!result ? (
          <p className="empty">Add design B to compare.</p>
        ) : !result.priced ? (
          <p className="empty">Add a service to compare.</p>
        ) : (
          <>
            <p className="compare-verdict">{result.verdict}</p>
            <div className="compare-now" title={`Monthly cost at ${count(currentDau)} daily users`}>
              {DESIGNS.map((id) => (
                <div key={id} className={`compare-stat${winner === id ? ' winner' : ''}`}>
                  <span className="swatch" style={{ background: DESIGN_COLORS[id] }} />
                  Design {id.toUpperCase()}
                  <strong>{money(result.now[id])}</strong>
                </div>
              ))}
              <div className="compare-delta">
                {winner
                  ? `${winner.toUpperCase()} saves ${money(Math.abs(result.now.a - result.now.b))}/mo at ${count(currentDau)} daily users`
                  : `Same cost at ${count(currentDau)} daily users`}
              </div>
            </div>
            <Chart points={result.points} crossovers={result.crossovers} currentDau={currentDau} />
          </>
        )}
      </section>
    </div>
  )
}
