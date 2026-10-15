export type ConfigValue = number | string
export type Config = Record<string, ConfigValue>

export type FieldDef =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; unit?: string; help?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; help?: string }

/** Global traffic assumptions that every diagram starts from. */
export interface Workload {
  dailyActiveUsers: number
  requestsPerUserPerDay: number
  /** Peak traffic as a multiple of the monthly average. Used for autoscaling and load balancer sizing. */
  peakToAverage: number
}

export type Operation = 'read' | 'write'
export type Network = 'same-az' | 'cross-az' | 'internet'

/** Settings on a connection between two services. */
export interface EdgeConfig {
  /** Calls made to the target for every request that reaches the source. */
  callsPerRequest: number
  operation: Operation
  /** Average size of the data moved per call, in KB. */
  payloadKB: number
  network: Network
}

/** The traffic a service receives in one month. */
export interface Usage {
  requests: number
  reads: number
  writes: number
  /** GB moved through incoming connections. */
  gb: number
  averageRps: number
  peakRps: number
}

export interface LineItem {
  label: string
  quantity: number
  unit: string
  unitPrice: number
  cost: number
}

export type LineItemInput = Omit<LineItem, 'cost'>

export interface ServiceDef {
  type: string
  label: string
  color: string
  category: 'Clients' | 'Edge' | 'Compute' | 'Data' | 'Messaging' | 'Networking' | 'Other'
  description: string
  defaults: Config
  fields: FieldDef[]
  /** Clients generate the workload's traffic instead of receiving it. */
  isSource?: boolean
  /** Fraction of incoming requests passed on to outgoing connections. Defaults to 1. */
  passThrough?: (config: Config) => number
  assumptions?: (config: Config) => string[]
  lineItems: (config: Config, usage: Usage) => LineItemInput[]
}

export interface GraphNode {
  id: string
  type: string
  name: string
  config: Config
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  config: EdgeConfig
}

export interface NodeCost {
  nodeId: string
  usage: Usage
  items: LineItem[]
  total: number
}

export interface EdgeCost {
  edgeId: string
  calls: number
  gb: number
  items: LineItem[]
  total: number
}

export interface CostResult {
  nodes: Record<string, NodeCost>
  edges: Record<string, EdgeCost>
  total: number
  /** Node IDs that are part of a cycle and were not costed. */
  cycleNodeIds: string[]
}
