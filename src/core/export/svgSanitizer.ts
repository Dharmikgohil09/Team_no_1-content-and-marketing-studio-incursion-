import { DEFAULT_ACM_LOGO, DEFAULT_SVNIT_LOGO } from '../../brandKits/defaultLogos'

/**
 * Sanitizes an SVG string before converting to Canvas/PNG or embedding in PDF.
 * 
 * Browsers forbid external network requests inside SVGs rendered into <img> or <canvas>,
 * which causes @import or relative /assets/... paths to trigger img.onerror and fail.
 */
export function sanitizeSvgForExport(svgString: string): string {
  let clean = svgString

  // 1. Strip external @import url(...) font rules from <style> blocks
  clean = clean.replace(/@import\s+url\([^)]+\);?/gi, '')

  // 2. Inline standard default logos if relative paths are referenced
  clean = clean.replace(/href=["'](?:\/?assets\/acm-logo\.svg|acm-logo\.svg)["']/gi, `href="${DEFAULT_ACM_LOGO}"`)
  clean = clean.replace(/href=["'](?:\/?assets\/svnit-logo\.svg|svnit-logo\.svg)["']/gi, `href="${DEFAULT_SVNIT_LOGO}"`)
  clean = clean.replace(/xlink:href=["'](?:\/?assets\/acm-logo\.svg|acm-logo\.svg)["']/gi, `xlink:href="${DEFAULT_ACM_LOGO}"`)
  clean = clean.replace(/xlink:href=["'](?:\/?assets\/svnit-logo\.svg|svnit-logo\.svg)["']/gi, `xlink:href="${DEFAULT_SVNIT_LOGO}"`)

  // 3. Resolve any other local /assets/... images if running in browser
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    clean = clean.replace(/href=["'](\/assets\/[^"']+)["']/g, (m, path) => `href="${origin}${path}"`)
    clean = clean.replace(/xlink:href=["'](\/assets\/[^"']+)["']/g, (m, path) => `xlink:href="${origin}${path}"`)
  }

  return clean
}
