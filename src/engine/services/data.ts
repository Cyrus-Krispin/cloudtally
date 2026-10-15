import { HOURS_PER_MONTH, prices } from '../prices'
import type { ServiceDef } from '../types'
import { num, options, str } from './util'

export const rds: ServiceDef = {
  type: 'rds',
  label: 'RDS PostgreSQL',
  short: 'RDS',
  color: '#C925D1',
  category: 'Data',
  description: 'Managed relational database billed per instance-hour and storage.',
  defaults: { instanceClass: 'db.t4g.medium', multiAz: 'no', storageGB: 50 },
  fields: [
    { key: 'instanceClass', label: 'Instance class', type: 'select', options: options(Object.keys(prices.rds.perHour)) },
    {
      key: 'multiAz',
      label: 'Multi-AZ standby',
      type: 'select',
      options: [
        { value: 'no', label: 'No (single AZ)' },
        { value: 'yes', label: 'Yes (doubles cost)' },
      ],
    },
    { key: 'storageGB', label: 'Storage (gp3)', type: 'number', min: 20, step: 10, unit: 'GB' },
  ],
  lineItems: (c) => {
    const copies = str(c, 'multiAz') === 'yes' ? 2 : 1
    const cls = str(c, 'instanceClass')
    return [
      { label: `${cls}${copies === 2 ? ' (Multi-AZ)' : ''}`, quantity: copies * HOURS_PER_MONTH, unit: 'instance-hours', unitPrice: prices.rds.perHour[cls] ?? 0 },
      { label: 'Storage', quantity: copies * num(c, 'storageGB'), unit: 'GB-months', unitPrice: prices.rds.gp3PerGbMonth },
    ]
  },
}

export const dynamodb: ServiceDef = {
  type: 'dynamodb',
  label: 'DynamoDB',
  short: 'DDB',
  color: '#C925D1',
  category: 'Data',
  description: 'On-demand NoSQL table billed per read/write request unit and storage.',
  defaults: { itemSizeKB: 2, consistency: 'eventual', storageGB: 10 },
  fields: [
    { key: 'itemSizeKB', label: 'Average item size', type: 'number', min: 0.1, step: 0.5, unit: 'KB' },
    {
      key: 'consistency',
      label: 'Read consistency',
      type: 'select',
      options: [
        { value: 'eventual', label: 'Eventually consistent' },
        { value: 'strong', label: 'Strongly consistent' },
      ],
    },
    { key: 'storageGB', label: 'Table size', type: 'number', min: 0, step: 5, unit: 'GB' },
  ],
  assumptions: () => ['On-demand capacity mode. Edges marked "read" or "write" set the request type.'],
  lineItems: (c, u) => {
    const size = Math.max(num(c, 'itemSizeKB'), 0.001)
    const readUnits = Math.ceil(size / 4) * (str(c, 'consistency') === 'strong' ? 1 : 0.5)
    const writeUnits = Math.ceil(size)
    return [
      { label: 'Reads', quantity: u.reads * readUnits, unit: 'read units', unitPrice: prices.dynamodb.perReadUnit },
      { label: 'Writes', quantity: u.writes * writeUnits, unit: 'write units', unitPrice: prices.dynamodb.perWriteUnit },
      { label: 'Storage', quantity: num(c, 'storageGB'), unit: 'GB-months', unitPrice: prices.dynamodb.storagePerGbMonth, freeTierKey: 'dynamodb.storageGb' },
    ]
  },
}

export const s3: ServiceDef = {
  type: 's3',
  label: 'S3',
  short: 'S3',
  color: '#7AA116',
  category: 'Data',
  description: 'Object storage billed per GB stored and per request.',
  defaults: { storageGB: 100 },
  fields: [{ key: 'storageGB', label: 'Data stored', type: 'number', min: 0, step: 10, unit: 'GB' }],
  assumptions: () => ['S3 Standard. "Read" edges are GETs, "write" edges are PUTs.'],
  lineItems: (c, u) => [
    { label: 'Storage', quantity: num(c, 'storageGB'), unit: 'GB-months', unitPrice: prices.s3.storagePerGbMonth },
    { label: 'GET requests', quantity: u.reads, unit: 'requests', unitPrice: prices.s3.perGet },
    { label: 'PUT requests', quantity: u.writes, unit: 'requests', unitPrice: prices.s3.perPut },
  ],
}

export const elasticache: ServiceDef = {
  type: 'elasticache',
  label: 'ElastiCache',
  short: 'EC',
  color: '#C925D1',
  category: 'Data',
  description: 'In-memory cache billed per node-hour.',
  defaults: { engine: 'valkey', nodeType: 'cache.t4g.small', nodes: 2 },
  fields: [
    {
      key: 'engine',
      label: 'Engine',
      type: 'select',
      options: [
        { value: 'valkey', label: 'Valkey' },
        { value: 'redis', label: 'Redis OSS' },
      ],
    },
    { key: 'nodeType', label: 'Node type', type: 'select', options: options(Object.keys(prices.elasticache.perHour.redis)) },
    { key: 'nodes', label: 'Nodes', type: 'number', min: 1, step: 1 },
  ],
  lineItems: (c) => {
    const engine = str(c, 'engine') === 'redis' ? 'redis' : 'valkey'
    const type = str(c, 'nodeType')
    const nodes = num(c, 'nodes')
    return [
      { label: `${nodes} × ${type}`, quantity: nodes * HOURS_PER_MONTH, unit: 'node-hours', unitPrice: prices.elasticache.perHour[engine][type] ?? 0 },
    ]
  },
}
