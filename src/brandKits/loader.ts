import type { BrandKit } from '../core/schema/BrandKit'
import { BrandKitSchema } from '../core/schema/BrandKit'
import acmNitSuratRaw from './acm-nit-surat.json'

const brandKitRegistry = new Map<string, BrandKit>()

export function registerBrandKit(raw: unknown): BrandKit {
  const kit = BrandKitSchema.parse(raw)
  brandKitRegistry.set(kit.id, kit)
  return kit
}

export function getBrandKit(id: string): BrandKit | undefined {
  return brandKitRegistry.get(id)
}

export function getDefaultBrandKit(): BrandKit {
  return brandKitRegistry.get('acm-nit-surat')!
}

export function listBrandKits(): BrandKit[] {
  return Array.from(brandKitRegistry.values())
}

// Auto-register default brand kit
registerBrandKit(acmNitSuratRaw)
