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
  { pattern: /artists?|singers?|vocalists?|musicians?|performers?/i, id: 'artist', label: 'Artist' },
  { pattern: /players?/i,       id: 'player',      label: 'Player' },
  { pattern: /referees?|umpires?/i, id: 'referee', label: 'Referee' },
  { pattern: /participants?/i,  id: 'participant', label: 'Participant' },
  { pattern: /organiz(?:er|or)s?/i, id: 'organizer', label: 'Organizer' },
  { pattern: /mentors?/i,       id: 'mentor',      label: 'Mentor' },
  { pattern: /volunteers?/i,    id: 'volunteer',   label: 'Volunteer' },
  { pattern: /judges?/i,        id: 'judge',       label: 'Judge' },
  { pattern: /speakers?/i,      id: 'speaker',     label: 'Speaker' },
  { pattern: /sponsors?/i,      id: 'sponsor',     label: 'Sponsor' },
  { pattern: /vips?|guests?/i,  id: 'vip',         label: 'VIP' },
  { pattern: /delegates?/i,     id: 'delegate',    label: 'Delegate' },
]

const DURATION_PATTERNS = [
  { pattern: /(\d+)\s*-?\s*hour/i, unit: 'hour' },
  { pattern: /(\d+)\s*-?\s*day/i,  unit: 'day' },
]

/**
 * Parse a natural-language event description deterministically.
 * Returns structured EventContext and detected roles without making LLM calls.
 */
export function parseIntentDeterministic(text: string): IntentResult {
  const ctx: EventContext = makeEmptyEventContext()
  const detectedRoles: Array<{ id: string; label: string; count?: number }> = []

  // 1. Event Name: look for "called X", "named X", "titled X", "cards for X at/on", or quoted names
  const namePatterns = [
    /(?:called|named|titled)\s+["']?([^"',.\n]+?)["']?(?:\s+(?:at|on|for|with|in|happening|scheduled|taking\s+place)|$|\.|\,)/i,
    /(?:hackathon|tournament|conference|event|workshop|competition|concert)\s+(?:called|named)\s+["']?([^"',.\n]+?)["']?(?:\s+(?:at|on|for|with|in|happening|scheduled|taking\s+place)|$|\.|\,)/i,
    /(?:cards|passes|badges)\s+for\s+(?:an?\s+|the\s+)?([A-Z0-9][A-Za-z0-9\s-]{2,40}?)(?:\s+(?:at|on|in|with|happening)|$|\.|\,)/i,
    /["']([^"'\n]{3,40})["']/,
  ]
  for (const pat of namePatterns) {
    const m = text.match(pat)
    if (m && m[1]?.trim() && !/^(an|a|the|our|college)\b/i.test(m[1].trim())) {
      const cleanName = m[1].trim().replace(/\s+(?:happening|taking\s+place|scheduled).*$/i, '').trim()
      ctx.name = { value: cleanName, status: 'provided' }
      break
    }
  }

  // 2. Event Category
  let category = 'general'
  if (/(?:music|concert|singing|song|band|raag|raga|musical|vocal|melody|rhythm|audio|orchestra|gig|acoustic|live\s*stage|dj|soundfest|sangeet)/i.test(text)) {
    category = 'music'
  } else if (/(?:sports?|tournament|football|cricket|basketball|badminton|athletics?|championship|league|match|referee|players?)/i.test(text)) {
    category = 'sports'
  } else if (/(?:hackathon|coding|codefest|hacknit|datathon|programming)/i.test(text)) {
    category = 'hackathon'
  } else if (/(?:robotics?|robots?|bots?|battlebots?|mechatronics)/i.test(text)) {
    category = 'robotics'
  } else if (/(?:cultural|fest|festival|dance|arts?|celebration|drama|theatre)/i.test(text)) {
    category = 'cultural'
  } else if (/(?:conference|summit|symposium|keynote|business|seminar)/i.test(text)) {
    category = 'conference'
  } else if (/(?:workshop|bootcamp|masterclass|training)/i.test(text)) {
    category = 'workshop'
  }
  (ctx as any).category = { value: category, status: category !== 'general' ? 'provided' : 'missing' }

  // 3. Duration
  for (const { pattern, unit } of DURATION_PATTERNS) {
    const m = text.match(pattern)
    if (m) {
      ctx.duration = { value: `${m[1]}-${unit}`, status: 'provided' }
      break
    }
  }

  // 4. Date
  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      let dateStr = ''
      if (typeof m[3] === 'string' && isNaN(Number(m[1])) === false && MONTH_MAP[m[2]?.toLowerCase()]) {
        dateStr = `${m[1]} ${m[2]} ${m[3] || new Date().getFullYear()}`
      } else if (m[0]) {
        dateStr = m[0]
      }
      if (dateStr) {
        ctx.dateStart = { value: dateStr, status: 'provided' }
      }
      break
    }
  }

  // 5. Venue — look for "at VENUE" or "in VENUE" patterns
  const venueMatch = text.match(/\bat\s+([A-Z0-9][A-Za-z0-9,.\s]+?)(?:\s+with|\s+on|\s+for|$|\.|\,)/i)
  if (venueMatch) {
    ctx.venue = { value: venueMatch[1].trim(), status: 'provided' }
  }

  // 6. Roles + counts
  for (const { pattern, id, label } of ROLE_KEYWORDS) {
    if (pattern.test(text)) {
      const countMatch = text.match(new RegExp(`(?:approximately\\s+|about\\s+)?(\\d+)\\s+${label.toLowerCase()}s?`, 'i'))
      const count = countMatch ? parseInt(countMatch[1]) : undefined
      detectedRoles.push({ id, label, count })
    }
  }

  // 7. Participant Count
  const totalPartMatch = text.match(/(?:approximately\s+|about\s+)?(\d+)\s+(?:participants?|players?|attendees?|delegates?)/i)
  if (totalPartMatch) {
    (ctx as any).participantCount = { value: parseInt(totalPartMatch[1]), status: 'provided' }
  }

  // 8. Requested Fields (name, photo, team, role, id, qr)
  const reqFields: string[] = []
  if (/name/i.test(text)) reqFields.push('name')
  if (/photo|photograph|picture/i.test(text)) {
    reqFields.push('photo')
    ;(ctx as any).hasPhotos = { value: true, status: 'provided' }
  }
  if (/team|team name|college/i.test(text)) reqFields.push('team')
  if (/role|role label/i.test(text)) reqFields.push('role')
  if (/unique id|participant id|reg(?:istration)? no|id/i.test(text)) reqFields.push('id')
  if (/qr|qr code|barcode/i.test(text)) {
    reqFields.push('qr')
    ;(ctx as any).hasQrCode = { value: true, status: 'provided' }
  }
  if (reqFields.length > 0) {
    (ctx as any).requestedFields = { value: reqFields, status: 'provided' }
  }

  // 9. Theme hint
  const themeMatch = text.match(/(?:use a|with a|in a)\s+([a-z0-9-\s]+?theme)/i)
  if (themeMatch) {
    (ctx as any).themeHint = { value: themeMatch[1].trim(), status: 'provided' }
  }

  // Default to participant if no roles detected
  if (detectedRoles.length === 0) {
    if (category === 'sports') {
      detectedRoles.push({ id: 'player', label: 'Player' })
    } else {
      detectedRoles.push({ id: 'participant', label: 'Participant' })
    }
  }

  return IntentResultSchema.parse({
    eventContext: ctx,
    roles: detectedRoles,
    designType: 'idCard',
    confidence: ctx.name.status === 'provided' ? 0.9 : (detectedRoles.length > 0 ? 0.6 : 0.3),
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
