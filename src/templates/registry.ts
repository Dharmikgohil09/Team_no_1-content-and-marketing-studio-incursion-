import { CardTemplateSchema, type CardTemplate } from '../core/schema/CardTemplate'
import boldBand      from './idCard/boldBand.json'
import minimalClean  from './idCard/minimalClean.json'
import modernGradient from './idCard/modernGradient.json'

/** Template registry — all registered templates keyed by ID */
const registry = new Map<string, CardTemplate>()

/** Register a template (validates via Zod) */
export function registerTemplate(raw: unknown): CardTemplate {
  const tpl = CardTemplateSchema.parse(raw)
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
