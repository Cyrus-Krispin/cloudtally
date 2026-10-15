// Fetches the on-demand list prices cloudtally uses from the public AWS Price List
// Bulk API (no AWS account needed) and writes src/engine/prices.generated.json.
//
//   npm run prices                 always rewrite the file
//   npm run prices -- --if-changed only rewrite it when a price changed
//
// Fails without writing anything if a price can't be found, so a change in AWS's
// file format shows up as a failed run rather than as zeros in the app.

import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'

const REGION = 'us-east-1'
const LOCATION = 'US East (N. Virginia)'
const BASE = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws'
const OUT = new URL('../src/engine/prices.generated.json', import.meta.url)

const EC2_TYPES = ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm7g.large', 'm7i.large', 'c7g.large', 'c7i.large', 'r7g.large', 'r7i.large']
const RDS_CLASSES = ['db.t4g.micro', 'db.t4g.small', 'db.t4g.medium', 'db.t4g.large', 'db.m7g.large', 'db.r7g.large']
const CACHE_TYPES = ['cache.t4g.micro', 'cache.t4g.small', 'cache.t4g.medium', 'cache.m7g.large', 'cache.r7g.large']

async function offer(service, regional = true) {
  const url = `${BASE}/${service}/current/${regional ? `${REGION}/` : ''}index.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${service}: HTTP ${res.status} from ${url}`)
  const json = await res.json()
  console.log(`  ${service} (published ${json.publicationDate})`)
  return json
}

/** Every on-demand price dimension, flattened, for products matching `where`. */
function rows(offerJson, where) {
  const out = []
  for (const [sku, product] of Object.entries(offerJson.products)) {
    const a = product.attributes
    if (!where(a, product)) continue
    for (const term of Object.values(offerJson.terms.OnDemand[sku] ?? {})) {
      for (const d of Object.values(term.priceDimensions)) {
        out.push({ a, usd: Number(d.pricePerUnit.USD), begin: Number(d.beginRange ?? 0), description: d.description })
      }
    }
  }
  return out
}

/** The first paid tier of exactly one price. Throws if it's missing or ambiguous. */
function price(name, list) {
  const paid = list.filter((r) => r.usd > 0)
  if (!paid.length) throw new Error(`No price found for ${name}`)
  const lowest = Math.min(...paid.map((r) => r.begin))
  const values = [...new Set(paid.filter((r) => r.begin === lowest).map((r) => r.usd))]
  if (values.length !== 1) throw new Error(`Ambiguous price for ${name}: ${values.join(', ')}`)
  return values[0]
}

const inRegion = (a) => a.location === LOCATION
const usage = (pattern) => (a) => inRegion(a) && pattern.test(a.usagetype)

/** Splits one CSV line where every field is quoted. */
function parse(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells
}

/** Streams the EC2 price CSV (about 500 MB) and keeps only the rows we need. */
async function ec2Rows(keep) {
  const res = await fetch(`${BASE}/AmazonEC2/current/${REGION}/index.csv`)
  if (!res.ok) throw new Error(`AmazonEC2: HTTP ${res.status}`)
  const lines = createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity })
  let header = null
  const out = []
  for await (const line of lines) {
    if (!header) {
      if (line.startsWith('"SKU"')) header = parse(line)
      continue
    }
    if (!keep(line)) continue
    const cells = parse(line)
    out.push(Object.fromEntries(header.map((h, i) => [h, cells[i]])))
  }
  console.log(`  AmazonEC2 (${out.length} rows kept)`)
  return out
}

const ec2Price = (name, list, match) =>
  price(
    name,
    list.filter((r) => r.TermType === 'OnDemand' && r.Location === LOCATION && match(r)).map((r) => ({ usd: Number(r.PricePerUnit), begin: Number(r.StartingRange || 0) })),
  )

