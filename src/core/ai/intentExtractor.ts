import { z } from 'zod'
import { EventContextSchema, type EventContext, makeEmptyEventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import { DEFAULT_ROLES } from '../schema/Role'

/** What the intent extractor returns */
export const IntentResultSchema = z.object({
  eventContext: EventContextSchema,
  roles:        z.array(z.object({
    id:    z.string(),
    label: z.string(),
    count: z.number().optional(),
  })),
  designType:   z.string().default('idCard'),
  confidence:   z.number().min(0).max(1).default(0.5),
})
export type IntentResult = z.infer<typeof IntentResultSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic rule-based parser (no LLM needed)
// ─────────────────────────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})?/i,
  /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  /(\d{4})-(\d{1,2})-(\d{1,2})/,
]

const MONTH_MAP: Record<string, string> = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12'
}

const ROLE_KEYWORDS: Array<{ pattern: RegExp; id: string; label: string }> = [
  { pattern: /participants?/i,  id: 'participant', label: 'Participant' },
  { pattern: /organiz(?:er|or)s?/i, id: 'organizer', label: 'Organizer' },
  { pattern: /mentors?/i,       id: 'mentor',      label: 'Mentor' },
  { pattern: /volunteers?/i,    id: 'volunteer',   label: 'Volunteer' },
  { pattern: /speakers?/i,      id: 'speaker',     label: 'Speaker' },
]

const DURATION_PATTERNS = [
  { pattern: /(\d+)\s*-?\s*hour/i, unit: 'hour' },
  { pattern: /(\d+)\s*-?\s*day/i,  unit: 'day' },
]

const VENUE_KEYWORDS = [/\bat\s+([A-Z][A-Za-z\s,]+)/g, /\bin\s+([A-Z][A-Za-z\s,]+)/g]

/**
 * Parse a natural-language event description deterministically.
 * Returns partially filled EventContext and detected roles.
 */
export function parseIntentDeterministic(text: string): IntentResult {
  const ctx: EventContext = makeEmptyEventContext()
  const detectedRoles: Array<{ id: string; label: string; count?: number }> = []

  // 1. Duration
  for (const { pattern, unit } of DURATION_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      ctx.duration = { value: `${m[1]}-${unit}`, status: 'provided' }
      break
    }
  }

  // 2. Date
  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      let dateStr = ''
      if (typeof m[3] === 'string' && isNaN(Number(m[1])) === false && MONTH_MAP[m[2]?.toLowerCase()]) {
        dateStr = `${m[3] || new Date().getFullYear()}-${MONTH_MAP[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`
      } else if (m[0]) {
        dateStr = m[0]
      }
      if (dateStr) {
        ctx.dateStart = { value: dateStr, status: 'provided' }
      }
      break
    }
  }

  // 3. Venue — look for "at VENUE" or "in VENUE" patterns
  const venueMatch = text.match(/\bat\s+([A-Z][A-Za-z,.\s]+?)(?:\s+with|\s+on|\s+for|$|\.|,)/i)
  if (venueMatch) {
    ctx.venue = { value: venueMatch[1].trim(), status: 'provided' }
  }

  // 4. Roles + counts
  for (const { pattern, id, label } of ROLE_KEYWORDS) {
    if (pattern.test(text)) {
      const countMatch = text.match(new RegExp(`(\\d+)\\s+${label.toLowerCase()}s?`, 'i'))
      const count = countMatch ? parseInt(countMatch[1]) : undefined
      detectedRoles.push({ id, label, count })
    }
  }

  // Default to participant if no roles detected
  if (detectedRoles.length === 0) {
    detectedRoles.push({ id: 'participant', label: 'Participant' })
  }

  // 5. Infer "hackathon" event type
  if (/hackathon/i.test(text)) {
    if (ctx.duration.status === 'missing' && /24/i.test(text)) {
      ctx.duration = { value: '24-hour', status: 'provided' }
    }
  }

  return IntentResultSchema.parse({
    eventContext: ctx,
    roles: detectedRoles,
    designType: 'idCard',
    confidence: detectedRoles.length > 0 ? 0.7 : 0.3,
  })
}

/** Call the LLM proxy; falls back to deterministic if unavailable */
export async function extractIntent(text: string): Promise<IntentResult> {
  try {
    const res = await fetch('/api/llm/extract-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return IntentResultSchema.parse(data)
  } catch (err) {
    console.warn('LLM unavailable, falling back to deterministic parser:', err)
    return parseIntentDeterministic(text)
  }
}
