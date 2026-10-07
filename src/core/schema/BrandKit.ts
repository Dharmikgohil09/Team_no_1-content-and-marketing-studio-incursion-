import { z } from 'zod'

export const LogoAssetSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  svgUrl:      z.string(),
  pngUrl:      z.string().optional(),
  aspectRatio: z.number(),     // width/height ratio — LOCKED
  clearSpaceMm: z.number().default(2),
  minWidthMm:  z.number().default(10),
})
export type LogoAsset = z.infer<typeof LogoAssetSchema>

export const FontTokenSchema = z.object({
  family:    z.string(),
  weights:   z.array(z.number()),
  url:       z.string().optional(),  // Google Fonts or bundled
})

export const ColorTokenSchema = z.record(z.string(), z.string()) // name -> hex

export const BrandKitSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  version:     z.number().default(1),
  logos:       z.record(z.string(), LogoAssetSchema),
  colors:      ColorTokenSchema,
  fonts:       z.record(z.string(), FontTokenSchema),
  /** forbidden recoloring: if true, logo colors must never be changed */
  strictLogoColors: z.boolean().default(true),
})
export type BrandKit = z.infer<typeof BrandKitSchema>
