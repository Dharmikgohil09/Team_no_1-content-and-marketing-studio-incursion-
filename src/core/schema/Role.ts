import { z } from 'zod'

export const BUILT_IN_ROLES = ['participant', 'organizer', 'mentor', 'volunteer', 'speaker'] as const
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
    accentShape: 'band',
    palette: { primary: '#1a35de', secondary: '#8eb8ff', accent: '#5f90ff', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'organizer',
    label: 'Organizer',
    accentShape: 'band',
    palette: { primary: '#7c3aed', secondary: '#c4b5fd', accent: '#a78bfa', text: '#ffffff', pattern: 'stripe' },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    accentShape: 'band',
    palette: { primary: '#065f46', secondary: '#6ee7b7', accent: '#34d399', text: '#ffffff', pattern: 'dot' },
  },
  {
    id: 'volunteer',
    label: 'Volunteer',
    accentShape: 'band',
    palette: { primary: '#b45309', secondary: '#fcd34d', accent: '#f59e0b', text: '#ffffff', pattern: 'cross' },
  },
  {
    id: 'speaker',
    label: 'Speaker',
    accentShape: 'ribbon',
    palette: { primary: '#be123c', secondary: '#fda4af', accent: '#fb7185', text: '#ffffff', pattern: 'solid' },
  },
]
