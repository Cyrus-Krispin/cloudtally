import { describe, expect, it } from 'vitest'
import { computeCosts } from './compute'
import { serviceByType } from './services'
import type { Config, EdgeConfig, Workload } from './types'

// 10k users × 20 requests/day × 30 days = 6M requests/month
const workload: Workload = { dailyActiveUsers: 10_000, requestsPerUserPerDay: 20, peakToAverage: 3 }

/** Prices one service fed directly by the users node. */
function cost(type: string, config: Config = {}, edge: Partial<EdgeConfig> = {}) {
  const nodes = [
    { id: 'users', type: 'clients', name: 'Users', config: {} },
    { id: 'svc', type, name: type, config: { ...serviceByType[type].defaults, ...config } },
  ]
  const edges = [{ id: 'e', source: 'users', target: 'svc', config: { callsPerRequest: 1, operation: 'read' as const, payloadKB: 4, network: 'same-az' as const, ...edge } }]
  return computeCosts(nodes, edges, workload).nodes.svc
}

describe('new services', () => {
  it('SNS bills publishes and HTTP deliveries', () => {
    const r = cost('sns', { httpSubscribers: 2 })
    expect(r.items[0].cost).toBeCloseTo(6e6 * 0.5e-6, 6)
    expect(r.items[1].cost).toBeCloseTo(12e6 * 0.6e-6, 6)
  })

  it('EventBridge bills events in 64 KB chunks', () => {
    expect(cost('eventbridge', {}, { payloadKB: 100 }).total).toBeCloseTo(12e6 * 1e-6, 6)
  })

  it('Kinesis bills stream hours and data in and out', () => {
    const gb = (6e6 * 4) / 1024 / 1024
    expect(cost('kinesis', { consumers: 2 }).total).toBeCloseTo(730 * 0.04 + gb * 0.08 + gb * 2 * 0.04, 4)
  })

  it('Step Functions bills Standard transitions and Express duration', () => {
    expect(cost('stepfunctions', { transitions: 5 }).total).toBeCloseTo(6e6 * 5 * 0.000025, 4)
    const express = cost('stepfunctions', { workflowType: 'express', durationMs: 500, memoryMB: 64 })
    expect(express.total).toBeCloseTo(6e6 * 1e-6 + 6e6 * 0.5 * 0.0625 * 0.00001667, 4)
  })

  it('Aurora Serverless v2 bills capacity, storage and I/O', () => {
    expect(cost('aurora', { averageAcu: 2, storageGB: 50, iosPerRequest: 2 }).total).toBeCloseTo(2 * 730 * 0.12 + 50 * 0.1 + 12e6 * 2e-7, 4)
  })

  it('Cognito bills monthly active users by tier', () => {
    expect(cost('cognito', { tier: 'essentials', monthlyActiveUsers: 10_000 }).total).toBeCloseTo(150, 4)
    expect(cost('cognito', { tier: 'lite', monthlyActiveUsers: 10_000 }).total).toBeCloseTo(55, 4)
  })

  it('LLM API bills input and output tokens', () => {
    const r = cost('llm', { inputTokens: 1000, outputTokens: 300, inputPricePerM: 3, outputPricePerM: 15 })
    expect(r.total).toBeCloseTo(6e6 * 1000 * 3e-6 + 6e6 * 300 * 15e-6, 2)
  })
})
