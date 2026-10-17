import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DesignId } from '../engine/compare'

export const HEIGHT = 340
export const MARGIN = { top: 16, right: 16, bottom: 30, left: 60 }
/** The first two colors of the Scale chart's palette. */
export const DESIGN_COLORS: Record<DesignId, string> = { a: '#2a78d6', b: '#eb6834' }
/** Daily user counts labelled on the x axis. */
export const DAU_TICKS = [1e3, 1e4, 1e5, 1e6, 1e7]

const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
export const axisMoney = (v: number) => (v < 1 ? `$${Number(v.toPrecision(1))}` : compactUsd.format(v))

/** Tracks an element's width so the chart can fill it. */
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}
