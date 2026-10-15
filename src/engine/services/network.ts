import { HOURS_PER_MONTH, prices } from '../prices'
import type { ServiceDef } from '../types'
import { num, str } from './util'

export const clients: ServiceDef = {
  type: 'clients',
  label: 'Users',
  color: '#545B64',
  category: 'Clients',
  description: 'Where traffic starts. Its volume comes from the workload settings in the top bar.',
  defaults: {},
  fields: [],
  isSource: true,
  lineItems: () => [],
}

export const cloudfront: ServiceDef = {
  type: 'cloudfront',
  label: 'CloudFront',
  color: '#8C4FFF',
  category: 'Edge',
  description: 'CDN billed per GB served and per HTTPS request.',
  defaults: { cacheHitPercent: 80 },
  fields: [
    {
      key: 'cacheHitPercent',
      label: 'Cache hit ratio',
      type: 'number',
      min: 0,
      max: 100,
      step: 5,
      unit: '%',
      help: 'Only cache misses are passed on to the origin.',
    },
  ],
  passThrough: (c) => 1 - Math.min(Math.max(num(c, 'cacheHitPercent'), 0), 100) / 100,
  assumptions: () => ['North America pricing. Origin-to-CloudFront transfer is free.'],
  lineItems: (_c, u) => [
    { label: 'Data out to users', quantity: u.gb, unit: 'GB', unitPrice: prices.cloudfront.perGbOut, freeTierKey: 'cloudfront.egressGb' },
    { label: 'HTTPS requests', quantity: u.requests, unit: 'requests', unitPrice: prices.cloudfront.perHttpsRequest, freeTierKey: 'cloudfront.requests' },
  ],
}

export const apiGateway: ServiceDef = {
  type: 'apigateway',
  label: 'API Gateway',
  color: '#E7157B',
  category: 'Edge',
  description: 'Managed API front door billed per request.',
  defaults: { apiType: 'http' },
  fields: [
    {
      key: 'apiType',
      label: 'API type',
      type: 'select',
      options: [
        { value: 'http', label: 'HTTP API ($1.00/M)' },
        { value: 'rest', label: 'REST API ($3.50/M)' },
      ],
    },
  ],
  lineItems: (c, u) => [
    {
      label: 'Requests',
      quantity: u.requests,
      unit: 'requests',
      unitPrice: prices.apiGateway.perRequest[str(c, 'apiType') === 'rest' ? 'rest' : 'http'],
    },
  ],
}

export const alb: ServiceDef = {
  type: 'alb',
  label: 'Load Balancer',
  color: '#8C4FFF',
  category: 'Networking',
  description: 'Application Load Balancer billed per hour and per load balancer capacity unit (LCU).',
  defaults: { requestsPerConnection: 10 },
  fields: [
    {
      key: 'requestsPerConnection',
      label: 'Requests per connection',
      type: 'number',
      min: 1,
      step: 1,
      help: 'Keep-alive reuse. Lower means more new connections and more LCUs.',
    },
  ],
  assumptions: () => ['LCUs sized from average traffic: 25 new connections/sec or 1 GB/hour per LCU.'],
  lineItems: (c, u) => {
    const newConnections = u.averageRps / Math.max(num(c, 'requestsPerConnection'), 1)
    const gbPerHour = u.gb / HOURS_PER_MONTH
    const lcu = Math.max(newConnections / 25, gbPerHour, u.averageRps / 1000)
    return [
      { label: 'Load balancer hours', quantity: HOURS_PER_MONTH, unit: 'hours', unitPrice: prices.alb.perHour },
      { label: `Capacity (${lcu.toFixed(2)} LCU)`, quantity: lcu * HOURS_PER_MONTH, unit: 'LCU-hours', unitPrice: prices.alb.perLcuHour },
    ]
  },
}

export const natGateway: ServiceDef = {
  type: 'natgateway',
  label: 'NAT Gateway',
  color: '#8C4FFF',
  category: 'Networking',
  description: 'Lets private subnets reach the internet. Billed per hour and per GB processed.',
  defaults: { gateways: 1 },
  fields: [
    { key: 'gateways', label: 'Gateways', type: 'number', min: 1, step: 1, help: 'Usually one per availability zone.' },
  ],
  lineItems: (c, u) => [
    { label: 'Gateway hours', quantity: num(c, 'gateways') * HOURS_PER_MONTH, unit: 'hours', unitPrice: prices.natGateway.perHour },
    { label: 'Data processed', quantity: u.gb, unit: 'GB', unitPrice: prices.natGateway.perGbProcessed },
  ],
}
