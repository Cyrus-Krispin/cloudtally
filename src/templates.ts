import { defaultWorkload, makeEdge, makeNode, type Diagram } from './diagram'

export interface Template {
  id: string
  name: string
  diagram: () => Diagram
}

const diagram = (nodes: Diagram['nodes'], edges: Diagram['edges']): Diagram => ({
  version: 1,
  workload: defaultWorkload,
  nodes,
  edges,
})

export const templates: Template[] = [
  {
    id: 'serverless-api',
    name: 'Serverless API',
    diagram: () =>
      diagram(
        [
          makeNode('users', 'clients', 0, 120),
          makeNode('cdn', 'cloudfront', 280, 120, { cacheHitPercent: 60 }),
          makeNode('api', 'apigateway', 560, 120),
          makeNode('fn', 'lambda', 840, 120),
          makeNode('db', 'dynamodb', 1120, 20),
          makeNode('assets', 's3', 560, 300),
        ],
        [
          makeEdge('users', 'cdn', { payloadKB: 20 }),
          makeEdge('cdn', 'api', { payloadKB: 4 }),
          makeEdge('cdn', 'assets', { callsPerRequest: 0.5, payloadKB: 50 }),
          makeEdge('api', 'fn'),
          makeEdge('fn', 'db', { callsPerRequest: 2, payloadKB: 2 }),
        ],
      ),
  },
  {
    id: 'three-tier',
    name: 'Three-tier web app',
    diagram: () =>
      diagram(
        [
          makeNode('users', 'clients', 0, 140),
          makeNode('lb', 'alb', 280, 140),
          makeNode('app', 'fargate', 560, 140, { vcpu: '1', memoryGB: 2, minTasks: 2, rpsPerTask: 50 }, 'App servers'),
          makeNode('db', 'rds', 880, 0, { instanceClass: 'db.m7g.large', multiAz: 'yes', storageGB: 100 }),
          makeNode('cache', 'elasticache', 880, 140),
          makeNode('nat', 'natgateway', 880, 280, { gateways: 2 }),
        ],
        [
          makeEdge('users', 'lb', { payloadKB: 30 }),
          makeEdge('lb', 'app', { payloadKB: 30 }),
          makeEdge('app', 'db', { callsPerRequest: 1.5, payloadKB: 2 }),
          makeEdge('app', 'cache', { callsPerRequest: 3, payloadKB: 1, network: 'cross-az' }),
          makeEdge('app', 'nat', { callsPerRequest: 0.1, payloadKB: 10 }),
        ],
      ),
  },
  {
    id: 'event-pipeline',
    name: 'Event pipeline',
    diagram: () =>
      diagram(
        [
          makeNode('users', 'clients', 0, 120, {}, 'Producers'),
          makeNode('api', 'apigateway', 280, 120, { apiType: 'http' }, 'Ingest API'),
          makeNode('queue', 'sqs', 560, 120),
          makeNode('worker', 'lambda', 840, 120, { memoryMB: 1024, durationMs: 300 }, 'Worker'),
          makeNode('db', 'dynamodb', 1120, 20, { itemSizeKB: 1, storageGB: 50 }),
          makeNode('archive', 's3', 1120, 220, { storageGB: 500 }, 'Archive'),
        ],
        [
          makeEdge('users', 'api', { payloadKB: 1 }),
          makeEdge('api', 'queue', { operation: 'write', payloadKB: 2 }),
          makeEdge('queue', 'worker', { payloadKB: 2 }),
          makeEdge('worker', 'db', { operation: 'write', payloadKB: 1 }),
          makeEdge('worker', 'archive', { operation: 'write', callsPerRequest: 0.1, payloadKB: 50 }),
        ],
      ),
  },
  {
    id: 'static-site',
    name: 'Static website',
    diagram: () =>
      diagram(
        [
          makeNode('users', 'clients', 0, 100, {}, 'Visitors'),
          makeNode('cdn', 'cloudfront', 280, 100, { cacheHitPercent: 95 }),
          makeNode('site', 's3', 560, 100, { storageGB: 5 }, 'Site files'),
        ],
        [makeEdge('users', 'cdn', { payloadKB: 200 }), makeEdge('cdn', 'site', { payloadKB: 200 })],
      ),
  },
]

export const defaultTemplate = templates[0]
