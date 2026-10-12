import { CardTemplateSchema, type CardTemplate } from '../core/schema/CardTemplate'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../brandKits/defaultLogos'
import boldBand      from './idCard/boldBand.json'
import minimalClean  from './idCard/minimalClean.json'
import modernGradient from './idCard/modernGradient.json'

/** Template registry — all registered templates keyed by ID */
const registry = new Map<string, CardTemplate>()

function patchDefaultLogos(tpl: CardTemplate): CardTemplate {
  tpl.elements = tpl.elements.map(el => {
    if (el.type === 'image' && (el as any).isLogo) {
      if (el.id === 'svnit-logo' || el.id.includes('svnit') || el.id.includes('institute')) {
        return { ...el, src: DEFAULT_SVNIT_LOGO }
      }
      if (el.id === 'acm-logo' || el.id.includes('acm') || el.id.includes('club') || el.id.includes('event')) {
        return { ...el, src: DEFAULT_ACM_LOGO }
      }
    }
    return el
  })
  return tpl
}

/** Register a template (validates via Zod) */
export function registerTemplate(raw: unknown): CardTemplate {
  const parsed = CardTemplateSchema.parse(raw)
  const tpl = patchDefaultLogos(parsed)
  registry.set(tpl.id, tpl)
  return tpl
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
