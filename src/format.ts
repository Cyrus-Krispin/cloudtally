const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const money = (value: number) => {
  if (value === 0) return '$0'
  if (value < 0.01) return '<$0.01'
  return value >= 10_000 ? usdWhole.format(value) : usd.format(value)
}

export const count = (value: number) => (value < 1000 ? String(Math.round(value * 100) / 100) : compact.format(value))

export const unitPrice = (value: number) => {
  if (value === 0) return '$0'
  if (value >= 0.01) return usd.format(value)
  // Per-request prices read better per million.
  if (value < 0.001) return `$${Number((value * 1e6).toPrecision(3))}/M`
  return `$${Number(value.toPrecision(3))}`
}
