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

/** Default role definitions for ID card events */
export const DEFAULT_ROLES: Role[] = [
  {
    id: 'participant',
    label: 'Participant',
    accentShape: 'diagonal',
    palette: { primary: '#1a35de', secondary: '#091124', accent: '#00d2ff', text: '#ffffff', pattern: 'stripe' },
  },
  {
    id: 'organizer',
    label: 'Organizer',
    accentShape: 'full',
    palette: { primary: '#0f172a', secondary: '#090b10', accent: '#f59e0b', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    accentShape: 'band',
    palette: { primary: '#6d28d9', secondary: '#14132b', accent: '#14b8a6', text: '#ffffff', pattern: 'dot' },
  },
  {
    id: 'volunteer',
    label: 'Volunteer',
    accentShape: 'ribbon',
    palette: { primary: '#059669', secondary: '#064e3b', accent: '#f59e0b', text: '#ffffff', pattern: 'cross' },
  },
  {
    id: 'judge',
    label: 'Judge',
    accentShape: 'corner',
    palette: { primary: '#1e293b', secondary: '#0f172a', accent: '#e2e8f0', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'speaker',
    label: 'Speaker',
    accentShape: 'ribbon',
    palette: { primary: '#be123c', secondary: '#2b0b18', accent: '#fbbf24', text: '#ffffff', pattern: 'solid' },
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

  // Curated palette pool for custom roles
  const CUSTOM_PALETTES: Array<{ primary: string; secondary: string; accent: string }> = [
    { primary: '#0284c7', secondary: '#082f49', accent: '#38bdf8' }, // Sky
    { primary: '#d97706', secondary: '#451a03', accent: '#fde047' }, // Amber
    { primary: '#7c3aed', secondary: '#2e1065', accent: '#c084fc' }, // Violet
    { primary: '#0d9488', secondary: '#134e4a', accent: '#2dd4bf' }, // Teal
    { primary: '#db2777', secondary: '#500724', accent: '#f472b6' }, // Pink
    { primary: '#475569', secondary: '#0f172a', accent: '#cbd5e1' }, // Slate
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

