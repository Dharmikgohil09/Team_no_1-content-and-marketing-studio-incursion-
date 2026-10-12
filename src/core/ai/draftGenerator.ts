import type { CardTemplate } from '../schema/CardTemplate'
import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import { listTemplates } from '../../templates/registry'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../../brandKits/defaultLogos'

/**
 * Generate 3 draft templates customized based on the user's event description,
 * missing questions answered, and role definitions.
 */
export async function generateDrafts(
  event: EventContext,
  roles: Role[],
  logos?: { instituteLogo?: string; clubLogo?: string }
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
    return generateDraftsDeterministic(event, roles, logos)
  }
}

/** Pre-defined role color palettes for dynamic assignment */
const ROLE_COLOR_PALETTES = [
  { stroke: '#2563eb', color: '#60a5fa', fill: '#2563eb' }, // Royal Blue (Participant)
  { stroke: '#7c3aed', color: '#c084fc', fill: '#7c3aed' }, // Electric Violet (Organizer)
  { stroke: '#059669', color: '#34d399', fill: '#059669' }, // Emerald (Mentor)
  { stroke: '#d97706', color: '#fbbf24', fill: '#d97706' }, // Amber (Volunteer)
  { stroke: '#e11d48', color: '#fb7185', fill: '#e11d48' }, // Rose (Speaker)
  { stroke: '#0891b2', color: '#38bdf8', fill: '#0891b2' }, // Cyan
]

/**
 * Infer event theme styles based on keywords in event name, tagline, or description.
 */
function deriveEventTheme(event: EventContext) {
  const text = `${event.name.value || ''} ${event.tagline.value || ''} ${event.organizer.value || ''}`.toLowerCase()

  if (/hackathon|code|dev|tech|cyber|ai|data|web3|incursion|build/i.test(text)) {
    return {
      type: 'tech',
      primary: '#3b82f6',
      accent: '#8b5cf6',
      bgDark: '#090d16',
      textHeader: '#e0e7ff',
      tag: 'Cyber Tech',
    }
  }
  if (/design|art|creative|ui|ux|workshop|photo|media/i.test(text)) {
    return {
      type: 'creative',
      primary: '#f43f5e',
      accent: '#fb923c',
      bgDark: '#111827',
      textHeader: '#ffe4e6',
      tag: 'Creative Studio',
    }
  }
  if (/conference|summit|lead|leadership|forum|business|corporate|exec/i.test(text)) {
    return {
      type: 'corporate',
      primary: '#0284c7',
      accent: '#eab308',
      bgDark: '#020617',
      textHeader: '#f0f9ff',
      tag: 'Executive Summit',
    }
  }
  if (/fest|cultural|music|dance|sports|annual|meetup|party/i.test(text)) {
    return {
      type: 'fest',
      primary: '#10b981',
      accent: '#f59e0b',
      bgDark: '#0f172a',
      textHeader: '#ecfdf5',
      tag: 'Festival & Event',
    }
  }

  // Default theme
  return {
    type: 'default',
    primary: '#4f46e5',
    accent: '#06b6d4',
    bgDark: '#0f111a',
    textHeader: '#e0e7ff',
    tag: 'Modern',
  }
}

/**
 * Generate 3 distinct draft templates dynamically customized
 * using the event context (name, tagline, venue, date, organizer) and roles.
 */