console.log('Downloading AWS price files…')
const [lambda, apigw, elb, ecs, rds, ddb, s3, sqs, cache, cf, transfer, sns, events, kinesis, states, cognito] = await Promise.all([
  offer('AWSLambda'),
  offer('AmazonApiGateway'),
  offer('AWSELB'),
  offer('AmazonECS'),
  offer('AmazonRDS'),
  offer('AmazonDynamoDB'),
  offer('AmazonS3'),
  offer('AWSQueueService'),
  offer('AmazonElastiCache'),
  offer('AmazonCloudFront', false),
  offer('AWSDataTransfer'),
  offer('AmazonSNS'),
  offer('AWSEvents'),
  offer('AmazonKinesis'),
  offer('AmazonStates'),
  offer('AmazonCognito'),
])
const ec2 = await ec2Rows((line) => line.includes('"OnDemand"') && /"(BoxUsage:|EBS:VolumeUsage\.gp3|NatGateway-)/.test(line))

const prices = {
  lambda: {
    perRequest: price('Lambda requests', rows(lambda, usage(/^Request$/))),
    perGbSecond: {
      x86: price('Lambda GB-s x86', rows(lambda, usage(/^Lambda-GB-Second$/))),
      arm: price('Lambda GB-s Arm', rows(lambda, usage(/^Lambda-GB-Second-ARM$/))),
    },
  },
  apiGateway: {
    perRequest: {
      http: price('API Gateway HTTP', rows(apigw, usage(/ApiGatewayHttpRequest$/))),
      rest: price('API Gateway REST', rows(apigw, usage(/ApiGatewayRequest$/))),
    },
  },
  alb: {
    perHour: price('ALB hours', rows(elb, (a, p) => usage(/^LoadBalancerUsage$/)(a) && p.productFamily === 'Load Balancer-Application')),
    perLcuHour: price('ALB LCU', rows(elb, (a, p) => usage(/^LCUUsage$/)(a) && p.productFamily === 'Load Balancer-Application')),
  },
  fargate: {
    perVcpuHour: {
      x86: price('Fargate vCPU x86', rows(ecs, usage(/-Fargate-vCPU-Hours:perCPU$/))),
      arm: price('Fargate vCPU Arm', rows(ecs, usage(/-Fargate-ARM-vCPU-Hours:perCPU$/))),
    },
    perGbHour: {
      x86: price('Fargate GB x86', rows(ecs, usage(/-Fargate-GB-Hours$/))),
      arm: price('Fargate GB Arm', rows(ecs, usage(/-Fargate-ARM-GB-Hours$/))),
    },
  },
  ec2: {
    perHour: Object.fromEntries(
      EC2_TYPES.map((t) => [
        t,
        ec2Price(
          `EC2 ${t}`,
          ec2,
          (r) =>
            r.usageType === `BoxUsage:${t}` &&
            r['Operating System'] === 'Linux' &&
            r.Tenancy === 'Shared' &&
            r['Pre Installed S/W'] === 'NA' &&
            r.CapacityStatus === 'Used' &&
            r['License Model'] === 'No License required',
        ),
      ]),
    ),
    ebsGp3PerGbMonth: ec2Price('EBS gp3', ec2, (r) => r.usageType === 'EBS:VolumeUsage.gp3'),
  },
  rds: {
    perHour: Object.fromEntries(
      RDS_CLASSES.map((c) => [
        c,
        price(
          `RDS ${c}`,
          rows(rds, (a) => usage(new RegExp(`^InstanceUsage:${c.replaceAll('.', '\\.')}$`))(a) && a.databaseEngine === 'PostgreSQL' && a.deploymentOption === 'Single-AZ'),
        ),
      ]),
    ),
    gp3PerGbMonth: price(
      'RDS gp3 storage',
      rows(rds, (a) => usage(/^RDS:GP3-Storage$/)(a) && a.deploymentOption === 'Single-AZ' && ['PostgreSQL', 'Any'].includes(a.databaseEngine) && !a.deploymentModel),
    ),
  },
  dynamodb: {
    perReadUnit: price('DynamoDB reads', rows(ddb, usage(/^ReadRequestUnits$/))),
    perWriteUnit: price('DynamoDB writes', rows(ddb, usage(/^WriteRequestUnits$/))),
    storagePerGbMonth: price('DynamoDB storage', rows(ddb, usage(/^TimedStorage-ByteHrs$/))),
  },
  s3: {
    storagePerGbMonth: price('S3 storage', rows(s3, (a) => usage(/^TimedStorage-ByteHrs$/)(a) && a.storageClass === 'General Purpose')),
    perGet: price('S3 GET', rows(s3, usage(/^Requests-Tier2$/))),
    perPut: price('S3 PUT', rows(s3, usage(/^Requests-Tier1$/))),
  },
  sqs: {
    perRequest: {
      standard: price('SQS standard', rows(sqs, usage(/^Requests-RBP$/))),
      fifo: price('SQS FIFO', rows(sqs, usage(/^Requests-FIFO-RBP$/))),
    },
  },
  elasticache: {
    perHour: Object.fromEntries(
      ['Redis', 'Valkey'].map((engine) => [
        engine.toLowerCase(),
        Object.fromEntries(
          CACHE_TYPES.map((t) => [
            t,
            price(`ElastiCache ${engine} ${t}`, rows(cache, (a) => usage(new RegExp(`^NodeUsage:${t.replaceAll('.', '\\.')}$`))(a) && a.cacheEngine === engine)),
          ]),
        ),
      ]),
    ),
  },
  aurora: {
    perAcuHour: price('Aurora Serverless v2 ACU', rows(rds, (a) => usage(/^Aurora:ServerlessV2Usage$/)(a) && a.databaseEngine === 'Aurora PostgreSQL')),
    storagePerGbMonth: price('Aurora storage', rows(rds, (a) => usage(/^Aurora:StorageUsage$/)(a) && a.databaseEngine === 'Aurora PostgreSQL')),
    perIo: price('Aurora I/O', rows(rds, (a) => usage(/^Aurora:StorageIOUsage$/)(a) && a.databaseEngine === 'Aurora PostgreSQL')),
  },
  sns: {
    perRequest: price('SNS requests', rows(sns, usage(/^Requests-Tier1$/))),
    perHttpDelivery: price('SNS HTTP deliveries', rows(sns, usage(/^DeliveryAttempts-HTTP$/))),
    perEmailDelivery: price('SNS email deliveries', rows(sns, usage(/^DeliveryAttempts-SMTP$/))),
  },
  eventbridge: {
    perEvent: price('EventBridge events', rows(events, usage(/-Event-64K-Chunks$/))),
  },
  kinesis: {
    perStreamHour: price('Kinesis stream hours', rows(kinesis, usage(/^OnDemand-StreamHour$/))),
    perGbIn: price('Kinesis GB in', rows(kinesis, usage(/^OnDemand-BilledIncomingBytes$/))),
    perGbOut: price('Kinesis GB out', rows(kinesis, usage(/^OnDemand-BilledOutgoingBytes$/))),
  },
  stepFunctions: {
    perStateTransition: price('Step Functions transitions', rows(states, usage(/-StateTransition$/))),
    expressPerRequest: price('Step Functions Express requests', rows(states, usage(/-StepFunctions-Request$/))),
    expressPerGbSecond: price('Step Functions Express GB-s', rows(states, usage(/-StepFunctions-GB-Second$/))),
  },
  cognito: {
    perMau: {
      lite: price('Cognito Lite MAU', rows(cognito, usage(/-CognitoLiteMAU$/))),
      essentials: price('Cognito Essentials MAU', rows(cognito, usage(/-CognitoEssentialsMAU$/))),
      plus: price('Cognito Plus MAU', rows(cognito, usage(/-CognitoPlusMAU$/))),
    },
  },
  natGateway: {
    perHour: ec2Price('NAT Gateway hours', ec2, (r) => r.usageType === 'NatGateway-Hours'),
    perGbProcessed: ec2Price('NAT Gateway GB', ec2, (r) => r.usageType === 'NatGateway-Bytes'),
  },
  cloudfront: {
    perGbOut: price('CloudFront GB out', rows(cf, (a) => a.fromLocation === 'United States' && a.usagetype === 'US-DataTransfer-Out-Bytes')),
    perHttpsRequest: price('CloudFront HTTPS requests', rows(cf, (a) => a.location === 'United States' && a.usagetype === 'US-Requests-Tier2-HTTPS')),
  },
  dataTransfer: {
    internetOutPerGb: price('Internet egress', rows(transfer, (a) => a.fromLocation === LOCATION && a.transferType === 'AWS Outbound' && a.usagetype === 'DataTransfer-Out-Bytes')),
    // AWS charges $0.01/GB on each side of a cross-AZ transfer.
    crossAzPerGb: 2 * price('Cross-AZ transfer', rows(transfer, (a) => a.fromLocation === LOCATION && a.usagetype === 'DataTransfer-Regional-Bytes')),
  },
}

if (process.argv.includes('--if-changed')) {
  const current = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'))
  if (JSON.stringify(current.prices) === JSON.stringify(prices)) {
    console.log('No price changes.')
    process.exit(0)
  }
}

const out = { pricesAsOf: new Date().toISOString().slice(0, 10), region: REGION, prices }
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${OUT.pathname}`)
