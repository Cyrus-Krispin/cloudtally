import { getNodesBounds, type Node } from '@xyflow/react'
import { toPng } from 'html-to-image'

const PADDING = 80
const HEADER = 76
const SIDEBAR = 300
const ROW = 26
const SCALE = 2

export interface CostRow {
  label: string
  amount: string
}

export function downloadFile(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  downloadFile(filename, url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/** Renders the whole diagram at 100% zoom with a cost summary, and downloads it as a PNG. */
export async function exportPng(nodes: Node[], title: string, subtitle: string, rows: CostRow[]) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport || !nodes.length) return

  const bounds = getNodesBounds(nodes)
  const width = Math.max(Math.ceil(bounds.width + PADDING * 2), 640)
  const height = Math.max(Math.ceil(bounds.height + PADDING * 2), rows.length * ROW + 80)

  // Hide selection highlights while capturing.
  document.body.classList.add('exporting')

  let diagram: string
  try {
    diagram = await toPng(viewport, {
      backgroundColor: '#ffffff',
      width,
      height,
      pixelRatio: SCALE,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
      },
    })
  } finally {
    document.body.classList.remove('exporting')
  }

  const fullWidth = width + SIDEBAR
  const canvas = document.createElement('canvas')
  canvas.width = fullWidth * SCALE
  canvas.height = (height + HEADER) * SCALE
  const ctx = canvas.getContext('2d')!
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, sans-serif`
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, fullWidth, height + HEADER)

  ctx.fillStyle = '#16191f'
  ctx.font = font(600, 24)
  ctx.fillText(title, 24, 38)
  ctx.fillStyle = '#5f6b7a'
  ctx.font = font(400, 13)
  ctx.fillText(subtitle, 24, 60)
  ctx.fillStyle = '#e9ebed'
  ctx.fillRect(0, HEADER - 1, fullWidth, 1)
  ctx.drawImage(await loadImage(diagram), 0, HEADER, width, height)

  // Cost breakdown down the right-hand side.
  const x = width
  ctx.fillStyle = '#f7f8f8'
  ctx.fillRect(x, HEADER, SIDEBAR, height)
  ctx.fillStyle = '#e9ebed'
  ctx.fillRect(x, HEADER, 1, height)
  ctx.fillStyle = '#5f6b7a'
  ctx.font = font(600, 11)
  ctx.fillText('MONTHLY COST BY SERVICE', x + 20, HEADER + 32)
  rows.forEach((row, i) => {
    const y = HEADER + 62 + i * ROW
    ctx.fillStyle = '#16191f'
    ctx.font = font(400, 13)
    ctx.textAlign = 'left'
    ctx.fillText(row.label, x + 20, y, SIDEBAR - 120)
    ctx.textAlign = 'right'
    ctx.fillText(row.amount, x + SIDEBAR - 20, y)
  })
  ctx.textAlign = 'left'

  downloadFile('cloudtally-diagram.png', canvas.toDataURL('image/png'))
}
