import type { Theme } from '../schema/Theme'

/** Minimum hue distance between draft palettes (in degrees, 0..180) */
export const MIN_HUE_DISTANCE = 40

/** Keyword to base hue (0..359) mapping */
export const KEYWORD_HUE_MAP: Record<string, number> = {
  // Cultural, dance, festive
  dance: 330,
  garba: 340,
  dandiya: 345,
  cultural: 325,
  festive: 335,
  traditional: 35,
  playful: 340,
  college: 310,
  fest: 320,

  // Corporate, business, summit
  corporate: 215,
  business: 220,
  summit: 40,
  executive: 225,
  conference: 210,
  workshop: 205,
  formal: 215,

  // Tech, hackathon, robotics
  hackathon: 165,
  coding: 160,
  tech: 175,
  cyber: 185,
  robotics: 195,
  gaming: 280,
  esports: 285,

  // Music & performance
  music: 270,
  concert: 275,
  singing: 265,
  band: 260,

  // Sports & kinetic
  sports: 25,
  marathon: 20,
  cricket: 110,
  football: 135,
  athletic: 15,

  // Startup & VC
  startup: 155,
  pitch: 150,
  investor: 45,
}

export const DEFAULT_BASE_HUE = 165

/** Convert hex color to RGB (0..255) */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return { r, g, b }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return { r, g, b }
  }
  return null
}

/** Convert RGB to Hex */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** Convert HSL to Hex */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0

  if (h < 60) {
    r = c; g = x; b = 0
  } else if (h < 120) {
    r = x; g = c; b = 0
  } else if (h < 180) {
    r = 0; g = c; b = x
  } else if (h < 240) {
    r = 0; g = x; b = c
  } else if (h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

/** Convert Hex to HSL */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex)
  if (!rgb) return { h: DEFAULT_BASE_HUE, s: 70, l: 30 }

  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0

  if (d === 0) {
    h = 0
  } else if (max === r) {
    h = ((g - b) / d) % 6
  } else if (max === g) {
    h = (b - r) / d + 2
  } else {
    h = (r - g) / d + 4
  }

  h = Math.round(h * 60)
  if (h < 0) h += 360

  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  return { h, s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** Calculate circular hue distance between two hex colors or hues (0..180) */
export function getHueDistance(c1: string | number, c2: string | number): number {
  const h1 = typeof c1 === 'number' ? c1 : hexToHsl(c1).h
  const h2 = typeof c2 === 'number' ? c2 : hexToHsl(c2).h
  const diff = Math.abs(h1 - h2)
  return Math.min(diff, 360 - diff)
}

/** Calculate WCAG relative luminance */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const srgb = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(v =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
}

/** Calculate WCAG contrast ratio (1..21) */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex)
  const l2 = getRelativeLuminance(backgroundHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Check if contrast passes required ratio */
export function passesWcag(fg: string, bg: string, minRatio = 4.5): boolean {
  return getContrastRatio(fg, bg) >= minRatio
}

/** Extract base hue from event description or brand kit */
export function extractBaseHue(text: string, brandPrimaryHex?: string): number {
  if (brandPrimaryHex && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brandPrimaryHex)) {
    const hsl = hexToHsl(brandPrimaryHex)
    if (hsl.s > 10) return hsl.h
  }

  const lower = text.toLowerCase()
  for (const [kw, hue] of Object.entries(KEYWORD_HUE_MAP)) {
    if (lower.includes(kw)) {
      return hue
    }
  }

  return DEFAULT_BASE_HUE
}

/** Generate a harmonious, WCAG-compliant Theme from a base hue */
export function generateThemeFromHue(
  baseHue: number,
  harmony: 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'monochrome',
  darkTheme = false
): Theme {
  let primaryHue = baseHue
  let secondaryHue = baseHue
  let accentHue = baseHue

  switch (harmony) {
    case 'analogous':
      primaryHue = baseHue
      accentHue = (baseHue + 35) % 360
      secondaryHue = (baseHue + 330) % 360
      break
    case 'complementary':
      primaryHue = baseHue
      accentHue = (baseHue + 180) % 360
      secondaryHue = (baseHue + 20) % 360
      break
    case 'triadic':
      primaryHue = baseHue
      accentHue = (baseHue + 120) % 360
      secondaryHue = (baseHue + 240) % 360
      break
    case 'split-complementary':
      primaryHue = baseHue
      accentHue = (baseHue + 150) % 360
      secondaryHue = (baseHue + 210) % 360
      break
    case 'monochrome':
    default:
      primaryHue = baseHue
      accentHue = baseHue
      secondaryHue = baseHue
      break
  }

  if (darkTheme) {
    const background = hslToHex(secondaryHue, 25, 8)
    const surface = hslToHex(secondaryHue, 20, 14)
    const primary = hslToHex(primaryHue, 75, 45)
    const secondary = hslToHex(secondaryHue, 30, 10)
    const accent = hslToHex(accentHue, 80, 50)
    const text = hslToHex(baseHue, 10, 96)
    const mutedText = hslToHex(baseHue, 15, 70)
    const onAccent = '#FFFFFF'
    return { background, surface, primary, secondary, accent, text, mutedText, onAccent }
  } else {
    const background = hslToHex(baseHue, 15, 97)
    const surface = '#FFFFFF'
    const primary = hslToHex(primaryHue, 70, 25)
    const secondary = hslToHex(secondaryHue, 35, 12)
    const accent = hslToHex(accentHue, 75, 32)
    const text = hslToHex(secondaryHue, 30, 10)
    const mutedText = hslToHex(secondaryHue, 12, 42)
    const onAccent = '#FFFFFF'
    return { background, surface, primary, secondary, accent, text, mutedText, onAccent }
  }
}