export function generateDraftsDeterministic(
  event: EventContext,
  roles: Role[],
  logos?: { instituteLogo?: string; clubLogo?: string }
): CardTemplate[] {
  const builtins = listTemplates('idCard')
  const theme = deriveEventTheme(event)

  const eventName = event.name.value || 'Event Name'
  const organizerName = event.organizer.value || 'Organized by ACM NIT Surat'
  const venueText = event.venue.value || ''
  const dateText = event.dateStart.value || ''
  const taglineText = event.tagline.value || ''

  // Build role conditionals mapping for shape and text elements
  const shapeStrokeConditional: Record<string, { stroke: string }> = {}
  const shapeFillConditional: Record<string, { fill: string }> = {}
  const textColorConditional: Record<string, { color: string }> = {}

  roles.forEach((r, idx) => {
    const palette = ROLE_COLOR_PALETTES[idx % ROLE_COLOR_PALETTES.length]
    shapeStrokeConditional[r.id] = { stroke: palette.stroke }
    shapeFillConditional[r.id] = { fill: palette.fill }
    textColorConditional[r.id] = { color: palette.color }
  })

  return builtins.map((template, idx) => {
    const tpl: CardTemplate = JSON.parse(JSON.stringify(template))
    tpl.supportedRoles = roles.map(r => r.id)

    // Customize Template Name & Description based on Event Context
    if (idx === 0) {
      tpl.name = `Executive Split — ${eventName}`
      tpl.description = `Dual-tone executive pass with white header, prominent circular photo, and dark credential section.`
    } else if (idx === 1) {
      tpl.name = `Tech Indigo — ${eventName}`
      tpl.description = `Futuristic tech badge with purple header, glowing avatar halo, and credential block.`
    } else {
      tpl.name = `Matte Obsidian Accent — ${eventName}`
      tpl.description = `Minimalist dark card with offset portrait frame and vibrant role color block.`
    }

    // Customize template elements
    tpl.elements = tpl.elements.map(el => {
      // Shape elements
      if (el.type === 'shape') {
        if (el.id === 'photo-ring' || el.id === 'avatar-border') {
          return { ...el, roleConditional: shapeStrokeConditional }
        }
        if (el.id === 'role-badge' || el.id === 'role-indicator' || el.id === 'role-color-block' || el.id === 'bottom-accent-band' || el.id === 'hero-band') {
          return { ...el, roleConditional: shapeFillConditional }
        }
      }

      // Text elements
      if (el.type === 'text') {
        if (el.id === 'organizer-subheading' || el.id === 'organizer-label') {
          return { ...el, content: organizerName }
        }
        if (el.id === 'event-name-header' || el.id === 'event-name' || el.id === 'event-title') {
          return { ...el, content: eventName }
        }
        if (el.id === 'event-tagline' && taglineText) {
          return { ...el, content: taglineText }
        }
        if (el.id === 'event-venue-date') {
          const combined = [venueText, dateText].filter(Boolean).join(' • ')
          if (combined) {
            return { ...el, content: combined }
          }
        }
        if (el.id === 'person-id-footer' || el.id === 'footer-id') {
          return { ...el, roleConditional: textColorConditional }
        }
      }

      // Image elements (logos)
      if (el.type === 'image' && (el as any).isLogo) {
        if (el.id === 'svnit-logo' || el.id.includes('svnit') || el.id.includes('institute')) {
          return { ...el, src: logos?.instituteLogo || DEFAULT_SVNIT_LOGO }
        }
        if (el.id === 'acm-logo' || el.id.includes('acm') || el.id.includes('club') || el.id.includes('event')) {
          return { ...el, src: logos?.clubLogo || DEFAULT_ACM_LOGO }
        }
      }

      return el
    })

    return tpl
  })
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
    return applyDeterministicRefinement(template, instruction)
  }
}

function applyDeterministicRefinement(template: CardTemplate, instruction: string): CardTemplate {
  const lower = instruction.toLowerCase()
  const elements = template.elements.map(el => {
    // Dark theme refinement
    if (/dark(?:er)?\s+theme/.test(lower) || /dark mode/.test(lower)) {
      if (el.type === 'shape' && (el.id === 'bg' || el.id === 'bg-dark')) {
        return { ...el, fill: '#0a0d14' }
      }
      if (el.type === 'text' && el.color === '#0f172a') {
        return { ...el, color: '#f8fafc' }
      }
    }
    // Light theme refinement
    if (/light(?:er)?\s+theme/.test(lower) || /white/.test(lower)) {
      if (el.type === 'shape' && (el.id === 'bg' || el.id === 'bg-dark')) {
        return { ...el, fill: '#f8fafc' }
      }
      if (el.type === 'text' && (el.color === '#f8fafc' || el.color === '#ffffff')) {
        return { ...el, color: '#0f172a' }
      }
    }
    // Blue accent refinement
    if (/blue/.test(lower)) {
      if (el.id === 'geo-circle-1' || el.id === 'hero-band' || el.id === 'role-indicator') {
        return { ...el, fill: '#2563eb' }
      }
    }
    // Red / Rose accent refinement
    if (/red|rose|pink/.test(lower)) {
      if (el.id === 'geo-circle-1' || el.id === 'hero-band' || el.id === 'role-indicator') {
        return { ...el, fill: '#e11d48' }
      }
    }
    // Green / Emerald accent refinement
    if (/green|emerald/.test(lower)) {
      if (el.id === 'geo-circle-1' || el.id === 'hero-band' || el.id === 'role-indicator') {
        return { ...el, fill: '#059669' }
      }
    }
    // Purple accent refinement
    if (/purple|violet/.test(lower)) {
      if (el.id === 'geo-circle-1' || el.id === 'hero-band' || el.id === 'role-indicator') {
        return { ...el, fill: '#7c3aed' }
      }
    }

    return el
  })

  return { ...template, elements }
}
