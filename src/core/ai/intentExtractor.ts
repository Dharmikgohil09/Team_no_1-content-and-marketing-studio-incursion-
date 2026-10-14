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
  { pattern: /players?|athletes?|runners?|swimmers?/i, id: 'player', label: 'Player' },
  { pattern: /referees?|umpires?/i, id: 'referee', label: 'Referee' },
  { pattern: /founders?|entrepreneurs?|pitchers?/i, id: 'founder', label: 'Founder' },
  { pattern: /investors?|sharks?|venture\s*capitalists?|vc/i, id: 'investor', label: 'Investor' },
  { pattern: /gamers?|esports\s*players?/i, id: 'gamer', label: 'Gamer' },
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

  // Always retain raw description text for downstream category & theme detection
  ;(ctx as any).description = { value: text, status: 'provided' }

  // 1. Event Name:
  // - "event name is Garba" / "event name: Garba" / "event name as Garba"
  // - "event is [cultural/music/etc.] name as Garba" / "event is Garba"
  // - "event ka naam Garba" / "naam Garba"
  // - "cards/badges/passes for Garba"
  // - "Garba event", "Garba fest", "Garba night"
  // - Quoted strings "Garba"
  const namePatterns: RegExp[] = [
    // 1. Explicit name assignment keywords: "name of event X", "name of the event X", "name as X", "name is X", "named as X", "event name as X", "event name: X", "event name X", "naam X"
    /(?:name\s+of\s+(?:the\s+)?event\s*(?:is|as|=|:)?|event\s+name\s*(?:is|as|=|:)?|name\s*(?:is|as|=|:)|named\s*(?:as|is)?|called|titled|naam\s*(?:hai|is|=|:)?)\s+["']?([^"',.\n]+?)["']?(?:\s+(?:\d+\s+(?:participants?|attendees?|players?|organizers?|mentors?|volunteers?|people|members?|delegates?|\-?\s*hours?|\-?\s*days?)|so\s+make|and\b|for\b|with\b|at\b|on\b|in\b|having\b|make\b|need\b|create\b|cards?\b|passes?\b|badges?\b|participants?\b|organizers?\b|mentors?\b|volunteers?\b|judges?\b|speakers?\b|happening\b|scheduled\b|taking\s+place)|$|\.|\,)/i,

    // 2. "event is [cultural/sports/etc.] [name as/called/named] X"
    /(?:the\s+)?event\s+is\s+(?:cultural|technical|sports|music|dance|business|academic|gaming)?\s*(?:named|called|as|is|name\s+as)?\s+["']?([^"',.\n]+?)["']?(?:\s+(?:\d+\s+(?:participants?|attendees?|players?|organizers?|mentors?|volunteers?|people|members?|delegates?|\-?\s*hours?|\-?\s*days?)|so\s+make|and\b|for\b|with\b|at\b|on\b|in\b|having\b|make\b|need\b|create\b|cards?\b|passes?\b|badges?\b|participants?\b|organizers?\b)|$|\.|\,)/i,

    // 3. "hackathon/tournament/event called/named/name as X"
    /(?:hackathon|tournament|conference|event|workshop|competition|concert|pitch|expo|fest|festival)\s+(?:called|named|name\s+as|as)\s+["']?([^"',.\n]+?)["']?(?:\s+(?:\d+\s+(?:participants?|attendees?|players?|organizers?|mentors?|volunteers?|people|members?|delegates?|\-?\s*hours?|\-?\s*days?)|at\b|on\b|for\b|with\b|in\b|having\b|happening\b|scheduled\b|taking\s+place)|$|\.|\,)/i,

    // 4. "cards/passes/badges for [an/the]? X"
    /(?:cards?|passes?|badges?)\s+for\s+(?:an?\s+|the\s+)?([A-Z0-9][A-Za-z0-9\s-]{1,40}?)(?:\s+(?:at\b|on\b|in\b|with\b|having\b|happening\b|\d+\s+(?:participants?|attendees?|players?|organizers?))|$|\.|\,)/i,

    // 5. "X event / fest / festival / tournament / hackathon / concert / night" (1-2 capitalized words, e.g. "Garba Night", "TechFest")
    /\b([A-Z][a-zA-Z0-9-]{1,20}(?:\s+[A-Z0-9][a-zA-Z0-9-]{1,20})?)\s+(?:event|fest|festival|competition|tournament|hackathon|concert|pitch|expo|summit|championship|night|utsav|mahotsav)\b/,

    // 6. Quoted names "X" or 'X'
    /["']([^"'\n]{2,40})["']/,
  ]

  for (const pat of namePatterns) {
    const m = text.match(pat)
    if (m && m[1]?.trim()) {
      const rawCandidate = m[1].trim()
      if (/\b(?:an?|the|our|college|this|my|annual)\b/i.test(rawCandidate)) {
        continue
      }
      let candidate = rawCandidate.replace(/\s+(?:happening|taking\s+place|scheduled|so\s+make\s+cards?|make\s+cards?|cards?).*$/i, '').trim()
      // Reject pronouns and generic roles so "cards for them" never makes "Them" the event name!
      if (/^(?:them|him|her|me|us|you|it|they|everyone|everybody|someone|somebody|anyone|all|both|students?|participants?|organizers?|people|staff|volunteers?|members?|attendees?|delegates?)$/i.test(candidate)) {
        continue
      }
      if (candidate.length >= 2 && !/^(event|college|school|university|campus|annual|this|my|cards?|badges?|passes?|cultural|technical|sports|music|dance)$/i.test(candidate)) {
        const cleanName = (!/[a-z]/.test(candidate) || !/[A-Z]/.test(candidate))
          ? candidate.replace(/\b\w/g, l => l.toUpperCase())
          : candidate
        ctx.name = { value: cleanName, status: 'provided' }
        break
      }
    }
  }

  // Fallback: check known festival, drama, competition, and event titles in text
  if (ctx.name.status === 'missing') {
    const knownEventMatch = text.match(/\b(nukkad\s*natak|natak|street\s*play|garba(?:\s+(?:night|utsav|dandiya|mahotsav|fest|20\d\d))?|dandiya|navratri|diwali\s*mela|spardha|incursion|techfest|codestorm|hacknit|battlebots?|shark\s*(?:tank|mank)|startup\s*pitch|raag|raga|tarang)\b/i)
    if (knownEventMatch) {
      ctx.name = { value: knownEventMatch[1].replace(/\b\w/g, l => l.toUpperCase()), status: 'provided' }
    }
  }

  // 2. Event Category
  let category = 'general'
  if (/(?:music|concert|singing|song|band|raag|raga|musical|vocal|melody|rhythm|audio|orchestra|gig|acoustic|live\s*stage|dj|soundfest|sangeet)/i.test(text)) {
    category = 'music'
  } else if (/(?:shark\s*(?:tank|mank)|pitch|startup|venture|investor|angel|funding|founder|entrepreneur)/i.test(text)) {
    category = 'business'
  } else if (/(?:gaming|esports|lan\s*party|game\s*dev|gamer)/i.test(text)) {
    category = 'gaming'
  } else if (/(?:sports?|tournament|football|cricket|basketball|badminton|athletics?|championship|league|match|referee|players?)/i.test(text)) {
    category = 'sports'
  } else if (/(?:hackathon|coding|codefest|hacknit|datathon|programming)/i.test(text)) {
    category = 'hackathon'
  } else if (/(?:robotics?|robots?|bots?|battlebots?|mechatronics)/i.test(text)) {
    category = 'robotics'
  } else if (/(?:cultural|nukkad\s*natak|natak|street\s*play|skit|drama|theatre|garba|dandiya|navratri|diwali|fest|festival|dance|arts?|celebration)/i.test(text)) {
    category = 'cultural'
  } else if (/(?:conference|summit|symposium|keynote|business|seminar)/i.test(text)) {
    category = 'conference'
  } else if (/(?:workshop|bootcamp|masterclass|training)/i.test(text)) {
    category = 'workshop'
  }
  ;(ctx as any).category = { value: category, status: category !== 'general' ? 'provided' : 'missing' }

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

  // 5. Venue — look for "at VENUE" or "in VENUE" patterns (reject relative clauses like "in which...", "in that...")
  const venueMatch = text.match(/\b(?:at|in)\s+([A-Z0-9][A-Za-z0-9,.\s]+?)(?:\s+with|\s+on|\s+for|$|\.|\,)/i)
  if (venueMatch) {
    const rawVenue = venueMatch[1].trim()
    if (!/^(?:which|that|this|order|case|my|the|our|an?)\b/i.test(rawVenue) &&
        !/\b(?:participants?|attendees?|organizers?|cards?|make\s+id)\b/i.test(rawVenue) &&
        rawVenue.length <= 40) {
      ctx.venue = { value: rawVenue, status: 'provided' }
    }
  } else if (/svnit|nit\s*surat/i.test(text)) {
    ctx.venue = { value: 'SVNIT Surat', status: 'provided' }
  }

  // 6. Organizer — only if explicitly mentioned (e.g. "by ACM", "organized by DSC", etc.)
  const orgMatch = text.match(/\b(?:organized\s+by|hosted\s+by|conducted\s+by|organizer\s*(?:is|=|:)?)\s+([A-Z0-9][A-Za-z0-9\s-]{2,30}?)(?:\s+(?:at|on|for|with)|$|\.|\,)/i)
  if (orgMatch && !/^(?:our|the|a|an)\s+(?:college|team|committee)$/i.test(orgMatch[1].trim())) {
    ctx.organizer = { value: orgMatch[1].trim(), status: 'provided' }
  } else if (/\bacm\b/i.test(text)) {
    ctx.organizer = { value: 'ACM NIT Surat', status: 'provided' }
  }

  // 7. Roles + counts
  for (const { pattern, id, label } of ROLE_KEYWORDS) {
    if (pattern.test(text)) {
      const countMatch = text.match(new RegExp(`(?:approximately\\s+|about\\s+)?(\\d+)\\s+${label.toLowerCase()}s?|${label.toLowerCase()}s?\\s*(?:count\s*)?[:=]?\\s*(\\d+)`, 'i'))
      const count = countMatch ? parseInt(countMatch[1] || countMatch[2]) : undefined
      detectedRoles.push({ id, label, count })
    }
  }

  // 7. Participant Count
  const totalPartMatch =
    text.match(/(?:approximately\s+|about\s+|total\s+)?(\d+)\s+(?:participants?|players?|attendees?|delegates?|people|persons?|candidates?|students?|members?|cards?|ids?|id\s*cards?|passes?)/i) ||
    text.match(/(?:number\s+of\s+participants?|participant\s*count|total\s+participants?|number\s+of\s+people|participants?\s*count)\s*(?:is|=|:)?\s*(\d+)/i) ||
    text.match(/(?:make|create|generate|for)\s+(\d+)\s+(?:people|participants?|ids?|cards?|passes?|persons?|attendees?)/i) ||
    text.match(/\b(\d+)\s+(?:people|persons?|participants?|candidates?|students?)\b/i)

  if (totalPartMatch) {
    const num = parseInt(totalPartMatch[1], 10)
    if (!isNaN(num) && num > 0) {
      (ctx as any).participantCount = { value: num, status: 'provided' }
    }
  }

  // 8. Requested Fields (photo, team, role, id, qr)
  const reqFields: string[] = []
  if (/\b(?:participant\s*names?|person\s*names?|attendee\s*names?|full\s*names?|names?\s*on\s*cards?|with\s+(?:participant\s+)?names?)\b/i.test(text) || (/\bnames\b/i.test(text) && !/\bname\s*(?:as|is|=|:)\b/i.test(text))) reqFields.push('name')
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
      detectedRoles.push({ id: 'player', label: 'Player', count: (ctx as any).participantCount?.value })
    } else {
      detectedRoles.push({ id: 'participant', label: 'Participant', count: (ctx as any).participantCount?.value })
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
  const deterministic = parseIntentDeterministic(text)
  try {
    const res = await fetch('/api/llm/extract-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const parsed = IntentResultSchema.parse(data)

    // MERGE GUARANTEE:
    // If deterministic extractor extracted explicit details (name, category, venue, dateStart),
    // ensure the LLM response does NOT degrade them to 'missing' or null!
    if (deterministic.eventContext.name?.status === 'provided' && (!parsed.eventContext.name?.value || parsed.eventContext.name.status === 'missing')) {
      parsed.eventContext.name = deterministic.eventContext.name
    }
    if ((deterministic.eventContext as any).category?.status === 'provided' && (!(parsed.eventContext as any).category?.value || (parsed.eventContext as any).category?.status === 'missing')) {
      (parsed.eventContext as any).category = (deterministic.eventContext as any).category
    }
    if (deterministic.eventContext.venue?.status === 'provided' && (!parsed.eventContext.venue?.value || parsed.eventContext.venue.status === 'missing')) {
      parsed.eventContext.venue = deterministic.eventContext.venue
    }
    if (deterministic.eventContext.dateStart?.status === 'provided' && (!parsed.eventContext.dateStart?.value || parsed.eventContext.dateStart.status === 'missing')) {
      parsed.eventContext.dateStart = deterministic.eventContext.dateStart
    }
    if ((deterministic.eventContext as any).participantCount?.status === 'provided' && (!(parsed.eventContext as any).participantCount?.value || (parsed.eventContext as any).participantCount?.status === 'missing')) {
      (parsed.eventContext as any).participantCount = (deterministic.eventContext as any).participantCount
    }
    // Merge roles and role counts
    for (const dRole of deterministic.roles) {
      const match = parsed.roles.find(r => r.id === dRole.id)
      if (match) {
        if (!match.count && dRole.count) match.count = dRole.count
      } else {
        parsed.roles.push(dRole)
      }
    }
    return parsed
  } catch (err) {
    console.warn('LLM unavailable, falling back to deterministic parser:', err)
    return deterministic
  }
}
