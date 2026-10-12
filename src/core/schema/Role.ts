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
    palette: { primary: '#2563eb', secondary: '#dbeafe', accent: '#3b82f6', text: '#ffffff', pattern: 'solid' },
  },
  {
    id: 'organizer',
    label: 'Organizer',
    accentShape: 'band',
    palette: { primary: '#7c3aed', secondary: '#ede9fe', accent: '#a78bfa', text: '#ffffff', pattern: 'stripe' },
  },
  {
    id: 'mentor',
    label: 'Mentor',
    accentShape: 'band',
    palette: { primary: '#059669', secondary: '#d1fae5', accent: '#10b981', text: '#ffffff', pattern: 'dot' },
  },
  {
    id: 'volunteer',
    label: 'Volunteer',
    accentShape: 'band',
    palette: { primary: '#d97706', secondary: '#fef3c7', accent: '#f59e0b', text: '#ffffff', pattern: 'cross' },
  },
  {
    id: 'speaker',
    label: 'Speaker',
    accentShape: 'ribbon',
    palette: { primary: '#e11d48', secondary: '#ffe4e6', accent: '#fb7185', text: '#ffffff', pattern: 'solid' },
  },
]
