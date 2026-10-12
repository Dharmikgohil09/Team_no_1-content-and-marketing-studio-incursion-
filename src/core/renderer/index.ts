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
  brandKit:    BrandKit
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
  const { template, role, person, event, brandKit, face, includeBleed } = opts
  const warnings: string[] = []

  const size   = template.size
  let w        = opts.widthMm  ?? (template.orientation === 'portrait' ? size.heightMm : size.widthMm)
  let h        = opts.heightMm ?? (template.orientation === 'portrait' ? size.widthMm  : size.heightMm)
  const bleed  = includeBleed ? size.bleedMm : 0

  const totalW = w + bleed * 2
  const totalH = h + bleed * 2

  const ctx: BindingContext = { event, role, person, brandKit }
  const elements = face === 'front' ? template.elements : (template.backElements ?? [])

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
  const cardW = w ?? (template.orientation === 'portrait' ? template.size.heightMm : template.size.widthMm)
  const cardH = h ?? (template.orientation === 'portrait' ? template.size.widthMm : template.size.heightMm)

  const allElements = [...template.elements, ...(template.backElements ?? [])]

  // Clip paths for image/photo elements
  const elemClipPaths = allElements
    .filter(el => el.type === 'image' || el.type === 'photo')
    .map(el => {
      const rx = (el as any).cornerRadius ?? 0
      const a  = el.anchor
      return `<clipPath id="el-clip-${el.id}">
        <rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" rx="${rx}mm" ry="${rx}mm" />
      </clipPath>`
    })
    .join('\n')

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&amp;family=Space+Grotesk:wght@400;500;600;700&amp;display=swap');
      text { font-family: 'Space Grotesk', 'Inter', -apple-system, sans-serif; }
    </style>
    <clipPath id="card-clip-${template.id}">
      <rect x="0" y="0" width="${cardW}mm" height="${cardH}mm"/>
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="rgba(0,0,0,0.4)"/>
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

  // Auto-fit
  const fit = autoFitText({
    text:        content || '—',
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

  const pxSize = fit.fontSize * (96 / 72)  // pt to px (SVG px = 1/96 in)
  // In SVG with mm viewBox, 1pt = 25.4/72 mm
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
    `<tspan x="${xPos}mm" dy="${i === 0 ? 0 : lineHeightMm}mm" xml:space="preserve">${escapeXml(line)}</tspan>`
  ).join('')

  return `<text
    id="${el.id}"
    x="${xPos}mm" y="${startY}mm"
    font-family="${el.fontFamily}, 'Space Grotesk', 'Inter', sans-serif"
    font-size="${fontSizeMm}mm"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="${textAnchor}"
    dominant-baseline="auto"
  >${tspans}</text>`
}

function renderImage(el: ImageElement, ctx: BindingContext, warnings: string[]): string {
  const a    = el.anchor
  const src  = resolveBindings(el.src, ctx)
  // Always clip to element bounds
  const clip = `clip-path="url(#el-clip-${el.id})"`

  const preserveAR = el.preserveAspectRatio
    ? el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'
    : 'none'

  if (!src) {
    const rx = el.cornerRadius > 0 ? el.cornerRadius : 2
    const cx = a.x + a.w / 2
    const headR = a.w * 0.22
    const headCy = a.y + a.h * 0.38
    return `<g id="${el.id}" ${clip}>
      <rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" rx="${rx}mm" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3"/>
      <!-- Silhouette Head -->
      <circle cx="${cx}mm" cy="${headCy}mm" r="${headR}mm" fill="#94a3b8"/>
      <!-- Silhouette Shoulders -->
      <path d="M ${a.x + a.w * 0.16} ${a.y + a.h} A ${a.w * 0.4} ${a.h * 0.35} 0 0 1 ${a.x + a.w * 0.84} ${a.y + a.h} Z" fill="#94a3b8"/>
    </g>`
  }

  return `<image
    id="${el.id}"
    href="${src}"
    xlink:href="${src}"
    x="${a.x}mm" y="${a.y}mm"
    width="${a.w}mm" height="${a.h}mm"
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
    fill = resolveBindings(el.fillBinding, ctx) || fill
  }

  // Role-conditional overrides
  const roleOverride = el.roleConditional?.[ctx.role.id]
  if (roleOverride?.fill)   fill   = roleOverride.fill
  if (roleOverride?.stroke) stroke = roleOverride.stroke

  const baseAttrs = `fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}mm" opacity="${el.opacity}"`

  switch (el.shape) {
    case 'rect':
      return `<rect id="${el.id}" x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" rx="${el.cornerRadius}mm" ${baseAttrs}/>`
    case 'circle':
      return `<circle id="${el.id}" cx="${a.x + a.w/2}mm" cy="${a.y + a.h/2}mm" r="${Math.min(a.w, a.h)/2}mm" ${baseAttrs}/>`
    case 'ellipse':
      return `<ellipse id="${el.id}" cx="${a.x + a.w/2}mm" cy="${a.y + a.h/2}mm" rx="${a.w/2}mm" ry="${a.h/2}mm" ${baseAttrs}/>`
    case 'line':
      return `<line id="${el.id}" x1="${a.x}mm" y1="${a.y}mm" x2="${a.x+a.w}mm" y2="${a.y+a.h}mm" stroke="${stroke}" stroke-width="${el.strokeWidth}mm"/>`
    case 'polygon':
      if (!el.points) return ''
      return `<polygon id="${el.id}" points="${el.points}" transform="translate(${a.x}mm, ${a.y}mm)" ${baseAttrs}/>`
    default:
      return ''
  }
}

