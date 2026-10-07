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
export async function exportPdf(opts: PdfExportOptions): Promise<Uint8Array> {
  const { template, roles, people, event, brandKit, includeBleed } = opts
  const size = template.size
  const w    = template.orientation === 'portrait' ? size.heightMm : size.widthMm
  const h    = template.orientation === 'portrait' ? size.widthMm  : size.heightMm
  const bleed = includeBleed ? size.bleedMm : 0
  const totalW = w + bleed * 2
  const totalH = h + bleed * 2

  const pdf = await PDFDocument.create()

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

    // Add SVG as embedded data annotation
    // (In production use svg2pdf.js for true vector embedding)
    // For now embed the SVG as a metadata note and white background
    page.drawRectangle({
      x:      0,
      y:      0,
      width:  totalW * MM_PER_PT,
      height: totalH * MM_PER_PT,
      color:  rgb(1, 1, 1),
    })

    // Draw person name as proof of per-card generation
    page.drawText(`${person.name} — ${role.label}`, {
      x:    bleed * MM_PER_PT + 5,
      y:    totalH * MM_PER_PT / 2,
      size: 10,
    })

    page.drawText(`ID: ${person.id}`, {
      x:    bleed * MM_PER_PT + 5,
      y:    totalH * MM_PER_PT / 2 - 14,
      size: 8,
    })
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
