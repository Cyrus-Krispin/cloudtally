import type { Config } from '../types'

export const num = (config: Config, key: string): number => {
  const value = Number(config[key])
  return Number.isFinite(value) ? value : 0
}

export const str = (config: Config, key: string): string => String(config[key] ?? '')

export const options = (values: string[]) => values.map((value) => ({ value, label: value }))
