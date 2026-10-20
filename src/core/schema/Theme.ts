import { z } from 'zod'

export const ThemeSchema = z.object({
  background: z.string(),
  surface: z.string(),
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  text: z.string(),
  mutedText: z.string(),
  onAccent: z.string(),
})

export type Theme = z.infer<typeof ThemeSchema>

export const BackgroundLayerSchema = z.object({
  type: z.enum(['solid', 'gradient', 'artwork']),
  color: z.string().optional(),
  gradient: z.string().optional(),
  imageUrl: z.string().optional(),
  opacity: z.number().default(1),
})

export type BackgroundLayer = z.infer<typeof BackgroundLayerSchema>

export const DEFAULT_THEME: Theme = {
  background: '#FAF8F4',
  surface: '#ffffff',
  primary: '#0F5C4D',
  secondary: '#14201C',
  accent: '#0F5C4D',
  text: '#14201C',
  mutedText: '#66706A',
  onAccent: '#ffffff',
}
