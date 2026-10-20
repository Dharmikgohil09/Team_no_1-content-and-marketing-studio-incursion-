import { z } from 'zod'
import { ElementSchema } from './Element'

export const CardSizeSchema = z.object({
  name:        z.string(),
  widthMm:     z.number(),
  heightMm:    z.number(),
  bleedMm:     z.number().default(3),
  safeMarginMm: z.number().default(5),
})
export type CardSize = z.infer<typeof CardSizeSchema>

export const STANDARD_SIZES: Record<string, CardSize> = {
  CR80:   { name: 'CR80 (Standard ID)', widthMm: 85.6, heightMm: 54,   bleedMm: 3, safeMarginMm: 5 },
  A6:     { name: 'A6',                 widthMm: 105,  heightMm: 148.5, bleedMm: 3, safeMarginMm: 5 },
  '100x70': { name: '100×70 mm',        widthMm: 100,  heightMm: 70,    bleedMm: 3, safeMarginMm: 5 },
}

import { ThemeSchema, BackgroundLayerSchema } from './Theme'

export const CardTemplateSchema = z.object({
  id:             z.string(),
  name:           z.string(),
  designType:     z.string().default('idCard'),
  archetype:      z.string().optional(),
  description:    z.string().optional(),
  thumbnail:      z.string().optional(),
  version:        z.number().default(1),

  size:           CardSizeSchema,
  orientation:    z.enum(['landscape','portrait']).default('landscape'),
  hasFrontBack:   z.boolean().default(false),

  /** Layers in z-order (back to front) */
  elements:       z.array(ElementSchema),
  backElements:   z.array(ElementSchema).optional(),

  /** Role-specific layer overrides: roleId -> Element[] */
  roleElements:   z.record(z.string(), z.array(ElementSchema)).optional(),
  roleBackElements: z.record(z.string(), z.array(ElementSchema)).optional(),

  /** metadata tags for registry search */
  tags:           z.array(z.string()).default([]),
  /** which roles this template supports (empty = all) */
  supportedRoles: z.array(z.string()).default([]),
  /** template-level design tokens (override brand kit) */
  tokens:         z.record(z.string(), z.string()).optional(),
  /** template theme tokens */
  theme:          ThemeSchema.optional(),
  /** separate background layer (solid, gradient, or artwork) */
  backgroundLayer: BackgroundLayerSchema.optional(),
})
export type CardTemplate = z.infer<typeof CardTemplateSchema>
