import type { Element, TextElement, ImageElement, ShapeElement, PhotoElement, QRElement, BarcodeElement, Anchor } from '../schema/Element'
import type { CardTemplate } from '../schema/CardTemplate'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { EventContext } from '../schema/EventContext'
import type { BrandKit } from '../schema/BrandKit'
import { resolveBindings, type BindingContext } from './bindings'
import { autoFitText } from '../layout/autoFit'
import { mmToPx } from '../layout/textMeasure'
import QRCode from 'qrcode'

import { getDefaultBrandKit } from '../../brandKits/loader'

/** DPI used for screen preview (SVG uses mm natively via viewBox) */
const SCREEN_DPI = 96

/**
 * Convert mm value to SVG user units (we use 1uu = 1mm via viewBox transform)
 * so this is identity — but keeping for clarity and future DPI override
 */
const mm = (v: number) => v

/** Build an SVG string for a card face (front or back) */
export interface RenderOptions {
  template:    CardTemplate
  role:        Role
  person:      Person
  event:       EventContext
  brandKit?:   BrandKit
  face:        'front' | 'back'
  /** If true, emit bleed area (uses template.size.bleedMm) */
  includeBleed?: boolean
  /** Override size in mm (used for print export) */
  widthMm?:    number
  heightMm?:   number
}

export interface RenderResult {
  svg:      string
  warnings: string[]
}

export function renderCard(opts: RenderOptions): RenderResult {
  const { template, role, person, event, face, includeBleed } = opts
  const brandKit = opts.brandKit || getDefaultBrandKit()
  const warnings: string[] = []

  const size = template.size || {
    name: 'CR80',
    widthMm: 54,
    heightMm: 85.6,
    bleedMm: 0,
    safeMarginMm: 3,
  }
  const portraitWidth = Math.min(size.widthMm, size.heightMm)
  const portraitHeight = Math.max(size.widthMm, size.heightMm)
  let w = opts.widthMm ?? (template.orientation === 'portrait' ? portraitWidth : portraitHeight)
  let h = opts.heightMm ?? (template.orientation === 'portrait' ? portraitHeight : portraitWidth)
  const bleed = includeBleed ? (size.bleedMm ?? 0) : 0

  const totalW = w + bleed * 2
  const totalH = h + bleed * 2

  const ctx: BindingContext = { event, role, person, brandKit }
  const elements = face === 'front'
    ? (template.roleElements?.[role.id] ?? template.elements)
    : (template.roleBackElements?.[role.id] ?? template.backElements ?? [])

  const elementsSVG = elements.map(el => renderElement(el, ctx, { w, h, bleed }, warnings)).join('\n')

  const svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  viewBox="${-bleed} ${-bleed} ${totalW} ${totalH}"
  width="${mm(totalW)}mm"
  height="${mm(totalH)}mm"
  data-role="${role.id}"
  class="svg-card-display"
  data-card-width="${w}mm"
  data-card-height="${h}mm"
>
  <defs>
    ${buildDefs(template, role, w, h)}
  </defs>
  <!-- Card background (transparent — template bg shapes define card color) -->
  <rect x="${-bleed}" y="${-bleed}" width="${totalW}" height="${totalH}" fill="#ffffff"/>
  <!-- Bleed indicator -->
  ${bleed > 0 ? `<rect x="${-bleed}" y="${-bleed}" width="${totalW}" height="${totalH}" fill="none" stroke="#cccccc" stroke-width="0.25" stroke-dasharray="1,1"/>` : ''}
  <!-- Card face — clipped to card bounds -->
  <g id="card-face" clip-path="url(#card-clip-${template.id})" transform="translate(0,0)">
${elementsSVG}
  </g>
  ${bleed > 0 ? cropMarksSVG(w, h, bleed) : ''}
</svg>`

  return { svg, warnings }
}

function buildDefs(template: CardTemplate, role: Role, w?: number, h?: number): string {
  const cardW = w ?? (template.orientation === 'portrait' ? 54 : 85.6)
  const cardH = h ?? (template.orientation === 'portrait' ? 85.6 : 54)

  const roleFront = template.roleElements?.[role.id] ?? template.elements
  const roleBack  = template.roleBackElements?.[role.id] ?? template.backElements ?? []
  const allElements = [...roleFront, ...roleBack]

  // Clip paths for image/photo elements
  const elemClipPaths = allElements
    .filter(el => el.type === 'image' || el.type === 'photo')
    .map(el => {
      const rx = (el as any).cornerRadius ?? 0
      const a  = el.anchor
      return `<clipPath id="el-clip-${el.id}">
        <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${rx}" ry="${rx}" />
      </clipPath>`
    })
    .join('\n')

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
      text { font-family: 'Hanken Grotesk', 'Inter', -apple-system, sans-serif; }
    </style>
    <clipPath id="card-clip-${template.id}">
      <rect x="0" y="0" width="${cardW}" height="${cardH}"/>
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
    <filter id="glow-${role.id}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.8" flood-color="${role.palette.accent}" flood-opacity="0.65"/>
    </filter>
    ${elemClipPaths}
  `
}


