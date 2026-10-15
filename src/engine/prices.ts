// On-demand list prices for us-east-1 (USD), taken from the public AWS Price List
// Bulk API (https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json).
// Only the first pricing tier is used. Checked 2026-10-15.

export const PRICES_AS_OF = '2026-10-15'
export const REGION = 'us-east-1'
export const HOURS_PER_MONTH = 730

export const prices = {
  lambda: {
    perRequest: 0.2 / 1e6,
    perGbSecond: { x86: 0.0000166667, arm: 0.0000133334 },
  },
  apiGateway: {
    perRequest: { http: 1.0 / 1e6, rest: 3.5 / 1e6 },
  },
  alb: {
    perHour: 0.0225,
    perLcuHour: 0.008,
  },
  fargate: {
    perVcpuHour: { x86: 0.04048, arm: 0.03238 },
    perGbHour: { x86: 0.004445, arm: 0.00356 },
  },
  ec2: {
    perHour: {
      't3.micro': 0.0104,
      't3.small': 0.0208,
      't3.medium': 0.0416,
      't3.large': 0.0832,
      'm7g.large': 0.0816,
      'm7i.large': 0.1008,
      'c7g.large': 0.0725,
      'c7i.large': 0.08925,
      'r7g.large': 0.1071,
      'r7i.large': 0.1323,
    } as Record<string, number>,
    ebsGp3PerGbMonth: 0.08,
  },
  rds: {
    // PostgreSQL, Single-AZ. Multi-AZ doubles instance and storage cost.
    perHour: {
      'db.t4g.micro': 0.016,
      'db.t4g.small': 0.032,
      'db.t4g.medium': 0.065,
      'db.t4g.large': 0.129,
      'db.m7g.large': 0.168,
      'db.r7g.large': 0.239,
    } as Record<string, number>,
    gp3PerGbMonth: 0.115,
  },
  dynamodb: {
    perReadUnit: 0.125 / 1e6,
    perWriteUnit: 0.625 / 1e6,
    storagePerGbMonth: 0.25,
  },
  s3: {
    storagePerGbMonth: 0.023,
    perGet: 0.0004 / 1000,
    perPut: 0.005 / 1000,
  },
  sqs: {
    perRequest: { standard: 0.4 / 1e6, fifo: 0.5 / 1e6 },
  },
  elasticache: {
    perHour: {
      redis: {
        'cache.t4g.micro': 0.016,
        'cache.t4g.small': 0.032,
        'cache.t4g.medium': 0.065,
        'cache.m7g.large': 0.158,
        'cache.r7g.large': 0.219,
      },
      valkey: {
        'cache.t4g.micro': 0.0128,
        'cache.t4g.small': 0.0256,
        'cache.t4g.medium': 0.052,
        'cache.m7g.large': 0.1264,
        'cache.r7g.large': 0.1752,
      },
    } as Record<string, Record<string, number>>,
  },
  natGateway: {
    perHour: 0.045,
    perGbProcessed: 0.045,
  },
  cloudfront: {
    perGbOut: 0.085,
    perHttpsRequest: 0.01 / 10000,
  },
  dataTransfer: {
    internetOutPerGb: 0.09,
    // $0.01/GB charged on each side of a cross-AZ transfer.
    crossAzPerGb: 0.02,
  },
}

// AWS "always free" monthly allowances, shared across the whole account.
export const freeTier: Record<string, number> = {
  'lambda.requests': 1e6,
  'lambda.gbSeconds': 400_000,
  'sqs.requests': 1e6,
  'dynamodb.storageGb': 25,
  'internet.egressGb': 100,
  'cloudfront.egressGb': 1000,
  'cloudfront.requests': 10e6,
}
