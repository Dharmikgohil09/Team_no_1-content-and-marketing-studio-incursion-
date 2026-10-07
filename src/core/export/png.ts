import type { CardTemplate } from '../schema/CardTemplate'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { EventContext } from '../schema/EventContext'
import type { BrandKit } from '../schema/BrandKit'
import { renderCard } from '../renderer'
import { mmToPxAtDpi } from '../layout/textMeasure'

export interface PngExportOptions {
  template:     CardTemplate
  role:         Role
  person:       Person
  event:        EventContext
  brandKit:     BrandKit
  dpi:          150 | 300 | 600
  includeBleed: boolean
  face:         'front' | 'back'
}

/**
 * Rasterize a card to PNG at the specified DPI.
 * Uses an off-screen canvas to render the SVG.
 */
export async function exportPng(opts: PngExportOptions): Promise<Blob> {
  const { template, role, person, event, brandKit, dpi, includeBleed, face } = opts
  const size  = template.size
  const w     = template.orientation === 'portrait' ? size.heightMm : size.widthMm
  const h     = template.orientation === 'portrait' ? size.widthMm  : size.heightMm
  const bleed = includeBleed ? size.bleedMm : 0
  const totalW = w + bleed * 2
  const totalH = h + bleed * 2

  const { svg } = renderCard({ template, role, person, event, brandKit, face, includeBleed })

  const pxW = Math.round(mmToPxAtDpi(totalW, dpi))
  const pxH = Math.round(mmToPxAtDpi(totalH, dpi))

  return svgToPng(svg, pxW, pxH)
}

async function svgToPng(svgString: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const img = new Image()
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG for PNG export'))
    }
    img.src = url
  })
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