function cropMarksSVG(w: number, h: number, bleed: number): string {
  const size = 3 // crop mark length mm
  const gap  = 1 // gap from card edge mm
  const s    = 0.25
  const parts = [
    // top-left
    `<line x1="${-bleed}" y1="${-gap}" x2="${-bleed}" y2="${-bleed-size}" stroke="#000" stroke-width="${s}"/>`,
    `<line x1="${-gap}" y1="${-bleed}" x2="${-bleed-size}" y2="${-bleed}" stroke="#000" stroke-width="${s}"/>`,
    // top-right
    `<line x1="${w+bleed}" y1="${-gap}" x2="${w+bleed}" y2="${-bleed-size}" stroke="#000" stroke-width="${s}"/>`,
    `<line x1="${w+gap}" y1="${-bleed}" x2="${w+bleed+size}" y2="${-bleed}" stroke="#000" stroke-width="${s}"/>`,
    // bottom-left
    `<line x1="${-bleed}" y1="${h+gap}" x2="${-bleed}" y2="${h+bleed+size}" stroke="#000" stroke-width="${s}"/>`,
    `<line x1="${-gap}" y1="${h+bleed}" x2="${-bleed-size}" y2="${h+bleed}" stroke="#000" stroke-width="${s}"/>`,
    // bottom-right
    `<line x1="${w+bleed}" y1="${h+gap}" x2="${w+bleed}" y2="${h+bleed+size}" stroke="#000" stroke-width="${s}"/>`,
    `<line x1="${w+gap}" y1="${h+bleed}" x2="${w+bleed+size}" y2="${h+bleed}" stroke="#000" stroke-width="${s}"/>`,
  ]
  return `<g id="crop-marks">${parts.join('')}</g>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Element renderers
// ─────────────────────────────────────────────────────────────────────────────

interface CardBounds { w: number; h: number; bleed: number }

function renderElement(el: Element, ctx: BindingContext, bounds: CardBounds, warnings: string[]): string {
  // Suppress date and venue elements completely from ID cards
  const elId = el.id.toLowerCase()
  if (elId.includes('venue') || elId.includes('date')) {
    return ''
  }
  if (el.type === 'text') {
    const rawContent = (el as TextElement).content || ''
    if (rawContent.includes('event.venue') || rawContent.includes('event.date')) {
      return ''
    }
  }

  switch (el.type) {
    case 'text':    return renderText(el, ctx, warnings)
    case 'image':   return renderImage(el, ctx, warnings)
    case 'shape':   return renderShape(el, ctx)
    case 'photo':   return renderPhoto(el, ctx, warnings)
    case 'qr':      return renderQR(el, ctx)
    case 'barcode': return renderBarcode(el, ctx)
    default:        return ''
  }
}

function renderText(el: TextElement, ctx: BindingContext, warnings: string[]): string {
  const a = el.anchor
  let color = el.color
  let fontWeight = el.fontWeight

  // Apply role-conditional overrides
  const roleOverride = el.roleConditional?.[ctx.role.id]
  if (roleOverride?.color) color = roleOverride.color
  if (roleOverride?.fontWeight) fontWeight = roleOverride.fontWeight as typeof fontWeight

  // Resolve binding
  let content = resolveBindings(
    roleOverride?.content ?? el.content,
    ctx
  )

  // Contextual fallback for empty or placeholder content
  if (!content || !content.trim() || content.trim() === '—' || content.trim() === '·' || content.trim() === '-' || content.trim() === '[No Name]') {
    const id = el.id.toLowerCase()
    if (id.includes('event-name') || id.includes('title')) {
      content = ctx.event?.name?.value || 'EVENT PASS'
    } else if (id.includes('venue') || id.includes('date')) {
      return ''
    } else if (id.includes('person-name') || id === 'name') {
      content = ctx.person?.name && ctx.person.name !== '[No Name]' ? ctx.person.name : 'Participant Name'
    } else if (id.includes('role-label') || id === 'role') {
      content = (ctx.role?.label || 'PARTICIPANT').toUpperCase()
    } else if (id.includes('person-detail') || id.includes('team')) {
      content = ctx.person?.team || ''
    } else if (id.includes('org') || id.includes('branding') || id.includes('acm-label')) {
      content = ctx.event?.organizer?.value
        ? ctx.event.organizer.value.toUpperCase()
        : (ctx.event?.name?.value ? `${ctx.event.name.value.toUpperCase()} · OFFICIAL PASS` : 'OFFICIAL EVENT PASS')
    } else if (id.includes('category') || id.includes('badge-type')) {
      content = 'OFFICIAL PASS'
    }
  }

  // If text content is completely empty, do not render an empty tspan or orphan element
  if (!content || !content.trim()) {
    return ''
  }

  // Title-case raw lowercase event names for professional look
  if ((el.id.includes('event-name') || el.id.includes('title') || el.id.includes('header-category')) && content && content === content.toLowerCase()) {
    content = content.replace(/\b\w/g, l => l.toUpperCase())
  }

  // Auto-fit
  const fit = autoFitText({
    text:        content,
    widthMm:     a.w,
    heightMm:    a.h,
    fontFamily:  el.fontFamily,
    fontSize:    el.fontSize,
    fontWeight:  fontWeight,
    maxLines:    el.maxLines,
    minFontSize: el.minFontSize,
  })

  if (fit.truncated) warnings.push(`Text truncated in element "${el.id}"`)
  if (fit.overflow)  warnings.push(`Text overflow in element "${el.id}"`)

  // In SVG with mm viewBox (where 1 unit = 1mm), 1pt = 25.4/72 user units
  const ptToMm = 25.4 / 72
  const fontSizeMm = fit.fontSize * ptToMm

  const textAnchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
  const xPos = el.align === 'center' ? a.x + a.w / 2 : el.align === 'right' ? a.x + a.w : a.x

  const lineHeightMm = fontSizeMm * 1.25
  const startY = el.verticalAlign === 'middle'
    ? a.y + (a.h - fit.lines.length * lineHeightMm) / 2 + fontSizeMm * 0.85
    : el.verticalAlign === 'bottom'
    ? a.y + a.h - (fit.lines.length - 1) * lineHeightMm
    : a.y + fontSizeMm * 0.9

  const tspans = fit.lines.map((line, i) =>
    `<tspan x="${xPos}" dy="${i === 0 ? 0 : lineHeightMm}" xml:space="preserve">${escapeXml(line)}</tspan>`
  ).join('')

  return `<text
    id="${el.id}"
    x="${xPos}" y="${startY}"
    font-family="${el.fontFamily}, 'Outfit', 'Space Grotesk', 'Inter', sans-serif"
    font-size="${fontSizeMm}"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="${textAnchor}"
    dominant-baseline="auto"
  >${tspans}</text>`
}

function renderImage(el: ImageElement, ctx: BindingContext, warnings: string[]): string {
  const a    = el.anchor
  const src  = resolveBindings(el.src, ctx)
  // Only clip if explicitly rounded, to avoid browser clipping bugs on standard logos
  const clip = (el.cornerRadius && el.cornerRadius > 0) ? `clip-path="url(#el-clip-${el.id})"` : ''

  const preserveAR = el.preserveAspectRatio
    ? el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
    : 'none'

  if (!src) {
    const rx = el.cornerRadius > 0 ? el.cornerRadius : 2
    const cx = a.x + a.w / 2
    const headR = a.w * 0.22
    const headCy = a.y + a.h * 0.38
    return `<g id="${el.id}" ${clip}>
      <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${rx}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3"/>
      <!-- Silhouette Head -->
      <circle cx="${cx}" cy="${headCy}" r="${headR}" fill="#94a3b8"/>
      <!-- Silhouette Shoulders -->
      <path d="M ${a.x + a.w * 0.16} ${a.y + a.h} A ${a.w * 0.4} ${a.h * 0.35} 0 0 1 ${a.x + a.w * 0.84} ${a.y + a.h} Z" fill="#94a3b8"/>
    </g>`
  }

  return `<image
    id="${el.id}"
    href="${src}"
    xlink:href="${src}"
    x="${a.x}" y="${a.y}"
    width="${a.w}" height="${a.h}"
    preserveAspectRatio="${preserveAR}"
    opacity="${el.opacity}"
    ${clip}
  />`
}

function renderShape(el: ShapeElement, ctx: BindingContext): string {
  const a     = el.anchor
  let fill    = el.fill
  let stroke  = el.stroke

  // Resolve fill binding (e.g. role palette)
  if (el.fillBinding) {
    const bound = resolveBindings(el.fillBinding, ctx)
    fill = bound || el.fill || '#091128'
  }
  if (!fill || fill === 'transparent') {
    fill = el.fill || '#091128'
  }

  // Role-conditional overrides
  const roleOverride = el.roleConditional?.[ctx.role.id]
  if (roleOverride?.fill)   fill   = roleOverride.fill
  if (roleOverride?.stroke) stroke = roleOverride.stroke

  const baseAttrs = `fill="${fill}" stroke="${stroke || 'transparent'}" stroke-width="${el.strokeWidth || 0}" opacity="${el.opacity ?? 1}"`

  switch (el.shape) {
    case 'rect':
      return `<rect id="${el.id}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${el.cornerRadius || 0}" ${baseAttrs}/>`
    case 'circle':
      return `<circle id="${el.id}" cx="${a.x + a.w/2}" cy="${a.y + a.h/2}" r="${Math.min(a.w, a.h)/2}" ${baseAttrs}/>`
    case 'ellipse':
      return `<ellipse id="${el.id}" cx="${a.x + a.w/2}" cy="${a.y + a.h/2}" rx="${a.w/2}" ry="${a.h/2}" ${baseAttrs}/>`
    case 'line':
      return `<line id="${el.id}" x1="${a.x}" y1="${a.y}" x2="${a.x+a.w}" y2="${a.y+a.h}" stroke="${stroke}" stroke-width="${el.strokeWidth || 0.5}"/>`
    case 'polygon':
      if (!el.points) return ''
      // SVG transform translate accepts unitless numbers
      return `<polygon id="${el.id}" points="${el.points}" transform="translate(${a.x}, ${a.y})" ${baseAttrs}/>`
    case 'path':
      if (!el.d) return ''
      return `<path id="${el.id}" d="${el.d}" transform="translate(${a.x}, ${a.y})" ${baseAttrs}/>`
    default:
      return ''
  }
}

function renderPhoto(el: PhotoElement, ctx: BindingContext, warnings: string[]): string {
  const a   = el.anchor
  let src   = resolveBindings(el.binding, ctx)
  if (!src && el.binding !== '{{person.photoUrl}}') {
    src = resolveBindings('{{person.photoUrl}}', ctx)
  }
  if (!src && (ctx.person as any)?.photo) {
    src = (ctx.person as any).photo
  }
  const cx  = a.x + a.w / 2
  const cy  = a.y + a.h / 2
  const r   = Math.min(a.w, a.h) / 2

  // Inline clip path for the photo shape (circle/rounded/square)
  const clipId = `photo-clip-${el.id}`
  let shapeDef = ''
  if (el.shape === 'circle') {
    shapeDef = `<circle cx="${cx}" cy="${cy}" r="${r}"/>`
  } else if (el.shape === 'rounded') {
    const rr = el.cornerRadius > 0 ? el.cornerRadius : r * 0.2
    shapeDef = `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="${rr}"/>`
  } else {
    shapeDef = `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"/>`
  }
  const clipPathDef = `<clipPath id="${clipId}">${shapeDef}</clipPath>`

  if (src && src.trim() && src !== '[No Photo]') {
    return `
    <defs>${clipPathDef}</defs>
    <image id="${el.id}" href="${src}" xlink:href="${src}" x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"
      preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    `
  }

  // Fallback: colored initials avatar
  const name     = resolveBindings(el.initialsBinding, ctx) || ctx.person?.name || 'Participant'
  const initials = getInitials(name)
  const bgColor  = resolveBindings(el.initialsBg, ctx) || ctx.role?.palette?.primary || '#2563eb'
  const fontSize = r * 0.65

  return `
  <defs>${clipPathDef}</defs>
  <g id="${el.id}" clip-path="url(#${clipId})">
    <${el.shape === 'circle'
      ? `circle cx="${cx}" cy="${cy}" r="${r}"`
      : `rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}"`} fill="${bgColor}"/>
    <text x="${cx}" y="${cy}"
      font-family="Space Grotesk, Inter, sans-serif"
      font-size="${fontSize}"
      font-weight="700"
      fill="${el.initialsColor || '#ffffff'}"
      text-anchor="middle"
      dominant-baseline="central"
    >${escapeXml(initials)}</text>
  </g>`
}

function renderQR(el: QRElement, ctx: BindingContext): string {
  const a   = el.anchor
  const url = resolveBindings(el.urlPattern, ctx) || 'https://acm.svnit.ac.in'

  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: el.errorCorrection || 'M' })
    const size = qr.modules.size
    const cellSize = a.w / size
    const paths: string[] = []

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          const x = a.x + c * cellSize
          const y = a.y + r * cellSize
          paths.push(`M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z`)
        }
      }
    }

    const bg = (el.bgColor && el.bgColor !== 'transparent')
      ? `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${el.bgColor}" rx="1"/>`
      : ''

    return `<g id="${el.id}">
      ${bg}
      <path d="${paths.join(' ')}" fill="${el.fgColor}"/>
    </g>`
  } catch (e) {
    return `<g id="${el.id}">
      <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${el.bgColor || '#ffffff'}" rx="1"/>
      <rect x="${a.x + 0.5}" y="${a.y + 0.5}" width="${a.w - 1}" height="${a.h - 1}" fill="none" stroke="${el.fgColor}" stroke-width="0.3"/>
      <text x="${a.x + a.w/2}" y="${a.y + a.h/2}" font-size="1.8" fill="${el.fgColor}" text-anchor="middle" dominant-baseline="central">QR VERIFIED</text>
    </g>`
  }
}

