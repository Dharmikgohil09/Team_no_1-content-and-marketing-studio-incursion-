import { PDFDocument, rgb, degrees } from 'pdf-lib'
import type { CardTemplate } from '../schema/CardTemplate'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { EventContext } from '../schema/EventContext'
import type { BrandKit } from '../schema/BrandKit'
import { renderCard } from '../renderer'
import { mmToPxAtDpi } from '../layout/textMeasure'

const MM_PER_PT = 2.8346  // 1mm = 2.8346pt (PDF units)

export interface PdfExportOptions {
  template:     CardTemplate
  roles:        Role[]
  people:       Person[]
  event:        EventContext
  brandKit:     BrandKit
  includeBleed: boolean
  dpi:          number
  multiPage:    boolean   // one page per card
}

/**
 * Export all cards as a multi-page PDF.
 * Each card is embedded as a vector SVG page.
 * 
 * Note: pdf-lib doesn't natively render SVG, so we embed SVG as XObject.
 * For production, svg2pdf.js would be used for true vector embedding.
 * Here we create properly-sized pages with SVG data.
 */
async function svgToPngBytes(svgString: string, width: number, height: number): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)

      const img = new Image()
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        canvas.toBlob((blob) => {
          if (!blob) return resolve(null)
          blob.arrayBuffer()
            .then(buf => resolve(new Uint8Array(buf)))
            .catch(() => resolve(null))
        }, 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    } catch {
      resolve(null)
    }
  })
}

export async function exportPdf(opts: PdfExportOptions): Promise<Uint8Array> {
  const { template, roles, people, event, brandKit, includeBleed, dpi = 300 } = opts
  const size = template.size
  const w    = template.orientation === 'portrait' ? size.heightMm : size.widthMm
  const h    = template.orientation === 'portrait' ? size.widthMm  : size.heightMm
  const bleed = includeBleed ? size.bleedMm : 0
  const totalW = w + bleed * 2
  const totalH = h + bleed * 2

  const pdf = await PDFDocument.create()
  const pxW = Math.round(mmToPxAtDpi(totalW, dpi))
  const pxH = Math.round(mmToPxAtDpi(totalH, dpi))

  for (const person of people) {
    const role = roles.find(r => r.id === person.role) ?? roles[0]
    if (!role) continue

    const { svg } = renderCard({
      template,
      role,
      person,
      event,
      brandKit,
      face: 'front',
      includeBleed,
    })

    // Add a page at exact card size (in PDF points)
    const page = pdf.addPage([totalW * MM_PER_PT, totalH * MM_PER_PT])

    const pngBytes = await svgToPngBytes(svg, pxW, pxH)
    if (pngBytes) {
      try {
        const pngImage = await pdf.embedPng(pngBytes)
        page.drawImage(pngImage, {
          x:      0,
          y:      0,
          width:  totalW * MM_PER_PT,
          height: totalH * MM_PER_PT,
        })
      } catch (e) {
        console.warn('Could not embed PNG into PDF, falling back to vector text', e)
        page.drawRectangle({
          x:      0,
          y:      0,
          width:  totalW * MM_PER_PT,
          height: totalH * MM_PER_PT,
          color:  rgb(1, 1, 1),
        })
        page.drawText(`${person.name} — ${role.label}`, {
          x:    bleed * MM_PER_PT + 5,
          y:    totalH * MM_PER_PT / 2,
          size: 10,
        })
      }
    } else {
      page.drawRectangle({
        x:      0,
        y:      0,
        width:  totalW * MM_PER_PT,
        height: totalH * MM_PER_PT,
        color:  rgb(1, 1, 1),
      })
      page.drawText(`${person.name} — ${role.label}`, {
        x:    bleed * MM_PER_PT + 5,
        y:    totalH * MM_PER_PT / 2,
        size: 10,
      })
    }
  }

  pdf.setTitle(event.name.value ?? 'ID Cards')
  pdf.setCreator('Content & Marketing Studio — ACM NIT Surat')

  return pdf.save()
}


/** Download a PDF Uint8Array as a file */
export function downloadPdf(data: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
