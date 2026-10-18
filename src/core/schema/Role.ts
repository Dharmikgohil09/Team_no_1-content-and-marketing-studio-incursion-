import { z } from 'zod'

export const BUILT_IN_ROLES = ['participant', 'organizer', 'mentor', 'volunteer', 'judge', 'speaker'] as const
export type BuiltInRole = typeof BUILT_IN_ROLES[number]

export const RoleColorPaletteSchema = z.object({
  primary:    z.string(), // hex
  secondary:  z.string(), // hex
  accent:     z.string(), // hex
  text:       z.string(), // hex — text on primary bg
  /** Grayscale-distinguishable pattern: 'solid' | 'stripe' | 'dot' | 'cross' */
  pattern:    z.enum(['solid', 'stripe', 'dot', 'cross']).default('solid'),
})
export type RoleColorPalette = z.infer<typeof RoleColorPaletteSchema>

export const RoleSchema = z.object({
  id:          z.string(),
  label:       z.string(),          // display label e.g. "Participant"
  accentShape: z.enum(['band', 'ribbon', 'diagonal', 'corner', 'full']).default('band'),
  palette:     RoleColorPaletteSchema,
  count:       z.number().optional(),
})
export type Role = z.infer<typeof RoleSchema>

/** Default role definitions for ID card events matching editorial design tokens */
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'participant',
    label: 'Participant',
    accentShape: 'diagonal',
    palette: { primary: '#0F5C4D', secondary: '#14201C', accent: '#D9D5C7', text: '#ffffff', pattern: 'stripe' },
  },
  {
    id: 'organizer',
    label: 'Organizer',
    accentShape: 'full',
    palette: { primary: '#14201C', secondary: '#1E2B26', accent: '#0F5C4D', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    accentShape: 'band',
    palette: { primary: '#8B5E3C', secondary: '#3D2817', accent: '#E9E5D8', text: '#ffffff', pattern: 'dot' },
  },
  {
    id: 'volunteer',
    label: 'Volunteer',
    accentShape: 'ribbon',
    palette: { primary: '#2E5A44', secondary: '#193326', accent: '#D9D5C7', text: '#ffffff', pattern: 'cross' },
  },
  {
    id: 'judge',
    label: 'Judge',
    accentShape: 'corner',
    palette: { primary: '#3B4842', secondary: '#202824', accent: '#C4BFAE', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'speaker',
    label: 'Speaker',
    accentShape: 'ribbon',
    palette: { primary: '#7B3833', secondary: '#3E1C1A', accent: '#E9E5D8', text: '#ffffff', pattern: 'solid' },
  },
]

/**
 * Return a complete Role object for any role ID or custom name.
 * Generates an intelligent, harmonious palette for custom roles.
 */
export function getRoleOrDefault(roleIdOrLabel: string, existingRoles?: Role[]): Role {
  const norm = roleIdOrLabel.toLowerCase().trim()
  // Check in existing project roles
  if (existingRoles) {
    const found = existingRoles.find(r => r.id.toLowerCase() === norm || r.label.toLowerCase() === norm)
    if (found) return found
  }
  // Check in default built-in roles
  const builtIn = DEFAULT_ROLES.find(r => r.id === norm || r.label.toLowerCase() === norm)
  if (builtIn) return builtIn

  // Curated palette pool for custom roles aligned with the editorial theme
  const CUSTOM_PALETTES: Array<{ primary: string; secondary: string; accent: string }> = [
    { primary: '#0F5C4D', secondary: '#14201C', accent: '#84A98C' }, // Forest Green
    { primary: '#14201C', secondary: '#1E2B26', accent: '#D9D5C7' }, // Deep Ink
    { primary: '#8B5E3C', secondary: '#3D2817', accent: '#E9E5D8' }, // Warm Sienna
    { primary: '#2E5A44', secondary: '#193326', accent: '#C4BFAE' }, // Sage
    { primary: '#7B3833', secondary: '#3E1C1A', accent: '#E9E5D8' }, // Earth Crimson
    { primary: '#3B4842', secondary: '#202824', accent: '#D9D5C7' }, // Slate
  ]
  let hash = 0
  for (let i = 0; i < norm.length; i++) hash = (hash * 31 + norm.charCodeAt(i)) & 0xffff
  const pal = CUSTOM_PALETTES[Math.abs(hash) % CUSTOM_PALETTES.length]
  const label = roleIdOrLabel.charAt(0).toUpperCase() + roleIdOrLabel.slice(1)

  return {
    id: norm.replace(/\s+/g, '-'),
    label,
    accentShape: 'band',
    palette: {
      primary: pal.primary,
      secondary: pal.secondary,
      accent: pal.accent,
      text: '#ffffff',
      pattern: 'solid',
    },
  }
}