function renderBarcode(el: BarcodeElement, ctx: BindingContext): string {
  const a   = el.anchor
  const val = resolveBindings(el.valueBinding, ctx) || 'ID-001'
  const textH = 2.4
  const barH = Math.max(a.h - textH - 0.4, 2)
  const barCount = 36
  const unitW = (a.w - 2) / (barCount * 1.35)
  let currentX = a.x + 1
  const bars: string[] = []

  for (let i = 0; i < barCount; i++) {
    const charCode = val.charCodeAt(i % val.length) || 48
    const isThick = (charCode * 7 + i * 11) % 4 === 0
    const w = isThick ? unitW * 1.8 : unitW
    if ((i * 3 + charCode) % 7 !== 0) {
      bars.push(`<rect x="${currentX.toFixed(2)}" y="${a.y.toFixed(2)}" width="${w.toFixed(2)}" height="${barH.toFixed(2)}" fill="${el.fgColor}"/>`)
    }
    currentX += w + unitW * 0.35
    if (currentX >= a.x + a.w - 1) break
  }

  const bg = (el.bgColor && el.bgColor !== 'transparent')
    ? `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="${el.bgColor}" rx="0.8"/>`
    : ''

  return `<g id="${el.id}" shape-rendering="crispEdges">
    ${bg}
    ${bars.join('')}
    <text x="${a.x + a.w / 2}" y="${a.y + a.h - 0.3}" font-family="'Space Grotesk', monospace" font-size="1.8" font-weight="600" fill="${el.fgColor}" text-anchor="middle">${escapeXml(val)}</text>
  </g>`
}


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;')
}

export { escapeXml, getInitials }
