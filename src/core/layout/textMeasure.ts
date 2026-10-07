/**
 * Text measurement utilities using an off-screen SVG/canvas element.
 * All measurements in mm (converted via px→mm at screen resolution).
 */

const MM_PER_PX = 25.4 / 96 // 96 DPI screen

/** Measure text width in mm for a given font spec */
export function measureTextWidth(
  text: string,
  fontFamily: string,
  fontSize: number,   // pt
  fontWeight: string
): number {
  const canvas = getOffscreenCanvas()
  const ctx = canvas.getContext('2d')!
  const pxSize = ptToPx(fontSize)
  ctx.font = `${fontWeight} ${pxSize}px "${fontFamily}", sans-serif`
  const metrics = ctx.measureText(text)
  return metrics.width * MM_PER_PX
}

/** Convert pt to px (1pt = 1/72 in, at 96dpi: 96/72 = 1.333px/pt) */
export function ptToPx(pt: number): number {
  return pt * (96 / 72)
}

/** Convert mm to px at screen resolution */
export function mmToPx(mm: number): number {
  return mm / MM_PER_PX
}

/** Convert px to mm at screen resolution */
export function pxToMm(px: number): number {
  return px * MM_PER_PX
}

/** Convert mm to px at a specific DPI (for export) */
export function mmToPxAtDpi(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi
}

/** Estimate text line height in mm */
export function lineHeightMm(fontSize: number, leading = 1.2): number {
  return pxToMm(ptToPx(fontSize) * leading)
}

let _canvas: HTMLCanvasElement | OffscreenCanvas | null = null
function getOffscreenCanvas(): HTMLCanvasElement | OffscreenCanvas {
  if (_canvas) return _canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    _canvas = new OffscreenCanvas(1, 1)
  } else if (typeof document !== 'undefined') {
    _canvas = document.createElement('canvas')
    _canvas.width = 1
    _canvas.height = 1
  } else {
    // SSR/server: return a mock
    _canvas = { getContext: () => ({ font: '', measureText: (t: string) => ({ width: t.length * 8 }) }) } as unknown as HTMLCanvasElement
  }
  return _canvas
}
