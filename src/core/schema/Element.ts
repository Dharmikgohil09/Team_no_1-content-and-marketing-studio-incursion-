import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Anchor + Size helpers
// ─────────────────────────────────────────────────────────────────────────────

export const AnchorSchema = z.object({
  x:    z.number(),   // mm from left
  y:    z.number(),   // mm from top
  w:    z.number(),   // mm width
  h:    z.number(),   // mm height
})
export type Anchor = z.infer<typeof AnchorSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Per-element schemas
// ─────────────────────────────────────────────────────────────────────────────

export const TextElementSchema = z.object({
  type:           z.literal('text'),
  id:             z.string(),
  anchor:         AnchorSchema,
  content:        z.string(),   // may contain {{bindings}}
  fontFamily:     z.string().default('Inter'),
  fontSize:       z.number(),   // pt
  fontWeight:     z.enum(['300','400','500','600','700']).default('400'),
  color:          z.string(),   // hex
  align:          z.enum(['left','center','right']).default('left'),
  verticalAlign:  z.enum(['top','middle','bottom']).default('top'),
  maxLines:       z.number().default(1),
  minFontSize:    z.number().default(6),
  roleConditional: z.record(z.string(), z.object({
    color:      z.string().optional(),
    fontWeight: z.string().optional(),
    content:    z.string().optional(),
  })).optional(),
})
export type TextElement = z.infer<typeof TextElementSchema>

export const ImageElementSchema = z.object({
  type:       z.literal('image'),
  id:         z.string(),
  anchor:     AnchorSchema,
  src:        z.string(),            // URL or binding {{brandKit.logo.acm}}
  fit:        z.enum(['contain','cover','fill']).default('contain'),
  cornerRadius: z.number().default(0),
  opacity:    z.number().min(0).max(1).default(1),
  preserveAspectRatio: z.boolean().default(true),
  isLogo:     z.boolean().default(false),  // triggers logo-integrity validation
})
export type ImageElement = z.infer<typeof ImageElementSchema>

export const ShapeElementSchema = z.object({
  type:         z.literal('shape'),
  id:           z.string(),
  anchor:       AnchorSchema,
  shape:        z.enum(['rect','circle','ellipse','line','polygon','path']),
  fill:         z.string().default('transparent'),
  stroke:       z.string().default('transparent'),
  strokeWidth:  z.number().default(0),
  cornerRadius: z.number().default(0),
  opacity:      z.number().min(0).max(1).default(1),
  /** binding to role palette key e.g. "{{role.palette.primary}}" */
  fillBinding:  z.string().optional(),
  /** SVG polygon points (relative to anchor) */
  points:       z.string().optional(),
  /** SVG path d string (relative to anchor) */
  d:            z.string().optional(),
  roleConditional: z.record(z.string(), z.object({
    fill:   z.string().optional(),
    stroke: z.string().optional(),
    pattern: z.string().optional(),
  })).optional(),
})
export type ShapeElement = z.infer<typeof ShapeElementSchema>

export const PhotoElementSchema = z.object({
  type:          z.literal('photo'),
  id:            z.string(),
  anchor:        AnchorSchema,
  binding:       z.string().default('{{person.photoUrl}}'),
  shape:         z.enum(['circle','rounded','square']).default('circle'),
  cornerRadius:  z.number().default(0),
  fallback:      z.enum(['initials','icon','blank']).default('initials'),
  initialsBinding: z.string().default('{{person.name}}'),
  initialsColor: z.string().default('#ffffff'),
  initialsBg:    z.string().default('{{role.palette.primary}}'),
})
export type PhotoElement = z.infer<typeof PhotoElementSchema>

export const QRElementSchema = z.object({
  type:          z.literal('qr'),
  id:            z.string(),
  anchor:        AnchorSchema,
  urlPattern:    z.string().default('https://example.com/attendance?id={{person.id}}'),
  errorCorrection: z.enum(['L','M','Q','H']).default('M'),
  fgColor:       z.string().default('#000000'),
  bgColor:       z.string().default('#ffffff'),
})
export type QRElement = z.infer<typeof QRElementSchema>

export const BarcodeElementSchema = z.object({
  type:     z.literal('barcode'),
  id:       z.string(),
  anchor:   AnchorSchema,
  valueBinding: z.string().default('{{person.id}}'),
  format:   z.string().default('CODE128'),
  fgColor:  z.string().default('#000000'),
  bgColor:  z.string().default('#ffffff'),
})
export type BarcodeElement = z.infer<typeof BarcodeElementSchema>

// Union
export const ElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  PhotoElementSchema,
  QRElementSchema,
  BarcodeElementSchema,
])
export type Element = z.infer<typeof ElementSchema>
