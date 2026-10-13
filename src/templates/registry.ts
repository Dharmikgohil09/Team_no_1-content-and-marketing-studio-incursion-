import { CardTemplateSchema, type CardTemplate } from '../core/schema/CardTemplate'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../brandKits/defaultLogos'
import boldBand      from './idCard/boldBand.json'
import minimalClean  from './idCard/minimalClean.json'
import modernGradient from './idCard/modernGradient.json'

/** Template registry — all registered templates keyed by ID */
const registry = new Map<string, CardTemplate>()

function patchLogoElement(el: any): any {
  if (el.type === 'image' && (el.isLogo || el.id?.includes('logo'))) {
    if (el.id === 'svnit-logo' || el.id?.includes('svnit') || el.id?.includes('institute')) {
      return { ...el, src: DEFAULT_SVNIT_LOGO }
    }
    if (el.id === 'acm-logo' || el.id?.includes('acm') || el.id?.includes('club') || el.id?.includes('event')) {
      return { ...el, src: DEFAULT_ACM_LOGO }
    }
  }
  return el
}

function patchDefaultLogos(tpl: CardTemplate): CardTemplate {
  tpl.elements = tpl.elements.map(patchLogoElement)
  if (tpl.backElements) {
    tpl.backElements = tpl.backElements.map(patchLogoElement)
  }
  if (tpl.roleElements) {
    const patchedRole: Record<string, any[]> = {}
    for (const [rId, list] of Object.entries(tpl.roleElements)) {
      patchedRole[rId] = list.map(patchLogoElement)
    }
    tpl.roleElements = patchedRole
  }
  if (tpl.roleBackElements) {
    const patchedBack: Record<string, any[]> = {}
    for (const [rId, list] of Object.entries(tpl.roleBackElements)) {
      patchedBack[rId] = list.map(patchLogoElement)
    }
    tpl.roleBackElements = patchedBack
  }
  return tpl
}

/** Register a template (validates via Zod with automatic normalization) */
export function registerTemplate(raw: unknown): CardTemplate | undefined {
  try {
    const obj = (typeof raw === 'object' && raw !== null) ? { ...(raw as any) } : {}
    if (!obj.size) {
      obj.size = {
        name: 'CR80',
        widthMm: obj.width ?? 54,
        heightMm: obj.height ?? 85.6,
        bleedMm: 0,
        safeMarginMm: 3,
      }
    }
    if (!obj.orientation) {
      obj.orientation = obj.size.widthMm < obj.size.heightMm ? 'portrait' : 'landscape'
    }
    const parsed = CardTemplateSchema.parse(obj)
    const tpl = patchDefaultLogos(parsed)
    registry.set(tpl.id, tpl)
    return tpl
  } catch (err) {
    console.error(`Failed to register template ${(raw as any)?.id}:`, err)
    return undefined
  }
}

/** Get a template by ID */
export function getTemplate(id: string): CardTemplate | undefined {
  return registry.get(id)
}

/** List all templates, optionally filtered by designType */
export function listTemplates(designType?: string): CardTemplate[] {
  const all = Array.from(registry.values())
  if (!designType) return all
  return all.filter(t => t.designType === designType)
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-register built-in templates
// ─────────────────────────────────────────────────────────────────────────────

registerTemplate(boldBand)
registerTemplate(minimalClean)
registerTemplate(modernGradient)

export { registry }
