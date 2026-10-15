import { describe, expect, it } from 'vitest'
import { computeCosts } from './compute'
import { serviceByType } from './services'
import type { EdgeConfig, GraphEdge, GraphNode, Workload } from './types'

// 10k users × 20 requests/day × 30 days = 6M requests/month
const workload: Workload = { dailyActiveUsers: 10_000, requestsPerUserPerDay: 20, peakToAverage: 3 }

const node = (id: string, type: string, config = {}): GraphNode => ({
  id,
  type,
  name: id,
  config: { ...serviceByType[type].defaults, ...config },
})
const edge = (source: string, target: string, config: Partial<EdgeConfig> = {}): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  config: { callsPerRequest: 1, operation: 'read', payloadKB: 4, network: 'same-az', ...config },
})

const serverless = {
  nodes: [
    node('users', 'clients'),
    node('api', 'apigateway', { apiType: 'http' }),
    node('fn', 'lambda', { memoryMB: 512, durationMs: 120, arch: 'arm' }),
    node('db', 'dynamodb', { itemSizeKB: 2, consistency: 'eventual', storageGB: 10 }),
  ],
  edges: [edge('users', 'api'), edge('api', 'fn'), edge('fn', 'db', { callsPerRequest: 2 })],
}

describe('computeCosts', () => {
  it('prices a serverless API from the workload', () => {
    const r = computeCosts(serverless.nodes, serverless.edges, workload)
    expect(r.nodes.api.usage.requests).toBe(6e6)
    expect(r.nodes.api.total).toBeCloseTo(6.0, 4)
    // 6M × $0.20/M + 6M × 0.12s × 0.5GB × $0.0000133334
    expect(r.nodes.fn.total).toBeCloseTo(1.2 + 4.800024, 4)
    // 12M eventually consistent reads of ≤4KB = 6M read units, plus 10GB storage
    expect(r.nodes.db.usage.reads).toBe(12e6)
    expect(r.nodes.db.total).toBeCloseTo(0.75 + 2.5, 4)
    // Responses to users: 6M × 4KB over the internet
    expect(r.edges['users-api'].total).toBeCloseTo(((6e6 * 4) / 1024 / 1024) * 0.09, 4)
    expect(r.edges['api-fn'].total).toBe(0)
    expect(r.total).toBeCloseTo(6 + 6.000024 + 3.25 + 2.0599, 2)
  })

  it('only passes CloudFront cache misses to the origin', () => {
    const nodes = [node('users', 'clients'), node('cdn', 'cloudfront', { cacheHitPercent: 75 }), node('s3', 's3')]
    const edges = [edge('users', 'cdn'), edge('cdn', 's3')]
    const r = computeCosts(nodes, edges, workload)
    expect(r.nodes.s3.usage.reads).toBeCloseTo(1.5e6)
    expect(r.edges['users-cdn'].total).toBe(0) // billed by CloudFront itself
    expect(r.nodes.cdn.items.find((i) => i.label === 'HTTPS requests')!.cost).toBeCloseTo(6, 4)
  })

  it('scales Fargate tasks to peak traffic', () => {
    const nodes = [node('users', 'clients'), node('svc', 'fargate', { minTasks: 1, rpsPerTask: 1, vcpu: '1', memoryGB: 2 })]
    const r = computeCosts(nodes, [edge('users', 'svc')], workload)
    // 6M / 2,592,000s ≈ 2.31 rps average, ×3 peak ≈ 6.94 rps → 7 tasks
    expect(r.nodes.svc.items[0].label).toContain('7 tasks')
  })

  it('handles cycles without looping forever', () => {
    const nodes = [node('users', 'clients'), node('a', 'lambda'), node('b', 'sqs')]
    const edges = [edge('users', 'a'), edge('a', 'b'), edge('b', 'a')]
    const r = computeCosts(nodes, edges, workload)
    expect(r.cycleNodeIds.sort()).toEqual(['a', 'b'])
    expect(Number.isFinite(r.total)).toBe(true)
  })

  it('charges cross-AZ transfer on connections', () => {
    const nodes = [node('users', 'clients'), node('fn', 'lambda'), node('cache', 'elasticache')]
    const edges = [edge('users', 'fn'), edge('fn', 'cache', { network: 'cross-az', payloadKB: 1024 })]
    const r = computeCosts(nodes, edges, workload)
    // 6M × 1MB ≈ 5,859 GB × $0.02
    expect(r.edges['fn-cache'].total).toBeCloseTo((6e6 / 1024) * 0.02, 2)
  })
})
