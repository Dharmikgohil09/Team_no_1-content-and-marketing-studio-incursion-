/**
 * Utility for robust participant count extraction and resolution across the application.
 * Supports natural language in English, Hindi, and Hinglish, digit and word representations,
 * structured lists of names, and localStorage resilience.
 */

export function extractCountFromDescription(text: string): number | null {
  if (!text || typeof text !== 'string') return null

  // 1. Number + noun variants (Hindi/Hinglish/English):
  // e.g. "5 participants", "5 participant", "5 logo", "5 log", "5 bando", "5 bande", "5 ka naam", "5 ke naam", "5 ke liye", "5 cards", "5 ids"
  const p1 = /\b(\d+)\s*(?:(?:ke|ka|ki|keliye|ke\s*liye)\s+)?(?:participants?|attendees?|players?|people|persons?|candidates?|students?|members?|entries|records?|cards?|ids?|id\s*cards?|passes?|badges?|tickets?|logo?|log|bande|bando|jan|jana|names?|naam)\b/i
  const m1 = text.match(p1)
  if (m1) {
    const n = parseInt(m1[1], 10)
    if (!isNaN(n) && n > 0) return n
  }

  // e.g. "5 participants ka naam", "5 logo ka naam", "5 logo ke naam"
  const p1b = /\b(\d+)\s*(?:participants?|attendees?|players?|people|persons?|candidates?|students?|members?|logo?|log|bande|bando)\s*(?:ke|ka|ki)?\s*(?:naam|names?)?\b/i
  const m1b = text.match(p1b)
  if (m1b) {
    const n = parseInt(m1b[1], 10)
    if (!isNaN(n) && n > 0) return n
  }

  // e.g. "5 ka naam", "5 ke naam", "5 ke liye"
  const p1c = /\b(\d+)\s*(?:ke|ka|ki)\s*(?:naam|names?|liye)\b/i
  const m1c = text.match(p1c)
  if (m1c) {
    const n = parseInt(m1c[1], 10)
    if (!isNaN(n) && n > 0) return n
  }

  // 2. Explicit key-value pairs:
  // e.g. "participants: 5", "participant count: 5", "total participants = 5", "number of participants: 5"
  const p2 = /(?:number\s+of\s+(?:participants?|people|attendees?|cards?|ids?|logo?|persons?)|participants?\s*count|participant|attendees?|total\s*participants?|total|count|quantity)\s*[:=]?\s*(\d+)/i
  const m2 = text.match(p2)
  if (m2) {
    const n = parseInt(m2[1], 10)
    if (!isNaN(n) && n > 0) return n
  }

  // 3. Action phrases:
  // e.g. "for 5", "make 5", "create 5", "generate 5", "give 5", "having 5", "with 5", "only 5", "just 5", "total 5"
  const p3 = /\b(?:for|make|create|generate|give|get|with|having|only|just|total)\s+(\d+)\b/i
  const m3 = text.match(p3)
  if (m3) {
    const n = parseInt(m3[1], 10)
    if (!isNaN(n) && n > 0) return n
  }

  // 4. Numbered or bulleted list of names:
  // e.g. "1. Aarav\n2. Rohan\n3. Sneha\n4. Priya\n5. Amit"
  const numberedLines = text.match(/^\s*(?:\d+[\.\)]|[-*•])\s+[A-Za-z]/gm)
  if (numberedLines && numberedLines.length >= 2) {
    return numberedLines.length
  }

  // 5. Comma-separated names after 'names:' or 'participants:' or 'naam:'
  const nameListMatch = text.match(/(?:names?|participants?|attendees?|naam)\s*[:=]\s*([A-Za-z\s,]+)/i)
  if (nameListMatch) {
    const names = nameListMatch[1].split(',').map(s => s.trim()).filter(s => s.length >= 2 && !/^(?:and|or|etc)$/i.test(s))
    if (names.length >= 2) return names.length
  }

  // 6. Hindi & English number words: e.g. "five participants", "paanch participants", "panch logo"
  const wordMap: Record<string, number> = {
    one: 1, ek: 1,
    two: 2, do: 2,
    three: 3, teen: 3,
    four: 4, char: 4, chaar: 4,
    five: 5, panch: 5, paanch: 5,
    six: 6, chheh: 6, chhe: 6,
    seven: 7, saat: 7,
    eight: 8, aath: 8,
    nine: 9, nau: 9,
    ten: 10, das: 10,
    eleven: 11, gyarah: 11,
    twelve: 12, barah: 12,
    fifteen: 15, pandrah: 15,
    twenty: 20, bees: 20,
    twentyfive: 25, pachis: 25,
    thirty: 30, tees: 30,
    fifty: 50, pachas: 50,
    hundred: 100, sau: 100,
  }

  for (const [w, val] of Object.entries(wordMap)) {
    const re = new RegExp(`\\b${w}\\s+(?:(?:ke|ka|ki)\\s+)?(?:participants?|attendees?|players?|people|persons?|candidates?|students?|members?|entries|records?|cards?|ids?|passes?|logo?|log|bande|bando|names?|naam)\\b`, 'i')
    if (re.test(text)) {
      return val
    }
  }

  // 7. Look for any number 1-999 in the text (excluding common event years like 2024-2035 or 24/18/12 hours or dates)
  const allNums = text.match(/\b(\d{1,3})\b/g)
  if (allNums && allNums.length > 0) {
    for (const numStr of allNums) {
      const num = parseInt(numStr, 10)
      if (num > 0 && num < 1000 && num !== 24 && num !== 18 && num !== 12 && num !== 30 && num !== 31 && num !== 365) {
        return num
      }
    }
  }

  return null
}

export function getExpectedParticipantCount(project: any): number | null {
  // 1. Check description text from project and localStorage first to ensure user's latest description rules
  const descText = typeof project?.eventContext?.description === 'string'
    ? project.eventContext.description
    : (project?.eventContext?.description?.value || '')

  let storedDesc = ''
  try {
    storedDesc = sessionStorage.getItem('cms_event_description') || ''
  } catch {}

  const nlText = Array.isArray(project?.nlHistory)
    ? project.nlHistory.filter((m: any) => m.role === 'user').map((m: any) => m.content).join(' ')
    : ''

  const combinedDesc = `${descText} ${storedDesc} ${nlText}`.trim()
  const fromDesc = extractCountFromDescription(combinedDesc)
  if (fromDesc && fromDesc > 0) {
    return fromDesc
  }

  // 2. Check sessionStorage expected participants
  try {
    const storedCount = sessionStorage.getItem('cms_expected_participants')
    if (storedCount) {
      const parsed = parseInt(storedCount, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {}

  // 3. Explicit participantCount in eventContext
  const ctxVal = project?.eventContext?.participantCount?.value
  if (typeof ctxVal === 'number' && !isNaN(ctxVal) && ctxVal > 0) {
    return ctxVal
  }

  // 4. Roles: participant / player count or sum of role counts
  const participantRole = project?.roles?.find((r: any) => r.id === 'participant' || r.id === 'player')
  if (typeof participantRole?.count === 'number' && participantRole.count > 0) {
    return participantRole.count
  }

  const roleSum = project?.roles?.reduce((acc: number, r: any) => acc + (r.count || 0), 0)
  if (typeof roleSum === 'number' && roleSum > 0) {
    return roleSum
  }

  return null
}
