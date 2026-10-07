import { measureTextWidth, lineHeightMm } from './textMeasure'

export interface FitResult {
  /** final text to render (may be truncated) */
  text:        string
  /** final font size in pt */
  fontSize:    number
  /** lines after wrapping */
  lines:       string[]
  /** true if text was truncated with ellipsis */
  truncated:   boolean
  /** true if font was shrunk */
  shrunk:      boolean
  /** true if text overflows even after all strategies */
  overflow:    boolean
}

interface FitOptions {
  text:         string
  widthMm:      number
  heightMm:     number
  fontFamily:   string
  fontSize:     number    // initial pt
  fontWeight:   string
  maxLines:     number
  minFontSize:  number
  leading?:     number    // default 1.2
}

/**
 * Auto-fit text into a bounding box:
 * 1. Try at requested font size, wrapping to maxLines
 * 2. Shrink font until it fits or hits minFontSize
 * 3. Truncate with ellipsis if still overflowing
 */
export function autoFitText(opts: FitOptions): FitResult {
  const { text, widthMm, heightMm, fontFamily, fontWeight, maxLines, minFontSize } = opts
  const leading = opts.leading ?? 1.2

  let fontSize = opts.fontSize
  let shrunk   = false

  while (fontSize >= minFontSize) {
    const lines = wrapText(text, widthMm, fontFamily, fontSize, fontWeight, maxLines + 1)
    const totalHeight = lines.length * lineHeightMm(fontSize, leading)

    if (lines.length <= maxLines && totalHeight <= heightMm) {
      // Check if all lines fit horizontally
      const fits = lines.every(l => measureTextWidth(l, fontFamily, fontSize, fontWeight) <= widthMm + 0.5)
      if (fits) {
        return { text, fontSize, lines, truncated: false, shrunk, overflow: false }
      }
    }

    // Try smaller font
    if (fontSize - 0.5 >= minFontSize) {
      fontSize -= 0.5
      shrunk = true
    } else {
      break
    }
  }

  // Reached min size — wrap at minFontSize, truncate if needed
  fontSize = minFontSize
  let lines = wrapText(text, widthMm, fontFamily, fontSize, fontWeight, maxLines)
  let truncated = false

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    truncated = true
  }

  // Truncate last line with ellipsis if needed
  const lastLine = lines[lines.length - 1]
  if (truncated || measureTextWidth(lastLine, fontFamily, fontSize, fontWeight) > widthMm) {
    lines[lines.length - 1] = truncateWithEllipsis(lastLine, widthMm, fontFamily, fontSize, fontWeight)
    truncated = true
  }

  const totalHeight = lines.length * lineHeightMm(fontSize, leading)
  const overflow = totalHeight > heightMm

  return { text, fontSize, lines, truncated, shrunk: true, overflow }
}

/** Wrap text into lines fitting widthMm, up to maxLines */
function wrapText(
  text: string,
  widthMm: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  maxLines: number
): string[] {
  const words  = text.split(' ')
  const lines: string[] = []
  let current  = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (measureTextWidth(test, fontFamily, fontSize, fontWeight) <= widthMm) {
      current = test
    } else {
      if (current) lines.push(current)
      if (lines.length >= maxLines) break
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Truncate text until it fits with '…' appended */
function truncateWithEllipsis(
  text: string,
  widthMm: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: string
): string {
  const ellipsis = '…'
  let truncated = text
  while (truncated.length > 0) {
    const candidate = truncated + ellipsis
    if (measureTextWidth(candidate, fontFamily, fontSize, fontWeight) <= widthMm) {
      return candidate
    }
    truncated = truncated.slice(0, -1).trimEnd()
  }
  return ellipsis
}
