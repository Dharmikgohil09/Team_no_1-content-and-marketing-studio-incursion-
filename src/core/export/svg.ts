import type { CardTemplate } from '../schema/CardTemplate'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { EventContext } from '../schema/EventContext'
import type { BrandKit } from '../schema/BrandKit'
import { renderCard } from '../renderer'

export interface SvgExportOptions {
  template:     CardTemplate
  role:         Role
  person:       Person
  event:        EventContext
  brandKit:     BrandKit
  includeBleed: boolean
  face:         'front' | 'back'
}

/** Export a single card as an SVG string */
export function exportSvg(opts: SvgExportOptions): string {
  const { svg } = renderCard({
    template:     opts.template,
    role:         opts.role,
    person:       opts.person,
    event:        opts.event,
    brandKit:     opts.brandKit,
    face:         opts.face,
    includeBleed: opts.includeBleed,
  })
  return svg
}

/** Trigger a browser download of an SVG file */
export function downloadSvg(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  URL.revokeObjectURL(url)
}

function triggerDownload(url: string, filename: string): void {
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
}
