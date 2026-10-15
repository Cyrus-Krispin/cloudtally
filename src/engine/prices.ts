// On-demand list prices for us-east-1 (USD), first pricing tier only.
// Generated from the public AWS Price List Bulk API by scripts/fetch-prices.mjs;
// a weekly GitHub Action reruns it and opens a pull request when prices change.
import generated from './prices.generated.json'

export const PRICES_AS_OF = generated.pricesAsOf
export const REGION = generated.region
export const HOURS_PER_MONTH = 730

type Generated = typeof generated.prices

/** Instance and node prices are looked up by a size chosen in the UI, so index them by string. */
export const prices = generated.prices as Omit<Generated, 'ec2' | 'rds' | 'elasticache'> & {
  ec2: Omit<Generated['ec2'], 'perHour'> & { perHour: Record<string, number> }
  rds: Omit<Generated['rds'], 'perHour'> & { perHour: Record<string, number> }
  elasticache: { perHour: Record<string, Record<string, number>> }
}
