import type { CardTemplate } from '../schema/CardTemplate'
import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import { listTemplates } from '../../templates/registry'

/**
 * Generate 2-3 draft templates by taking built-in templates
 * and customizing them with event context data.
 * 
 * In "no-LLM" mode: returns the 3 built-in templates with event data patched in.
 * With LLM: sends a request to generate template JSON patches.
 */
export async function generateDrafts(
  event: EventContext,
  roles: Role[]
): Promise<CardTemplate[]> {
  try {
    const res = await fetch('/api/llm/generate-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, roles }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as CardTemplate[]
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty drafts')
    return data
  } catch {
    return generateDraftsDeterministic(event, roles)
  }
}

/** Return built-in templates as drafts (no LLM needed) */
export function generateDraftsDeterministic(
  _event: EventContext,
  _roles: Role[]
): CardTemplate[] {
  return listTemplates('idCard')
}

/**
 * Apply a natural-language refinement instruction to a template.
 * Returns a patched template.
 */
export async function applyNlRefinement(
  template: CardTemplate,
  instruction: string
): Promise<CardTemplate> {
  try {
    const res = await fetch('/api/llm/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, instruction }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const patched = await res.json() as CardTemplate
    return patched
  } catch {
    // Deterministic fallbacks for common commands
    return applyDeterministicRefinement(template, instruction)
  }
}

function applyDeterministicRefinement(template: CardTemplate, instruction: string): CardTemplate {
  const lower = instruction.toLowerCase()

  if (/dark(?:er)?\s+theme/.test(lower) || /dark mode/.test(lower)) {
    return makeThemeDark(template)
  }
  if (/light(?:er)?\s+theme/.test(lower) || /white/.test(lower)) {
    return makeThemeLight(template)
  }
  if (/more minimal/.test(lower) || /minimal/.test(lower)) {
    return template // Return as-is; minimal template already selected
  }

  return template
}

function makeThemeDark(template: CardTemplate): CardTemplate {
  const elements = template.elements.map(el => {
    if (el.type === 'shape' && el.id === 'bg') {
      return { ...el, fill: '#0f111a' }
    }
    if (el.type === 'text' && el.color === '#0f172a') {
      return { ...el, color: '#f8fafc' }
    }
    return el
  })
  return { ...template, elements }
}

function makeThemeLight(template: CardTemplate): CardTemplate {
  const elements = template.elements.map(el => {
    if (el.type === 'shape' && el.id === 'bg-dark') {
      return { ...el, fill: '#f8fafc' }
    }
    return el
  })
  return { ...template, elements }
}
