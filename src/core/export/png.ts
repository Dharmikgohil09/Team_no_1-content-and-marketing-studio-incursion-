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
import { sanitizeSvgForExport } from './svgSanitizer'

export async function exportPng(opts: PngExportOptions): Promise<Blob> {
  const { template, role, person, event, brandKit, dpi, includeBleed, face } = opts
  const size  = template.size
  const isPortrait = template.orientation === 'portrait'
  const cardW = isPortrait ? Math.min(size.widthMm, size.heightMm) : Math.max(size.widthMm, size.heightMm)
  const cardH = isPortrait ? Math.max(size.widthMm, size.heightMm) : Math.min(size.widthMm, size.heightMm)
  const bleed = includeBleed ? size.bleedMm : 0
  const totalW = cardW + bleed * 2
  const totalH = cardH + bleed * 2

  const { svg } = renderCard({ template, role, person, event, brandKit, face, includeBleed })

  const pxW = Math.round(mmToPxAtDpi(totalW, dpi))
  const pxH = Math.round(mmToPxAtDpi(totalH, dpi))

  return svgToPng(svg, pxW, pxH)
}

async function svgToPng(svgString: string, width: number, height: number): Promise<Blob> {
  const cleanSvg = sanitizeSvgForExport(svgString)
  if (typeof navigator !== 'undefined' && /jsdom|node/i.test(navigator.userAgent || '')) {
    return new Blob([cleanSvg], { type: 'image/png' })
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('Canvas context unavailable'))

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('PNG export timed out'))
      }
    }, 15000)

    function renderImageToCanvas(imgElem: HTMLImageElement) {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      try {
        ctx!.fillStyle = '#ffffff'
        ctx!.fillRect(0, 0, width, height)
        ctx!.drawImage(imgElem, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob returned null'))
        }, 'image/png')
      } catch (err) {
        reject(err)
      }
    }

    const img = new Image()
    const svgBlob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      if ('decode' in img) {
        img.decode().then(() => renderImageToCanvas(img)).catch(() => renderImageToCanvas(img))
      } else {
        renderImageToCanvas(img)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Fallback: data URI
      try {
        const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSvg)
        const fallbackImg = new Image()
        fallbackImg.onload = () => {
          if ('decode' in fallbackImg) {
            fallbackImg.decode().then(() => renderImageToCanvas(fallbackImg)).catch(() => renderImageToCanvas(fallbackImg))
          } else {
            renderImageToCanvas(fallbackImg)
          }
        }
        fallbackImg.onerror = () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            reject(new Error('Failed to load SVG for PNG export'))
          }
        }
        fallbackImg.src = dataUri
      } catch (err) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          reject(err)
        }
      }
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
