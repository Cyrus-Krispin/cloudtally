import { prices } from './prices'
import { serviceByType } from './services'
import type { CostResult, EdgeCost, GraphEdge, GraphNode, LineItem, LineItemInput, Usage, Workload } from './types'

export const DAYS_PER_MONTH = 30
const SECONDS_PER_MONTH = DAYS_PER_MONTH * 86400
const KB_PER_GB = 1024 * 1024

export const monthlyRequests = (w: Workload) => w.dailyActiveUsers * w.requestsPerUserPerDay * DAYS_PER_MONTH

const emptyUsage = (): Usage => ({ requests: 0, reads: 0, writes: 0, gb: 0, averageRps: 0, peakRps: 0 })

/**
 * Walks the diagram from the traffic sources downstream, works out how much traffic
 * reaches each service, and prices every service and connection for one month.
 */
export function computeCosts(nodes: GraphNode[], edges: GraphEdge[], workload: Workload): CostResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const validEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target) && e.source !== e.target)

  const usage = new Map(nodes.map((n) => [n.id, emptyUsage()]))
  const outflow = new Map<string, number>()
  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  const outgoing = new Map<string, GraphEdge[]>(nodes.map((n) => [n.id, []]))
  for (const e of validEdges) {
    outgoing.get(e.source)!.push(e)
    inDegree.set(e.target, inDegree.get(e.target)! + 1)
  }

  // Traffic from the workload is shared between all source nodes.
  const sources = nodes.filter((n) => serviceByType[n.type]?.isSource)
  const perSource = sources.length ? monthlyRequests(workload) / sources.length : 0

  const edgeResults: Record<string, EdgeCost> = {}
  const allItems: { owner: string; isEdge: boolean; item: LineItemInput }[] = []

  // Kahn's algorithm: a node is priced once all of its incoming traffic is known.
  const queue = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)
  const visited = new Set<string>()
  const process = (id: string) => {
    visited.add(id)
    const node = byId.get(id)!
    const def = serviceByType[node.type]
    const u = usage.get(id)!
    u.averageRps = u.requests / SECONDS_PER_MONTH
    u.peakRps = u.averageRps * workload.peakToAverage

    const out = def?.isSource ? perSource : u.requests * (def?.passThrough?.(node.config) ?? 1)
    outflow.set(id, out)

    for (const e of outgoing.get(id)!) {
      const calls = out * Math.max(e.config.callsPerRequest, 0)
      const gb = (calls * Math.max(e.config.payloadKB, 0)) / KB_PER_GB
      const t = usage.get(e.target)!
      t.requests += calls
      t.gb += gb
      if (e.config.operation === 'write') t.writes += calls
      else t.reads += calls

      const items = transferItems(node.type, byId.get(e.target)!.type, e.config.network, gb)
      items.forEach((item) => allItems.push({ owner: e.id, isEdge: true, item }))
      edgeResults[e.id] = { edgeId: e.id, calls, gb, items: [], total: 0 }

      inDegree.set(e.target, inDegree.get(e.target)! - 1)
      if (inDegree.get(e.target) === 0) queue.push(e.target)
    }

    def?.lineItems(node.config, u).forEach((item) => allItems.push({ owner: id, isEdge: false, item }))
  }

  const drain = () => {
    while (queue.length) {
      const id = queue.shift()!
      if (!visited.has(id)) process(id)
    }
  }
  drain()
  // Anything left is in a cycle. Price it with the traffic it has received so far.
  const cycleNodeIds = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id)
  for (const id of cycleNodeIds) {
    if (!visited.has(id)) {
      process(id)
      drain()
    }
  }

  const priced: LineItem[] = allItems.map(({ item }) => ({ ...item, cost: item.quantity * item.unitPrice }))

  const result: CostResult = { nodes: {}, edges: edgeResults, total: 0, cycleNodeIds }
  for (const n of nodes) result.nodes[n.id] = { nodeId: n.id, usage: usage.get(n.id)!, items: [], total: 0 }
  allItems.forEach((a, i) => {
    const target = a.isEdge ? result.edges[a.owner] : result.nodes[a.owner]
    target.items.push(priced[i])
    target.total += priced[i].cost
    result.total += priced[i].cost
  })
  return result
}

/** Data transfer charges for one connection. */
function transferItems(sourceType: string, targetType: string, network: string, gb: number): LineItemInput[] {
  // CloudFront prices its own traffic to users, and origin-to-CloudFront traffic is free.
  if (sourceType === 'cloudfront' || targetType === 'cloudfront') return []
  // Responses to users leave AWS over the internet.
  if (sourceType === 'clients' || network === 'internet') {
    return [
      { label: 'Data out to internet', quantity: gb, unit: 'GB', unitPrice: prices.dataTransfer.internetOutPerGb },
    ]
  }
  if (network === 'cross-az') {
    return [{ label: 'Cross-AZ transfer', quantity: gb, unit: 'GB', unitPrice: prices.dataTransfer.crossAzPerGb }]
  }
  return []
}