function renderPhoto(el: PhotoElement, ctx: BindingContext, warnings: string[]): string {
  const a   = el.anchor
  const src = resolveBindings(el.binding, ctx)
  const cx  = a.x + a.w / 2
  const cy  = a.y + a.h / 2
  const r   = Math.min(a.w, a.h) / 2

  // Inline clip path for the photo shape (circle/rounded/square)
  const clipId = `photo-clip-${el.id}`
  let shapeDef = ''
  if (el.shape === 'circle') {
    shapeDef = `<circle cx="${cx}mm" cy="${cy}mm" r="${r}mm"/>`
  } else if (el.shape === 'rounded') {
    const rr = el.cornerRadius > 0 ? el.cornerRadius : r * 0.2
    shapeDef = `<rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" rx="${rr}mm"/>`
  } else {
    shapeDef = `<rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm"/>`
  }
  const clipPathDef = `<clipPath id="${clipId}">${shapeDef}</clipPath>`

  if (src) {
    return `
    <defs>${clipPathDef}</defs>
    <image id="${el.id}" href="${src}" x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm"
      preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    `
  }

  // Fallback: colored initials avatar
  const name     = resolveBindings(el.initialsBinding, ctx)
  const initials = getInitials(name)
  const bgColor  = resolveBindings(el.initialsBg, ctx) || ctx.role.palette.primary
  const fontSizeMm = r * 0.65

  return `
  <defs>${clipPathDef}</defs>
  <g id="${el.id}" clip-path="url(#${clipId})">
    <${el.shape === 'circle'
      ? `circle cx="${cx}mm" cy="${cy}mm" r="${r}mm"`
      : `rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm"`} fill="${bgColor}"/>
    <text x="${cx}mm" y="${cy}mm"
      font-family="Space Grotesk, Inter, sans-serif"
      font-size="${fontSizeMm}mm"
      font-weight="700"
      fill="${el.initialsColor}"
      text-anchor="middle"
      dominant-baseline="central"
    >${escapeXml(initials)}</text>
  </g>`
}

function renderQR(el: QRElement, ctx: BindingContext): string {
  const a   = el.anchor
  const url = resolveBindings(el.urlPattern, ctx)

  // Generate QR as SVG path synchronously using qrcode lib
  // We use a placeholder SVG QR pattern here; real QR is generated async
  // The async version updates via React ref
  const qrId = `qr-placeholder-${el.id}`
  
  // Simple placeholder for SSR/sync render; real QR injected via useEffect in React
  return `<g id="${el.id}">
    <rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" fill="${el.bgColor}"/>
    <text x="${a.x + a.w/2}mm" y="${a.y + a.h/2}mm" font-size="2mm" fill="${el.fgColor}" text-anchor="middle" dominant-baseline="central">QR: ${escapeXml(url.slice(-20))}</text>
    <rect x="${a.x + 0.5}mm" y="${a.y + 0.5}mm" width="${a.w - 1}mm" height="${a.h - 1}mm" fill="none" stroke="${el.fgColor}" stroke-width="0.3mm"/>
  </g>`
}

function renderBarcode(el: BarcodeElement, ctx: BindingContext): string {
  const a   = el.anchor
  const val = resolveBindings(el.valueBinding, ctx)
  // Barcode rendered via JsBarcode in React component; placeholder here
  return `<g id="${el.id}">
    <rect x="${a.x}mm" y="${a.y}mm" width="${a.w}mm" height="${a.h}mm" fill="${el.bgColor}"/>
    <text x="${a.x + a.w/2}mm" y="${a.y + a.h/2}mm" font-size="2mm" fill="${el.fgColor}" text-anchor="middle" dominant-baseline="central">${escapeXml(val)}</text>
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
