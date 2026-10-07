import type { CardTemplate } from '../schema/CardTemplate'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { EventContext } from '../schema/EventContext'
import type { BrandKit } from '../schema/BrandKit'
import type { BindingContext } from '../renderer/bindings'
import { findUnresolvedBindings } from '../renderer/bindings'
import { autoFitText } from '../layout/autoFit'

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id:       string
  severity: ValidationSeverity
  element:  string   // element ID or 'template'
  message:  string
  detail?:  string
}

export interface ValidationReport {
  passed:   boolean   // false if any error
  issues:   ValidationIssue[]
  checkedAt: string
}

export function runValidation(
  template: CardTemplate,
  role: Role,
  person: Person,
  event: EventContext,
  brandKit: BrandKit
): ValidationReport {
  const ctx: BindingContext = { event, role, person, brandKit }
  const issues: ValidationIssue[] = []

  const size = template.size
  const w    = template.orientation === 'portrait' ? size.heightMm : size.widthMm
  const h    = template.orientation === 'portrait' ? size.widthMm  : size.heightMm

  // 1. Check for unresolved bindings
  for (const el of template.elements) {
    let textToCheck = ''
    if (el.type === 'text')    textToCheck = el.content
    if (el.type === 'photo')   textToCheck = el.binding
    if (el.type === 'qr')      textToCheck = el.urlPattern
    if (el.type === 'barcode') textToCheck = el.valueBinding

    if (textToCheck) {
      const unresolved = findUnresolvedBindings(textToCheck, ctx)
      unresolved.forEach(path => {
        issues.push({
          id: `unresolved-${el.id}-${path}`,
          severity: 'warning',
          element: el.id,
          message: `Unresolved binding: {{${path}}}`,
          detail: 'This field has no value in the current context.'
        })
      })
    }
  }

  // 2. Text overflow & min font size
  for (const el of template.elements) {
    if (el.type !== 'text') continue
    const fit = autoFitText({
      text:        el.content,
      widthMm:     el.anchor.w,
      heightMm:    el.anchor.h,
      fontFamily:  el.fontFamily,
      fontSize:    el.fontSize,
      fontWeight:  el.fontWeight,
      maxLines:    el.maxLines,
      minFontSize: el.minFontSize,
    })
    if (fit.overflow) {
      issues.push({
        id: `overflow-${el.id}`,
        severity: 'error',
        element: el.id,
        message: `Text overflows its bounding box in element "${el.id}"`,
        detail: `Text: "${el.content.slice(0, 40)}..."`
      })
    }
    if (fit.fontSize < 6) {
      issues.push({
        id: `minfont-${el.id}`,
        severity: 'error',
        element: el.id,
        message: `Font size below minimum (6pt) in element "${el.id}"`,
        detail: `Computed size: ${fit.fontSize.toFixed(1)}pt`
      })
    }
  }

  // 3. Safe-margin violations (elements outside safe area)
  const safeM = size.safeMarginMm
  for (const el of template.elements) {
    const a = el.anchor
    if (a.x < safeM || a.y < safeM || (a.x + a.w) > (w - safeM) || (a.y + a.h) > (h - safeM)) {
      // Only warn for text and important elements
      if (el.type === 'text' || el.type === 'photo' || el.type === 'qr') {
        issues.push({
          id: `safemargin-${el.id}`,
          severity: 'warning',
          element: el.id,
          message: `Element "${el.id}" is within the safe margin (${safeM}mm from edge)`,
          detail: 'Content too close to the edge may be cut during printing.'
        })
      }
    }
  }

  // 4. Logo integrity — must be present if template references them
  const logoElements = template.elements.filter(el => el.type === 'image' && (el as any).isLogo)
  if (logoElements.length < 2) {
    issues.push({
      id: 'logo-count',
      severity: 'error',
      element: 'template',
      message: 'Template must include both ACM and SVNIT logos',
      detail: 'Required: acm-logo and svnit-logo elements.'
    })
  }

  // 5. Out-of-bounds elements
  for (const el of template.elements) {
    const a = el.anchor
    if (a.x < -size.bleedMm || a.y < -size.bleedMm || (a.x + a.w) > (w + size.bleedMm) || (a.y + a.h) > (h + size.bleedMm)) {
      issues.push({
        id: `oob-${el.id}`,
        severity: 'error',
        element: el.id,
        message: `Element "${el.id}" is outside the bleed area`,
        detail: `Anchor: x=${a.x} y=${a.y} w=${a.w} h=${a.h}`
      })
    }
  }

  // 6. Color contrast check (simplified WCAG relative luminance)
  for (const el of template.elements) {
    if (el.type !== 'text') continue
    const fg = el.color
    // Find background element at same position (simplified: check role palette)
    const bg = role.palette.primary
    const contrast = getContrastRatio(fg, bg)
    if (contrast < 3.0) {
      issues.push({
        id: `contrast-${el.id}`,
        severity: 'warning',
        element: el.id,
        message: `Low contrast ratio (${contrast.toFixed(1)}:1) for text element "${el.id}"`,
        detail: 'WCAG recommends at least 4.5:1 for normal text.'
      })
    }
  }

  const passed = !issues.some(i => i.severity === 'error')
  return { passed, issues, checkedAt: new Date().toISOString() }
}

/** Calculate WCAG contrast ratio between two hex colors */
function getContrastRatio(hex1: string, hex2: string): number {
  const L1 = getRelativeLuminance(hex1)
  const L2 = getRelativeLuminance(hex2)
  const lighter = Math.max(L1, L2)
  const darker  = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}
