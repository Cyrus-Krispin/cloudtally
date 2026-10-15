import { describe, expect, it } from 'vitest'
import generated from './prices.generated.json'

const leaves = (value: unknown, path = ''): [string, unknown][] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
    : [[path, value]]

describe('generated prices', () => {
  it('has a date and region', () => {
    expect(generated.pricesAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(generated.region).toBe('us-east-1')
  })

  it.each(leaves(generated.prices))('%s is a positive number', (_path, value) => {
    expect(typeof value).toBe('number')
    expect(value).toBeGreaterThan(0)
  })
})
