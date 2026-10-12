import type { BrandKit } from '../core/schema/BrandKit'
import { BrandKitSchema } from '../core/schema/BrandKit'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from './defaultLogos'
import acmNitSuratRaw from './acm-nit-surat.json'

const brandKitRegistry = new Map<string, BrandKit>()

export function registerBrandKit(raw: unknown): BrandKit {
  const kit = BrandKitSchema.parse(raw)
  if (kit.logos.svnit) kit.logos.svnit.svgUrl = DEFAULT_SVNIT_LOGO
  if (kit.logos.acm) kit.logos.acm.svgUrl = DEFAULT_ACM_LOGO
  brandKitRegistry.set(kit.id, kit)
  return kit
}

export function updateBrandKitLogo(kitId: string, logoKey: 'svnit' | 'acm', dataUrl: string): BrandKit | undefined {
  const kit = brandKitRegistry.get(kitId)
  if (kit && kit.logos[logoKey]) {
    kit.logos[logoKey].svgUrl = dataUrl
  }
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
