import { z } from 'zod'
import type { CardTemplate } from '../schema/CardTemplate'
import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import type { Element } from '../schema/Element'
import type { Theme } from '../schema/Theme'
import { getRoleOrDefault, DEFAULT_ROLES } from '../schema/Role'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../../brandKits/defaultLogos'
import {
  extractBaseHue,
  generateThemeFromHue,
  passesWcag,
  getHueDistance,
  MIN_HUE_DISTANCE,
} from './colorConfig'
import { listLayoutArchetypes, getTemplate } from '../../templates/registry'

import {
  type EventCategory,
  THEME_COLOR_PALETTES,
  buildThemeElementsDraft1,
  buildThemeElementsDraft2,
  buildThemeElementsDraft3,
} from './themeVisuals'
export type { EventCategory }

const HexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)

export const AiThemeSchema = z.object({
  background: HexColor,
  surface: HexColor,
  primary: HexColor,
  secondary: HexColor,
  accent: HexColor,
  text: HexColor,
  mutedText: HexColor,
  onAccent: HexColor,
})

export const AiDraftProposalSchema = z.object({
  layoutId: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  moodTags: z.array(z.string()).default([]),
  theme: AiThemeSchema.optional(),
  primaryColor: HexColor.optional(),
  accentColor: HexColor.optional(),
  backgroundColor: HexColor.optional(),
  artworkPrompt: z.string().optional(),
})

export const AiDesignBriefSchema = z.object({
  category: z.string().optional(),
  visualDirection: z.string().optional(),
  drafts: z.array(AiDraftProposalSchema),
})

export function detectEventCategory(event: EventContext): EventCategory {
  const catObj = (event as any).category
  if (catObj && catObj.status !== 'missing' && catObj.value) {
    const explicit = String(catObj.value).toLowerCase()
    if (['sports', 'hackathon', 'robotics', 'conference', 'cultural', 'music', 'workshop', 'business', 'gaming'].includes(explicit)) {
      return explicit as EventCategory
    }
  }
  const text = `${event.name?.value || ''} ${(event as any).description?.value || ''} ${(event as any).themeHint?.value || ''}`.toLowerCase()
  if (/(?:quiz|trivia|olympiad|debate|spelling\s*bee|academic|scholar|knowledge\s*bowl)/i.test(text)) return 'workshop'
  if (/(?:music|concert|singing|song|band|raag|raga|musical|vocal|melody|rhythm|audio|orchestra|gig|acoustic|live\s*stage|dj|soundfest|sangeet)/i.test(text)) return 'music'
  if (/(?:shark\s*(?:tank|mank)|pitch|startup|venture|investor|angel|funding|founder|entrepreneur)/i.test(text)) return 'business'
  if (/(?:gaming|esports|lan\s*party|game\s*dev|gamer)/i.test(text)) return 'gaming'
  if (/(?:sports?|tournament|football|cricket|basketball|badminton|athletics?|championship|league|match|referee|players?)/i.test(text)) return 'sports'
  if (/(?:robotics?|robots?|robos?|bots?|battlebots?|mechatronics)/i.test(text)) return 'robotics'
  if (/(?:cultural|fest|festival|dance|\barts?\b|\bfine\s*arts?\b|celebration|drama|theatre)/i.test(text)) return 'cultural'
  if (/(?:conference|summit|symposium|keynote|seminar)/i.test(text)) return 'conference'
  if (/(?:workshop|bootcamp|masterclass|training)/i.test(text)) return 'workshop'
  if (/(?:hackathon|coding|codefest|hacknit|datathon|programming)/i.test(text)) return 'hackathon'
  return 'general'
}

/**
 * Attach generated background artwork to a CardTemplate behind text and branding
 */
export function attachArtworkToDraft(
  draft: CardTemplate,
  imageUrl: string,
  isGenerated: boolean,
  prompt?: string
): CardTemplate {
  const isEditorial = draft.id === 'premium-editorial' || draft.id === 'minimal-clean'

  const bgArtworkElement: Element = {
    type: 'image',
    id: 'bg-artwork',
    anchor: { x: 0, y: 0, w: 54, h: 85.6 },
    src: imageUrl,
    fit: 'cover',
    cornerRadius: 0,
    opacity: isEditorial ? 0.25 : 0.85,
    preserveAspectRatio: true,
    isLogo: false,
  }

  // Filter out previous artwork without modifying any existing element's geometry or styles
  const cleanElements = draft.elements.filter(
    e => e.id !== 'bg-artwork' && e.id !== 'bg-contrast-overlay'
  )

  const newElements = [bgArtworkElement, ...cleanElements]

  const newRoleElements: Record<string, Element[]> = {}
  if (draft.roleElements) {
    for (const [roleId, rElements] of Object.entries(draft.roleElements)) {
      const cleanRoleList = rElements.filter(
        e => e.id !== 'bg-artwork' && e.id !== 'bg-contrast-overlay'
      )
      newRoleElements[roleId] = [bgArtworkElement, ...cleanRoleList]
    }
  }

  return {
    ...draft,
    backgroundLayer: {
      type: 'artwork',
      imageUrl,
      opacity: isEditorial ? 0.25 : 0.85,
    },
    elements: newElements,
    roleElements: newRoleElements,
    tokens: {
      ...draft.tokens,
      bgArtworkUrl: imageUrl,
      isGeneratedArtwork: isGenerated ? 'true' : 'false',
      artworkPrompt: prompt || draft.tokens?.artworkPrompt || '',
    },
  }
}

function generateClientArtwork(options: {
  eventName?: string
  eventDescription?: string
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  seed?: string | number
}): string {
  const p = options.primaryColor || '#0F5C4D'
  const a = options.accentColor || '#14201C'
  const bg = options.backgroundColor || '#FAF8F4'
  const salt = options.seed !== undefined ? String(options.seed) : String(Date.now() + Math.random())
  const seedText = `${options.eventName || ''} ${options.eventDescription || ''} ${salt}`.trim()

  let h = 5381
  for (let i = 0; i < seedText.length; i++) {
    h = ((h << 5) + h) + seedText.charCodeAt(i)
    h |= 0
  }
  const hash = Math.abs(h)

  const cx1 = 10 + ((hash >> 3) % 34)
  const cy1 = 12 + ((hash >> 5) % 24)
  const cx2 = 10 + ((hash >> 7) % 34)
  const cy2 = 60 + ((hash >> 9) % 22)
  const waveAmp = 6 + ((hash >> 11) % 12)
  const mode = hash % 4

  const isDance = /(?:dance|dancing|dancer|choreograph|garba|dandiya|ballet|hip\s*hop|salsa|kathak|bhangra)/i.test(seedText)
  let dynamicLayers = ''
  if (isDance) {
    // Dynamic fluid dance choreography motion curves, rhythmic stage illumination & kinetic ribbons
    dynamicLayers = `
      <defs>
        <radialGradient id="danceStageGlow" cx="50%" cy="25%" r="65%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.4"/>
          <stop offset="50%" stop-color="${p}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="danceRibbon1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.7"/>
          <stop offset="50%" stop-color="${p}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <circle cx="27" cy="24" r="30" fill="url(#danceStageGlow)"/>
      <!-- Fluid dancing kinetic ribbon curves -->
      <path d="M -5,${cy1 + 10} C 18,${cy1 - 12} 36,${cy1 + 22} 59,${cy1 - 5}" fill="none" stroke="url(#danceRibbon1)" stroke-width="1.8" opacity="0.75"/>
      <path d="M -5,${cy1 + 14} C 20,${cy1 - 8} 34,${cy1 + 26} 59,${cy1 - 1}" fill="none" stroke="${p}" stroke-width="0.6" stroke-dasharray="3,1.5" opacity="0.6"/>
      <path d="M -5,${cy2} C 15,${cy2 + 15} 38,${cy2 - 15} 59,${cy2 + 8}" fill="none" stroke="${a}" stroke-width="1.2" opacity="0.6"/>
      <!-- Dynamic rhythmic poise arcs -->
      <circle cx="${cx1}" cy="${cy1}" r="2.5" fill="${a}" opacity="0.9"/>
      <circle cx="${cx2}" cy="${cy2}" r="2.5" fill="${p}" opacity="0.9"/>
      <ellipse cx="27" cy="78" rx="22" ry="4" fill="${p}" opacity="0.25"/>
    `
  } else if (mode === 0) {
    dynamicLayers = `
      <defs>
        <radialGradient id="dynHalo1" cx="${cx1}%" cy="${cy1}%" r="60%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.35"/>
          <stop offset="50%" stop-color="${p}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx1}" cy="${cy1}" r="32" fill="url(#dynHalo1)" />
      <path d="M -5,${cy1} Q ${cx1},${cy1 + waveAmp} 59,${cy1 - waveAmp}" fill="none" stroke="${a}" stroke-width="0.8" opacity="0.6"/>
      <path d="M -5,${cy1 + 6} Q ${cx1},${cy1 + waveAmp + 6} 59,${cy1 - waveAmp + 6}" fill="none" stroke="${p}" stroke-width="0.5" opacity="0.4" stroke-dasharray="2,2"/>
      <path d="M -5,${cy2} Q ${cx2},${cy2 - waveAmp} 59,${cy2 + waveAmp}" fill="none" stroke="${p}" stroke-width="0.7" opacity="0.5"/>
    `
  } else if (mode === 1) {
    dynamicLayers = `
      <defs>
        <linearGradient id="rayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${p}" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <polygon points="0,0 ${cx1},0 ${cx2},85.6 0,85.6" fill="url(#rayGrad)"/>
      <line x1="0" y1="${cy1}" x2="54" y2="${cy1 + 10}" stroke="${a}" stroke-width="0.5" opacity="0.6"/>
      <line x1="0" y1="${cy2}" x2="54" y2="${cy2 - 8}" stroke="${p}" stroke-width="0.5" opacity="0.6"/>
      <circle cx="${cx1}" cy="${cy1}" r="3" fill="${a}" opacity="0.8"/>
      <circle cx="${cx2}" cy="${cy2}" r="3" fill="${p}" opacity="0.8"/>
    `
  } else if (mode === 2) {
    dynamicLayers = `
      <defs>
        <radialGradient id="prismGlow" cx="${cx2}%" cy="${cy2}%" r="65%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.3"/>
          <stop offset="60%" stop-color="${a}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx2}" cy="${cy2}" r="35" fill="url(#prismGlow)"/>
      <polyline points="0,${cy1} ${cx1},${cy1 - 5} 54,${cy1 + 8}" fill="none" stroke="${a}" stroke-width="0.7" opacity="0.6"/>
      <circle cx="8" cy="18" r="2" fill="${a}" opacity="0.85"/>
      <circle cx="46" cy="72" r="2" fill="${p}" opacity="0.85"/>
    `
  } else {
    dynamicLayers = `
      <defs>
        <radialGradient id="auraGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.4"/>
          <stop offset="70%" stop-color="${a}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${bg}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="27" cy="42" r="38" fill="url(#auraGlow)"/>
      <path d="M 0,20 Q 27,10 54,20 T 54,65 Q 27,75 0,65 Z" fill="none" stroke="${a}" stroke-width="0.4" opacity="0.4"/>
      <circle cx="${cx1}" cy="${cy1}" r="1.8" fill="${p}" opacity="0.9"/>
      <circle cx="${cx2}" cy="${cy2}" r="1.8" fill="${a}" opacity="0.9"/>
    `
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 85.6" width="54mm" height="85.6mm">
    <defs>
      <radialGradient id="procBaseGlow" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${p}" stop-opacity="0.32"/>
        <stop offset="65%" stop-color="${bg}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="procCardWash" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p}" stop-opacity="0.25"/>
        <stop offset="50%" stop-color="${bg}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${a}" stop-opacity="0.25"/>
      </linearGradient>
    </defs>
    <rect width="54" height="85.6" fill="${bg}"/>
    <rect width="54" height="85.6" fill="url(#procBaseGlow)"/>
    <rect width="54" height="85.6" fill="url(#procCardWash)"/>
    ${dynamicLayers}
    <rect width="54" height="85.6" fill="none" stroke="${p}" stroke-width="0.4" opacity="0.3"/>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Regenerate background artwork for a specific draft
 */
export async function generateArtworkForDraft(
  draft: CardTemplate,
  event: EventContext,
  customPrompt?: string,
  forceRegenerate = true
): Promise<CardTemplate> {
  const eventName = event.name?.value || 'Event'
  const eventDesc = (event as any).description?.value || ''
  const prompt = customPrompt || draft.tokens?.artworkPrompt || `${eventName}: ${eventDesc}`

  try {
    const artRes = await fetch('/api/image/generate-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        eventName,
        eventDescription: eventDesc,
        primaryColor: draft.tokens?.primaryColor,
        accentColor: draft.tokens?.accentColor,
        backgroundColor: draft.tokens?.backgroundColor,
        draftId: draft.id,
        forceRegenerate,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (artRes.ok) {
      const artData = await artRes.json()
      if (artData.imageUrl) {
        return attachArtworkToDraft(draft, artData.imageUrl, !!artData.isGenerated, prompt)
      }
    }
  } catch (err) {
    console.warn(`generateArtworkForDraft fetch notice, using dynamic client generator:`, err)
  }

  // Guaranteed dynamic client generation fallback: ensures background ALWAYS changes immediately!
  const clientArtUrl = generateClientArtwork({
    eventName,
    eventDescription: eventDesc,
    primaryColor: draft.tokens?.primaryColor,
    accentColor: draft.tokens?.accentColor,
    backgroundColor: draft.tokens?.backgroundColor,
    seed: `${Date.now()}_${Math.random()}`,
  })
  return attachArtworkToDraft(draft, clientArtUrl, false, prompt)
}

/** Validate structured AI response against schema and WCAG contrast */
export function validateAiResponse(data: unknown, allowedLayoutIds: string[]): boolean {
  const parse = AiDesignBriefSchema.safeParse(data)
  if (!parse.success || !parse.data.drafts || parse.data.drafts.length === 0) {
    return false
  }

  const drafts = parse.data.drafts
  for (const d of drafts) {
    const layoutId = d.layoutId || d.id
    if (!layoutId) return false
    // Layout id must exist in registry
    if (!allowedLayoutIds.includes(layoutId) && !getTemplate(layoutId)) {
      return false
    }

    // Validate theme tokens & contrast if theme is provided
    if (d.theme) {
      const { text, background, surface, onAccent, accent } = d.theme
      const hasBgContrast = passesWcag(text, background, 4.5) || passesWcag(text, surface, 4.5)
      const hasAccentContrast = passesWcag(onAccent, accent, 3.0)
      if (!hasBgContrast || !hasAccentContrast) {
        return false
      }
    }
  }

  return true
}

export interface GenerateDraftsOptions {
  logos?: { instituteLogo?: string; clubLogo?: string }
  clarifyAnswers?: Record<string, string>
  styleKeywords?: string[]
  brandKitTokens?: Record<string, string>
  seed?: number
  excludedPairs?: string[]
  onAiFallback?: (fallback: boolean) => void
}

/**
 * Generate 3 distinct draft templates customized based on the user's event description,
 * missing questions answered, role definitions, and event category.
 */
export async function generateDrafts(
  event: EventContext,
  roles: (Role | string)[],
  options?: GenerateDraftsOptions
): Promise<CardTemplate[]> {
  const logos = options?.logos
  const seed = options?.seed ?? 1
  const excludedPairs = options?.excludedPairs || []
  let llmData: any = null
  let isAiValid = false

  const allowedArchetypes = listLayoutArchetypes()
  const allowedLayoutIds = allowedArchetypes.map(a => a.id)

  const sendPayload = async () => {
    const res = await fetch('/api/llm/generate-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        roles,
        description: (event as any).description?.value || event.name?.value || '',
        clarifyAnswers: options?.clarifyAnswers || {},
        styleKeywords: options?.styleKeywords || [],
        brandKitTokens: options?.brandKitTokens || {},
        allowedLayoutIds,
        seed,
        excludedPairs,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return await res.json()
  }

  // Attempt 1
  try {
    const data = await sendPayload()
    if (data && validateAiResponse(data, allowedLayoutIds)) {
      llmData = data
      isAiValid = true
    }
  } catch (err) {
    console.warn('generate-drafts attempt 1 failed:', err)
  }

  // Retry once on failure
  if (!isAiValid) {
    try {
      const data = await sendPayload()
      if (data && validateAiResponse(data, allowedLayoutIds)) {
        llmData = data
        isAiValid = true
      }
    } catch (err) {
      console.warn('generate-drafts retry failed:', err)
    }
  }

  if (!isAiValid) {
    options?.onAiFallback?.(true)
  } else {
    options?.onAiFallback?.(false)
  }

  // Generate drafts using AI brief if valid, otherwise fallback palette harmony engine
  return generateDraftsDeterministic(event, roles, logos, llmData, seed, excludedPairs)
}


// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 1: MODERN MINIMAL (Dual-Tone Vertical Split - Category Aware)
// ─────────────────────────────────────────────────────────────────────────────

function buildModernMinimalFront(
  role: Role,
  event: EventContext,
  logos: { instLogo: string; clubLogo: string },
  category: EventCategory = 'general',
  customPalette?: { primaryColor?: string; accentColor?: string; backgroundColor?: string }
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker' || roleId === 'founder'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor' || roleId === 'investor'
  const isPlayer = roleId === 'player' || roleId === 'artist' || roleId === 'gamer'

  const pal = THEME_COLOR_PALETTES[category] || THEME_COLOR_PALETTES.general
  const headerBg = '#ffffff'
  const headerTextColor = '#14201C'
  const badgeTypeColor = customPalette?.accentColor || '#66706A'
  const lowerBg = role.palette?.secondary || pal.d1LowerBg || '#14201C'
  const accentColor = customPalette?.primaryColor || role.palette?.primary || pal.d1Accent || '#0F5C4D'
  const ringStroke = customPalette?.accentColor || '#D9D5C7'

  const fullText = `${event.name?.value || ''} ${(event as any).description?.value || ''}`.toLowerCase()
  const isDance = /(?:dance|dancing|dancer|choreograph|garba|dandiya|ballet|hip\s*hop|salsa|kathak|bhangra)/i.test(fullText)

  const badgeTypeLabel = isDance
    ? (isSpeaker ? 'HEADLINE CHOREOGRAPHER' : isOrganizer ? 'DANCE COMMITTEE' : isJudge ? 'JURY & JUDGE PASS' : isPlayer ? 'DANCE COMPETITOR' : 'DANCE FESTIVAL PASS')
    : category === 'music'
    ? (isSpeaker ? 'HEADLINE VOCALIST' : isOrganizer ? 'CONCERT DIRECTOR' : isJudge ? 'MUSIC EVALUATOR' : isVolunteer ? 'STAGE & SOUND CREW' : 'LIVE CONCERT PASS')
    : category === 'business'
    ? (isSpeaker ? 'STARTUP FOUNDER' : isMentor ? 'VENTURE INVESTOR' : isJudge ? 'ANGEL JURY' : isOrganizer ? 'SUMMIT DIRECTOR' : 'VENTURE PASS')
    : category === 'gaming'
    ? (isPlayer ? 'PRO ROSTER GAMER' : isJudge ? 'HEAD REFEREE' : isOrganizer ? 'TOURNAMENT ORGANIZER' : 'ARENA GAMING PASS')
    : category === 'sports'
    ? (isJudge ? 'OFFICIAL MATCH REFEREE' : isOrganizer ? 'TOURNAMENT DIRECTOR' : isMentor ? 'TEAM COACH' : isPlayer ? 'ATHLETIC ROSTER PASS' : 'ATHLETIC PASS')
    : category === 'robotics'
    ? (isJudge ? 'TECHNICAL JURY ACCREDITATION' : isMentor ? 'ENGINEERING MENTOR' : isOrganizer ? 'LEAD MARSHAL' : 'ROBOTICS COMPETITOR PASS')
    : category === 'conference'
    ? (isSpeaker ? 'KEYNOTE SPEAKER & FACULTY' : isJudge ? 'EVALUATION BOARD' : isOrganizer ? 'EXECUTIVE CHAIR' : 'OFFICIAL DELEGATE PASS')
    : category === 'cultural'
    ? (isSpeaker ? 'HEADLINE ARTIST PASS' : isOrganizer ? 'FESTIVAL COMMITTEE' : 'FESTIVAL ACCESS PASS')
    : category === 'workshop'
    ? 'WORKSHOP ACCREDITATION'
    : isOrganizer
    ? 'OFFICIAL COMMITTEE PASS'
    : isJudge
    ? 'HONORARY JURY BADGE'
    : isSpeaker
    ? 'KEYNOTE SPEAKER PASS'
    : isVolunteer
    ? 'EVENT CREW PASS'
    : isMentor
    ? 'MENTOR & ADVISOR'
    : 'PARTICIPANT PASS'

  const themeMotifs = buildThemeElementsDraft1(category, pal)

  const elements: Element[] = [
    // 1. Top Header Section
    {
      type: 'shape',
      id: 'header-bg',
      anchor: { x: 0, y: 0, w: 54, h: 38 },
      shape: 'rect',
      fill: headerBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 2. Lanyard Slot Hole (realistic badge mockup punch hole)
    {
      type: 'shape',
      id: 'lanyard-slot',
      anchor: { x: 22, y: 2.2, w: 10, h: 2.6 },
      shape: 'rect',
      fill: '#E9E5D8',
      stroke: '#D9D5C7',
      strokeWidth: 0.35,
      cornerRadius: 1.3,
      opacity: 1,
    },
    // 3. Official ACM Logo (Top Left — ACM NIT Surat convention)
    {
      type: 'image',
      id: 'acm-logo',
      anchor: { x: 3.5, y: 6.5, w: 9, h: 9 },
      src: logos.clubLogo,
      fit: 'contain',
      cornerRadius: 0,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 4. Official SVNIT Logo (Top Right — institute logo)
    {
      type: 'image',
      id: 'svnit-logo',
      anchor: { x: 41.5, y: 6.5, w: 9, h: 9 },
      src: logos.instLogo,
      fit: 'contain',
      cornerRadius: 4.5,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 5. Badge Type Category Header
    {
      type: 'text',
      id: 'badge-type-label',
      anchor: { x: 13, y: 6.8, w: 28, h: 3.2 },
      content: badgeTypeLabel,
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.7,
      fontWeight: '700',
      color: badgeTypeColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // 6. Event Name
    {
      type: 'text',
      id: 'event-name-header',
      anchor: { x: 11, y: 9.0, w: 32, h: 6.5 },
      content: event.name?.value
        ? (event.name.value === event.name.value.toLowerCase() ? event.name.value.replace(/\b\w/g, l => l.toUpperCase()) : event.name.value)
        : 'Event Name',
      fontFamily: 'Instrument Serif',
      fontSize: 6.5,
      fontWeight: '400',
      color: headerTextColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 4.5,
    },
    // 7. Badge Serial
    {
      type: 'text',
      id: 'badge-serial',
      anchor: { x: 13, y: 15.5, w: 28, h: 3 },
      content: 'No. {{person.id}}',
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.7,
      fontWeight: '500',
      color: '#66706A',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // 8. Lower Deep Credential Section
    {
      type: 'shape',
      id: 'lower-bg',
      anchor: { x: 0, y: 38, w: 54, h: 47.6 },
      shape: 'rect',
      fill: lowerBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 9. Diagonal Geometric Slashes flanking the boundary
    {
      type: 'shape',
      id: 'split-slash-left',
      anchor: { x: 3, y: 36.5, w: 10, h: 3 },
      shape: 'polygon',
      points: '0,0 8,0 6,3 0,3',
      fill: role.palette?.primary || accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.95,
    },
    {
      type: 'shape',
      id: 'split-slash-right',
      anchor: { x: 41, y: 36.5, w: 10, h: 3 },
      shape: 'polygon',
      points: '2,0 10,0 10,3 4,3',
      fill: role.palette?.primary || accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.95,
    },
    // 10. Thematic Background Scene Motifs
    ...themeMotifs,
    // 11. Circular Photo Ring Border
    {
      type: 'shape',
      id: 'photo-ring',
      anchor: { x: 15, y: 25, w: 24, h: 24 },
      shape: 'circle',
      fill: 'transparent',
      stroke: ringStroke,
      strokeWidth: 1.2,
      cornerRadius: 12,
      opacity: 1,
    },
    // 12. Circular Portrait Photo
    {
      type: 'photo',
      id: 'person-photo',
      anchor: { x: 16.2, y: 26.2, w: 21.6, h: 21.6 },
      binding: '{{person.photoUrl}}',
      shape: 'circle',
      cornerRadius: 10.8,
      fallback: 'initials',
      initialsBinding: '{{person.name}}',
      initialsColor: '#ffffff',
      initialsBg: role.palette?.primary || accentColor,
    },
    // 13. Participant Name Typography
    {
      type: 'text',
      id: 'person-name',
      anchor: { x: 2, y: 52, w: 50, h: 7.8 },
      content: '{{person.name}}',
      fontFamily: 'Instrument Serif',
      fontSize: 9.0,
      fontWeight: '400',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 2,
      minFontSize: 6.0,
    },
    // 14. Role Pill Badge
    {
      type: 'shape',
      id: 'role-pill-bg',
      anchor: { x: 13, y: 60.5, w: 28, h: 5.5 },
      shape: 'rect',
      cornerRadius: 2.75,
      fill: role.palette?.primary || accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
    },
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 13, y: 60.5, w: 28, h: 5.5 },
      content: role.label.toUpperCase(),
      fontFamily: 'Hanken Grotesk',
      fontSize: 4.2,
      fontWeight: '600',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3.2,
    },
    // 15. Secondary Detail (Team / Organization / Designation)
    {
      type: 'text',
      id: 'person-detail',
      anchor: { x: 2, y: 66.5, w: 50, h: 4 },
      content: '{{person.team}}',
      fontFamily: 'Hanken Grotesk',
      fontSize: 3.5,
      fontWeight: '500',
      color: '#D9D5C7',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 17. Real Scannable Vector QR Code
    {
      type: 'qr',
      id: 'person-qr',
      anchor: { x: 22.5, y: 69.5, w: 9, h: 9 },
      urlPattern: event.website?.value ? `${event.website.value.replace(/\/$/, '')}/verify/{{person.id}}` : `https://verify.eventpass.live/{{person.id}}`,
      fgColor: '#ffffff',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // 18. Footer Micro Branding
    {
      type: 'text',
      id: 'footer-branding',
      anchor: { x: 2, y: 84.4, w: 50, h: 2.4 },
      content: event.organizer?.value
        ? event.organizer.value.toUpperCase()
        : (category === 'music' ? 'LIVE CONCERT ARENA' : category === 'business' ? 'STARTUP PITCH SUMMIT' : category === 'cultural' ? 'CULTURAL FESTIVAL · OFFICIAL PASS' : category === 'sports' ? 'ATHLETIC CHAMPIONSHIP PASS' : (event.name?.value ? `${event.name.value.toUpperCase()} · OFFICIAL PASS` : 'OFFICIAL EVENT PASS')),
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.2,
      fontWeight: '600',
      color: '#66706A',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 1.8,
    },
  ]

  return elements
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 2: CREATIVE TECH (Scientific Hexagons & Chevron Banner - Reference 2)
// ─────────────────────────────────────────────────────────────────────────────

function buildCreativeTechFront(
  role: Role,
  event: EventContext,
  logos: { instLogo: string; clubLogo: string },
  category: EventCategory = 'general',
  customPalette?: { primaryColor?: string; accentColor?: string; backgroundColor?: string }
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker' || roleId === 'founder'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor' || roleId === 'investor'
  const isPlayer = roleId === 'player' || roleId === 'artist' || roleId === 'gamer'

  const pal = THEME_COLOR_PALETTES[category] || THEME_COLOR_PALETTES.general
  const techBg = role.palette?.secondary || pal.d2HeroBg || '#14201C'
  const lowerBg = pal.d2LowerBg || '#FAF8F4'
  const accentColor = customPalette?.primaryColor || role.palette?.accent || pal.d2Accent
  const themeMotifs = buildThemeElementsDraft2(category, pal)

  // Dynamic category-based motifs
  const categoryMotifs: Element[] = category === 'music' ? [
    // Music: Stage Crossing Laser Beams
    {
      type: 'shape',
      id: 'music-laser-1',
      anchor: { x: 0, y: 5, w: 54, h: 36 },
      shape: 'line',
      fill: 'transparent',
      stroke: '#ec4899',
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 0.45,
    },
    {
      type: 'shape',
      id: 'music-laser-2',
      anchor: { x: 0, y: 41, w: 54, h: 36 },
      shape: 'line',
      fill: 'transparent',
      stroke: '#8b5cf6',
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 0.45,
    },
    // Concentric Vinyl Sound Grooves behind avatar
    {
      type: 'shape',
      id: 'music-groove-1',
      anchor: { x: 12, y: 11.5, w: 30, h: 30 },
      shape: 'circle',
      fill: 'transparent',
      stroke: '#ec4899',
      strokeWidth: 0.4,
      cornerRadius: 15,
      opacity: 0.35,
    },
    {
      type: 'shape',
      id: 'music-groove-2',
      anchor: { x: 9, y: 8.5, w: 36, h: 36 },
      shape: 'circle',
      fill: 'transparent',
      stroke: '#a855f7',
      strokeWidth: 0.3,
      cornerRadius: 18,
      opacity: 0.25,
    },
    // Floating Musical Notes (Vector Paths)
    {
      type: 'shape',
      id: 'music-note-crest-1',
      anchor: { x: 3, y: 14, w: 8, h: 9 },
      shape: 'path',
      d: 'M 0.5 7.2 C 0.5 6 1.8 5.2 3 5.4 L 3 1.8 L 8 0.6 L 8 5 C 6.8 4.8 5.5 5.6 5.5 6.8 C 5.5 7.8 6.6 8.5 7.8 8.4 C 8.7 8.3 9.2 7.6 9.2 6.5 L 9.2 0 L 2 1.2 L 2 5.8 C 1 5.6 0.5 6.3 0.5 7.2 Z',
      fill: '#ec4899',
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.6,
    },
    {
      type: 'shape',
      id: 'music-note-crest-2',
      anchor: { x: 43, y: 14, w: 7, h: 9 },
      shape: 'path',
      d: 'M 0.5 7 C 0.5 5.8 2 5 3.5 5.2 L 3.5 1.5 C 3.5 1 3.8 0.5 4.5 0.5 C 5.5 0.5 6.5 1.2 7 2.2 C 6.5 2.8 5.5 3 4.7 2.6 L 4.7 6.8 C 4.5 7.9 3.2 8.8 1.8 8.8 C 0.8 8.8 0.5 8 0.5 7 Z',
      fill: '#a855f7',
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.6,
    },
    // Sonic Equalizer Waveform Bars across the background
    ...[2.8, 5.0, 7.8, 10.5, 6.0, 9.2, 12.8, 8.0, 11.2, 7.0, 9.5, 4.5, 8.0, 10.8, 5.8, 3.2].map((h, i) => ({
      type: 'shape' as const,
      id: `music-crest-eq-${i}`,
      anchor: { x: 3.5 + i * 3.0, y: 72 - h, w: 1.8, h },
      shape: 'rect' as const,
      fill: '#d946ef',
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0.8,
      opacity: 0.22,
    })),
  ] : category === 'sports' ? [
    // Sports: Athletic Speed Chevrons & Motion Lines
    {
      type: 'shape',
      id: 'sports-chevron-1',
      anchor: { x: 3, y: 15, w: 9, h: 9 },
      shape: 'polygon',
      points: '0,0 6,0 9,4.5 6,9 0,9 3,4.5',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.6,
      cornerRadius: 0,
      opacity: 0.5,
    },
    {
      type: 'shape',
      id: 'sports-chevron-2',
      anchor: { x: 42, y: 15, w: 9, h: 9 },
      shape: 'polygon',
      points: '3,0 9,0 6,4.5 9,9 3,9 0,4.5',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.6,
      cornerRadius: 0,
      opacity: 0.5,
    },
    {
      type: 'shape',
      id: 'sports-motion-line-1',
      anchor: { x: 10, y: 19.5, w: 5, h: 0.4 },
      shape: 'line',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.4,
      cornerRadius: 0,
      opacity: 0.6,
    },
    {
      type: 'shape',
      id: 'sports-motion-line-2',
      anchor: { x: 39, y: 19.5, w: 5, h: 0.4 },
      shape: 'line',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.4,
      cornerRadius: 0,
      opacity: 0.6,
    },
  ] : category === 'cultural' ? [
    // Cultural: Festive Star Diamonds
    {
      type: 'shape',
      id: 'festive-star-1',
      anchor: { x: 3, y: 14, w: 8, h: 8 },
      shape: 'polygon',
      points: '4,0 5.2,2.8 8,4 5.2,5.2 4,8 2.8,5.2 0,4 2.8,2.8',
      fill: accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.45,
    },
    {
      type: 'shape',
      id: 'festive-star-2',
      anchor: { x: 43, y: 14, w: 8, h: 8 },
      shape: 'polygon',
      points: '4,0 5.2,2.8 8,4 5.2,5.2 4,8 2.8,5.2 0,4 2.8,2.8',
      fill: accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.45,
    },
  ] : category === 'robotics' ? [
    // Robotics: Precision Caliper Brackets
    {
      type: 'shape',
      id: 'caliper-bracket-1',
      anchor: { x: 3, y: 14, w: 7, h: 9 },
      shape: 'polygon',
      points: '0,0 7,0 7,1.5 2,1.5 2,7.5 7,7.5 7,9 0,9',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 0.55,
    },
    {
      type: 'shape',
      id: 'caliper-bracket-2',
      anchor: { x: 44, y: 14, w: 7, h: 9 },
      shape: 'polygon',
      points: '7,0 0,0 0,1.5 5,1.5 5,7.5 0,7.5 0,9 7,9',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 0.55,
    },
  ] : category === 'conference' ? [
    // Conference: Executive Diamond Crest
    {
      type: 'shape',
      id: 'summit-crest-1',
      anchor: { x: 3, y: 15, w: 8, h: 8 },
      shape: 'polygon',
      points: '4,0 8,4 4,8 0,4',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.5,
      cornerRadius: 0,
      opacity: 0.45,
    },
    {
      type: 'shape',
      id: 'summit-crest-2',
      anchor: { x: 43, y: 15, w: 8, h: 8 },
      shape: 'polygon',
      points: '4,0 8,4 4,8 0,4',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.5,
      cornerRadius: 0,
      opacity: 0.45,
    },
  ] : [
    // Hackathon & General: Hexagonal Molecular Network & Circuits
    {
      type: 'shape',
      id: 'hex-cluster-1',
      anchor: { x: 2, y: 13, w: 9, h: 9 },
      shape: 'polygon',
      points: '4.5,0 9,2.6 9,7.8 4.5,10.4 0,7.8 0,2.6',
      fill: role.palette.primary,
      stroke: accentColor,
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 0.38,
    },
    {
      type: 'shape',
      id: 'hex-cluster-2',
      anchor: { x: 6, y: 22, w: 7, h: 7 },
      shape: 'polygon',
      points: '3.5,0 7,2 7,6 3.5,8 0,6 0,2',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.35,
      cornerRadius: 0,
      opacity: 0.45,
    },
    {
      type: 'shape',
      id: 'hex-cluster-3',
      anchor: { x: 42, y: 14, w: 8, h: 8 },
      shape: 'polygon',
      points: '4,0 8,2.3 8,6.9 4,9.2 0,6.9 0,2.3',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.4,
      cornerRadius: 0,
      opacity: 0.4,
    },
    {
      type: 'shape',
      id: 'circuit-line-1',
      anchor: { x: 10, y: 14.5, w: 6, h: 0.4 },
      shape: 'line',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.35,
      cornerRadius: 0,
      opacity: 0.5,
    },
    {
      type: 'shape',
      id: 'circuit-line-2',
      anchor: { x: 37, y: 21, w: 6, h: 0.4 },
      shape: 'line',
      fill: 'transparent',
      stroke: accentColor,
      strokeWidth: 0.35,
      cornerRadius: 0,
      opacity: 0.5,
    },
  ]

  const orgSubtitle = event.organizer?.value
    ? event.organizer.value.toUpperCase()
    : category === 'music'
    ? 'LIVE CONCERT ARENA'
    : category === 'business'
    ? 'STARTUP PITCH SUMMIT'
    : category === 'gaming'
    ? 'ESPORTS CHAMPIONSHIP'
    : category === 'sports'
    ? 'SPORTS COUNCIL'
    : category === 'cultural'
    ? 'CULTURAL FESTIVAL'
    : category === 'robotics'
    ? 'ROBOTICS ARENA'
    : category === 'conference'
    ? 'EXECUTIVE SUMMIT'
    : (event.name?.value ? `${event.name.value.toUpperCase()} TEAM` : 'OFFICIAL PASS')

  const roleBadgeLabel = category === 'music'
    ? (isSpeaker ? 'HEADLINE ARTIST' : isOrganizer ? 'CONCERT DIRECTOR' : isJudge ? 'JURY' : role.label.toUpperCase())
    : category === 'business'
    ? (isSpeaker ? 'STARTUP FOUNDER' : isMentor ? 'ANGEL INVESTOR' : isJudge ? 'PITCH JURY' : role.label.toUpperCase())
    : category === 'gaming'
    ? (isPlayer ? 'PRO GAMER' : isJudge ? 'REFEREE' : role.label.toUpperCase())
    : category === 'sports'
    ? (isPlayer ? 'ATHLETE' : isJudge ? 'REFEREE' : isOrganizer ? 'DIRECTOR' : role.label.toUpperCase())
    : role.label.toUpperCase()

  const personDetailText = category === 'sports'
    ? (isOrganizer ? 'Tournament Operations' : isJudge ? 'Match Official Panel' : isMentor ? 'Coaching Staff' : isPlayer ? 'Squad: {{person.team}}' : '{{person.team}}')
    : category === 'music'
    ? (isOrganizer ? 'Concert Production Team' : isJudge ? 'Jury & Music Board' : isMentor ? 'Musical Director' : isSpeaker ? 'Headline Vocalist & Artist' : 'Live Arena Pass')
    : category === 'business'
    ? (isSpeaker ? 'Founding Team · {{person.team}}' : isMentor ? 'Venture Capital Partner' : '{{person.team}}')
    : category === 'gaming'
    ? (isPlayer ? 'Squad: {{person.team}}' : 'Tournament Official')
    : isOrganizer ? 'Core Organizing Team' : isJudge ? 'Judge & Panelist' : isMentor ? 'Mentor & Coach' : isVolunteer ? 'Operations Support' : '{{person.team}}'

  const footerText = event.organizer?.value
    ? `VERIFIED CREDENTIAL · ${event.organizer.value.toUpperCase()}`
    : category === 'music'
    ? 'OFFICIAL CONCERT TOUR PASS'
    : category === 'business'
    ? 'VERIFIED PITCH CREDENTIAL'
    : category === 'gaming'
    ? 'ESPORTS ROSTER BADGE'
    : category === 'sports'
    ? 'OFFICIAL ATHLETIC PASS'
    : category === 'cultural'
    ? 'FESTIVAL ACCREDITATION'
    : category === 'robotics'
    ? 'TELEMETRY CREDENTIAL'
    : category === 'conference'
    ? 'CONFERENCE DELEGATE PASS'
    : (event.name?.value ? `VERIFIED CREDENTIAL · ${event.name.value.toUpperCase()}` : 'VERIFIED EVENT CREDENTIAL')

  const elements: Element[] = [
    // 1. Top Hero Background (y: 0 to 48)
    {
      type: 'shape',
      id: 'tech-hero-bg',
      anchor: { x: 0, y: 0, w: 54, h: 48 },
      shape: 'rect',
      fill: techBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 2. Thematic Scene Motifs (Concert lasers, grooves, notes, chevrons, calipers, or hexagons)
    ...themeMotifs,
    // 3. Official ACM Logo (Top Left — ACM NIT Surat convention)
    {
      type: 'image',
      id: 'acm-logo',
      anchor: { x: 3, y: 3.5, w: 8.5, h: 8.5 },
      src: logos.clubLogo,
      fit: 'contain',
      cornerRadius: 0,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 4. Official SVNIT Logo (Top Right — institute logo)
    {
      type: 'image',
      id: 'svnit-logo',
      anchor: { x: 42.5, y: 3.5, w: 8.5, h: 8.5 },
      src: logos.instLogo,
      fit: 'contain',
      cornerRadius: 4.25,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 5. Event Title
    {
      type: 'text',
      id: 'event-name-header',
      anchor: { x: 11, y: 3.0, w: 32, h: 6.5 },
      content: event.name?.value
        ? (event.name.value === event.name.value.toLowerCase() ? event.name.value.replace(/\b\w/g, l => l.toUpperCase()) : event.name.value)
        : 'Event Title',
      fontFamily: 'Instrument Serif',
      fontSize: 6.5,
      fontWeight: '400',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 4.5,
    },
    // 6. Organization Subtitle
    {
      type: 'text',
      id: 'org-subtitle',
      anchor: { x: 12, y: 9.8, w: 30, h: 3.5 },
      content: orgSubtitle,
      fontFamily: 'Hanken Grotesk',
      fontSize: 3.2,
      fontWeight: '600',
      color: '#D9D5C7',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.4,
    },
    // 7. Circular Avatar with Glowing Halo Ring
    {
      type: 'shape',
      id: 'halo-ring',
      anchor: { x: 15, y: 14.5, w: 24, h: 24 },
      shape: 'circle',
      fill: 'transparent',
      stroke: '#D9D5C7',
      strokeWidth: 0.85,
      cornerRadius: 12,
      opacity: 0.9,
    },
    {
      type: 'photo',
      id: 'person-photo',
      anchor: { x: 16.5, y: 16, w: 21, h: 21 },
      binding: '{{person.photoUrl}}',
      shape: 'circle',
      cornerRadius: 10.5,
      fallback: 'initials',
      initialsBinding: '{{person.name}}',
      initialsColor: '#ffffff',
      initialsBg: role.palette?.primary || accentColor,
    },
    // 8. Lower Zone
    {
      type: 'shape',
      id: 'info-zone-bg',
      anchor: { x: 0, y: 47, w: 54, h: 38.6 },
      shape: 'rect',
      fill: lowerBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 9. Distinctive Chevron Dividing Banner (Ref 2 inverted apex)
    {
      type: 'shape',
      id: 'chevron-banner',
      anchor: { x: 0, y: 41, w: 54, h: 9 },
      shape: 'polygon',
      points: '0,9 27,0 54,9 54,9 0,9',
      fill: lowerBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 10. Pill Role Badge
    {
      type: 'shape',
      id: 'role-pill-bg',
      anchor: { x: 13, y: 39, w: 28, h: 6 },
      shape: 'rect',
      cornerRadius: 3,
      fill: role.palette?.primary || accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
    },
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 13, y: 39, w: 28, h: 6 },
      content: roleBadgeLabel,
      fontFamily: 'Hanken Grotesk',
      fontSize: 4.4,
      fontWeight: '600',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3,
    },
    // 11. Participant Name
    {
      type: 'text',
      id: 'person-name',
      anchor: { x: 2, y: 47, w: 50, h: 7.2 },
      content: '{{person.name}}',
      fontFamily: 'Instrument Serif',
      fontSize: 8.8,
      fontWeight: '400',
      color: '#14201C',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 5.2,
    },
    // 12. Team / Credential
    {
      type: 'text',
      id: 'person-team',
      anchor: { x: 2, y: 55, w: 50, h: 4 },
      content: '{{person.team}}',
      fontFamily: 'Hanken Grotesk',
      fontSize: 3.5,
      fontWeight: '500',
      color: '#4B5651',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 14. Real Vector QR Code
    {
      type: 'qr',
      id: 'person-qr',
      anchor: { x: 21, y: 61, w: 12, h: 12 },
      urlPattern: event.website?.value ? `${event.website.value.replace(/\/$/, '')}/verify/{{person.id}}` : `https://verify.eventpass.live/{{person.id}}`,
      fgColor: '#14201C',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // 16. Footer Validity Micro-Text
    {
      type: 'text',
      id: 'footer-validity',
      anchor: { x: 2, y: 82.5, w: 50, h: 2.4 },
      content: footerText,
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.2,
      fontWeight: '600',
      color: '#66706A',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 1.8,
    },
  ]

  return elements
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 3: PREMIUM EDITORIAL (Matte Obsidian & Vertical Accent - Reference 3)
// ─────────────────────────────────────────────────────────────────────────────

function buildPremiumEditorialFront(
  role: Role,
  event: EventContext,
  logos: { instLogo: string; clubLogo: string },
  category: EventCategory = 'general',
  customPalette?: { primaryColor?: string; accentColor?: string; backgroundColor?: string }
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker' || roleId === 'founder'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor' || roleId === 'investor'
  const isPlayer = roleId === 'player' || roleId === 'artist' || roleId === 'gamer'

  const pal = THEME_COLOR_PALETTES[category] || THEME_COLOR_PALETTES.general
  const obsidianBg = customPalette?.backgroundColor || pal.d3ObsidianBg
  const accentColor = customPalette?.primaryColor || pal.d3Accent

  const fullText = `${event.name?.value || ''} ${(event as any).description?.value || ''}`.toLowerCase()
  const isDance = /(?:dance|dancing|dancer|choreograph|garba|dandiya|ballet|hip\s*hop|salsa|kathak|bhangra)/i.test(fullText)

  const headerCategoryText = isDance
    ? 'DANCE VIP'
    : category === 'music'
    ? 'CONCERT VIP'
    : category === 'business'
    ? 'VENTURE VIP'
    : category === 'gaming'
    ? 'PRO ROSTER'
    : category === 'sports'
    ? 'ATHLETIC PASS'
    : category === 'cultural'
    ? 'CULTURE VIP'
    : category === 'robotics'
    ? 'LAB ACCESS'
    : category === 'conference'
    ? 'DELEGATE PASS'
    : category === 'workshop'
    ? 'COHORT PASS'
    : (event.organizer?.value ? `${event.organizer.value.toUpperCase().slice(0, 10)} PASS` : (event.name?.value ? `${event.name.value.toUpperCase().slice(0, 10)} PASS` : 'EVENT PASS'))

  const serialText = category === 'music'
    ? 'TOUR-{{person.id}}'
    : category === 'business'
    ? 'PITCH-{{person.id}}'
    : category === 'gaming'
    ? 'ROSTER-{{person.id}}'
    : category === 'sports'
    ? 'ROSTER-{{person.id}}'
    : category === 'robotics'
    ? 'UNIT-{{person.id}}'
    : 'ID-{{person.id}}'

  const personDetailContent = category === 'music'
    ? (isOrganizer ? 'Tour & Stage Director' : isJudge ? 'Jury & Soundboard Board' : isSpeaker ? 'Headline Artist & Vocalist' : 'Arena VIP Pass')
    : category === 'business'
    ? (isSpeaker ? 'Founder & Pitch Presenter' : isMentor ? 'Angel & VC Syndicate' : '{{person.team}}')
    : category === 'gaming'
    ? (isPlayer ? 'Squad: {{person.team}}' : 'Tournament Official')
    : category === 'sports'
    ? (isOrganizer ? 'Tournament Executive' : isJudge ? 'Certified Match Official' : isMentor ? 'Tactical Coaching Staff' : isPlayer ? 'Squad: {{person.team}}' : '{{person.team}}')
    : isOrganizer
    ? 'Executive Leadership'
    : isJudge
    ? 'Honorary Jury Member'
    : isSpeaker
    ? 'Keynote Speaker & Author'
    : isVolunteer
    ? 'Operations & Field Crew'
    : isMentor
    ? 'Technical Advisory'
    : '{{person.team}}'

  const roleTextHighlight = role.palette?.primary || accentColor
  const themeMotifs = buildThemeElementsDraft3(category, pal)

  const elements: Element[] = [
    // 1. Warm Editorial Paper Full Background
    {
      type: 'shape',
      id: 'bg-obsidian',
      anchor: { x: 0, y: 0, w: 54, h: 85.6 },
      shape: 'rect',
      fill: '#FAF8F4',
      stroke: '#D9D5C7',
      strokeWidth: 0.45,
      cornerRadius: 0,
      opacity: 1,
    },
    // Thematic background art: spotlights, singer watermark, audience crowd, growth curves, runners
    ...themeMotifs,
    // 2. Lanyard Slot Hole (Ref 3 clasp cut)
    {
      type: 'shape',
      id: 'lanyard-slot',
      anchor: { x: 22, y: 2, w: 10, h: 2.5 },
      shape: 'rect',
      fill: '#E9E5D8',
      stroke: '#D9D5C7',
      strokeWidth: 0.35,
      cornerRadius: 1.25,
      opacity: 1,
    },
    // 3. Asymmetric Offset Rectangular Photo Frame
    {
      type: 'shape',
      id: 'photo-frame-bg',
      anchor: { x: 4, y: 7.5, w: 31, h: 42 },
      shape: 'rect',
      fill: '#E9E5D8',
      stroke: '#D9D5C7',
      strokeWidth: 0.35,
      cornerRadius: 1.2,
      opacity: 1,
    },
    {
      type: 'photo',
      id: 'person-photo',
      anchor: { x: 4, y: 7.5, w: 31, h: 42 },
      binding: '{{person.photoUrl}}',
      shape: 'rounded',
      cornerRadius: 1.2,
      fallback: 'initials',
      initialsBinding: '{{person.name}}',
      initialsColor: '#ffffff',
      initialsBg: role.palette?.primary || accentColor,
    },
    // 4. Striking Solid Vertical Role Accent Block
    {
      type: 'shape',
      id: 'vertical-accent-block',
      anchor: { x: 36.5, y: 10, w: 13.5, h: 46 },
      shape: 'rect',
      fill: accentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 5. Category Header above accent block
    {
      type: 'text',
      id: 'header-category',
      anchor: { x: 36.5, y: 6.2, w: 13.5, h: 3 },
      content: headerCategoryText,
      fontFamily: 'Instrument Serif',
      fontSize: 5.5,
      fontWeight: '400',
      color: '#14201C',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // 7. Compact QR code nested at bottom of the accent block
    {
      type: 'qr',
      id: 'block-qr',
      anchor: { x: 38.5, y: 44.5, w: 9.5, h: 9.5 },
      urlPattern: event.website?.value ? `${event.website.value.replace(/\/$/, '')}/verify/{{person.id}}` : `https://verify.eventpass.live/{{person.id}}`,
      fgColor: '#ffffff',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // 8. Bold Editorial Participant Name
    {
      type: 'text',
      id: 'person-name',
      anchor: { x: 4, y: 51.5, w: 46, h: 8.2 },
      content: '{{person.name}}',
      fontFamily: 'Instrument Serif',
      fontSize: 9.2,
      fontWeight: '400',
      color: '#14201C',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 2,
      minFontSize: 6.5,
    },
    // 9. Role Title
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 4, y: 60.5, w: 46, h: 4.5 },
      content: role.label,
      fontFamily: 'Hanken Grotesk',
      fontSize: 4.8,
      fontWeight: '700',
      color: roleTextHighlight,
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3.5,
    },
    // 10. Secondary Detail (Team / Organization / Track)
    {
      type: 'text',
      id: 'person-team',
      anchor: { x: 4, y: 65.2, w: 46, h: 3.8 },
      content: '{{person.team}}',
      fontFamily: 'Hanken Grotesk',
      fontSize: 3.5,
      fontWeight: '500',
      color: '#4B5651',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 11. Event Name
    {
      type: 'text',
      id: 'event-name',
      anchor: { x: 4, y: 69.5, w: 46, h: 4.5 },
      content: event.name?.value
        ? (event.name.value === event.name.value.toLowerCase() ? event.name.value.replace(/\b\w/g, l => l.toUpperCase()) : event.name.value)
        : 'Event Name',
      fontFamily: 'Hanken Grotesk',
      fontSize: 3.3,
      fontWeight: '400',
      color: '#66706A',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 12. Minimalist Horizontal Line Divider
    {
      type: 'shape',
      id: 'footer-divider',
      anchor: { x: 4, y: 75, w: 46, h: 0.35 },
      shape: 'line',
      fill: 'transparent',
      stroke: '#D9D5C7',
      strokeWidth: 0.35,
      cornerRadius: 0,
      opacity: 1,
    },
    // 13. Official ACM Logo (Top Left — ACM NIT Surat convention)
    {
      type: 'image',
      id: 'acm-logo',
      anchor: { x: 4, y: 6, w: 7.5, h: 7.5 },
      src: logos.clubLogo,
      fit: 'contain',
      cornerRadius: 0,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 14. Official SVNIT Logo (Top Right — institute logo)
    {
      type: 'image',
      id: 'svnit-logo',
      anchor: { x: 42.5, y: 6, w: 7.5, h: 7.5 },
      src: logos.instLogo,
      fit: 'contain',
      cornerRadius: 3.75,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // 15. Event Website URL
    {
      type: 'text',
      id: 'website-url',
      anchor: { x: 22, y: 77.5, w: 28, h: 4 },
      content: event.website?.value || (event.organizer?.value ? `${event.organizer.value.toLowerCase().replace(/[^a-z0-9]/g, '')}.org` : 'eventpass.live'),
      fontFamily: 'Space Grotesk',
      fontSize: 3.2,
      fontWeight: '500',
      color: '#64748b',
      align: 'right',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.2,
    },
  ]

  return elements
}

// ─────────────────────────────────────────────────────────────────────────────
// BACK BADGE BUILDER (Front-and-back badge capability - Reference 2)
// ─────────────────────────────────────────────────────────────────────────────

function buildCardBackElements(
  role: Role,
  event: EventContext,
  logos: { instLogo: string; clubLogo: string },
  style: 'modern-minimal' | 'creative-tech' | 'premium-editorial',
  category: EventCategory = 'general'
): Element[] {
  const isDark = style === 'creative-tech'
  const pal = THEME_COLOR_PALETTES[category] || THEME_COLOR_PALETTES.general
  const bgFill = style === 'creative-tech'
    ? (role.palette?.secondary || pal.d2HeroBg || '#14201C')
    : '#FAF8F4'
  const textColor = isDark ? '#ffffff' : '#14201C'
  const subtextColor = isDark ? '#D9D5C7' : '#66706A'

  const rule1 = category === 'music'
    ? '1. Pass grants admission to concert arena, stage pit, and soundboard areas.'
    : category === 'business'
    ? '1. Pass grants admission to pitch arenas, executive syndicate rooms, and networking lounges.'
    : category === 'gaming'
    ? '1. Pass grants access to tournament battlestations, practice LAN rooms, and main stage.'
    : category === 'sports'
    ? '1. Pass must be visibly worn at all times by roster athletes and officials in the arena.'
    : category === 'cultural'
    ? '1. Festival badge grants entry to designated cultural venues and stage arenas.'
    : category === 'robotics'
    ? '1. Technical badge required for pit-lane entry and arena safety zone access.'
    : category === 'conference'
    ? '1. Delegate pass grants entry to keynote auditoriums and executive sessions.'
    : `1. Badge must be visibly worn at all times within ${event.name?.value ? `${event.name.value} premises` : 'event premises'}.`

  const rule2 = category === 'music'
    ? '2. Identification pass is strictly non-transferable and remains property of event organizers.'
    : category === 'business'
    ? '2. Identification pass is strictly non-transferable and verified at investor gates.'
    : category === 'gaming'
    ? '2. Identification pass is strictly non-transferable and required for roster verification.'
    : category === 'sports'
    ? '2. Unauthorized badge transfer leads to immediate team disqualification.'
    : category === 'cultural'
    ? '2. This identification pass is strictly non-transferable and remains property of event organizers.'
    : category === 'robotics'
    ? '2. All arena safety protocols must be followed by team marshals.'
    : category === 'conference'
    ? '2. Badge must be displayed at all times within conference halls.'
    : `2. This identification pass is strictly non-transferable and remains property of ${event.organizer?.value || (event.name?.value ? `${event.name.value} Committee` : 'the event organizers')}.`

  const rule3 = category === 'music'
    ? '3. Scan QR code at backstage security and technical soundboard checkpoints.'
    : category === 'business'
    ? '3. Scan QR code at pitch stage entrance and VIP investor roundtables.'
    : category === 'gaming'
    ? '3. Scan QR code at tournament referee desks and bracket check-in stations.'
    : category === 'sports'
    ? '3. Scan QR code at field entry checkpoints for roster validation.'
    : category === 'cultural'
    ? '3. Scan QR code for stage verification and event wristband verification.'
    : category === 'robotics'
    ? '3. Scan QR code at technical inspection checkpoints before matches.'
    : category === 'conference'
    ? '3. Scan QR code at networking luncheons and track registration desks.'
    : '3. Scan QR code at security checkpoints for automated access verification.'

  return [
    {
      type: 'shape',
      id: 'back-bg',
      anchor: { x: 0, y: 0, w: 54, h: 85.6 },
      shape: 'rect',
      fill: bgFill,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // Lanyard slot
    {
      type: 'shape',
      id: 'back-lanyard-slot',
      anchor: { x: 22, y: 2.2, w: 10, h: 2.5 },
      shape: 'rect',
      fill: '#E9E5D8',
      stroke: '#D9D5C7',
      strokeWidth: 0.35,
      cornerRadius: 1.25,
      opacity: 1,
    },
    // Logos
    {
      type: 'image',
      id: 'back-svnit-logo',
      anchor: { x: 4, y: 6.5, w: 8, h: 8 },
      src: logos.instLogo,
      fit: 'contain',
      cornerRadius: 4,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    {
      type: 'image',
      id: 'back-acm-logo',
      anchor: { x: 42, y: 6.5, w: 8, h: 8 },
      src: logos.clubLogo,
      fit: 'contain',
      cornerRadius: 0,
      opacity: 1,
      preserveAspectRatio: true,
      isLogo: true,
    },
    // Header title
    {
      type: 'text',
      id: 'back-title',
      anchor: { x: 13, y: 6.5, w: 28, h: 4 },
      content: event.name?.value || 'EVENT PASS',
      fontFamily: 'Instrument Serif',
      fontSize: 4.5,
      fontWeight: '400',
      color: textColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3,
    },
    {
      type: 'text',
      id: 'back-guidelines-heading',
      anchor: { x: 4, y: 17, w: 46, h: 3.5 },
      content: 'TERMS & EVENT GUIDELINES',
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.8,
      fontWeight: '700',
      color: role.palette?.primary || '#0F5C4D',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.2,
    },
    {
      type: 'text',
      id: 'back-rule-1',
      anchor: { x: 4, y: 21.5, w: 46, h: 7 },
      content: rule1,
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.4,
      fontWeight: '400',
      color: subtextColor,
      align: 'left',
      verticalAlign: 'top',
      maxLines: 2,
      minFontSize: 2,
    },
    {
      type: 'text',
      id: 'back-rule-2',
      anchor: { x: 4, y: 29, w: 46, h: 7 },
      content: rule2,
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.4,
      fontWeight: '400',
      color: subtextColor,
      align: 'left',
      verticalAlign: 'top',
      maxLines: 2,
      minFontSize: 2,
    },
    {
      type: 'text',
      id: 'back-rule-3',
      anchor: { x: 4, y: 36.5, w: 46, h: 7 },
      content: rule3,
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.4,
      fontWeight: '400',
      color: subtextColor,
      align: 'left',
      verticalAlign: 'top',
      maxLines: 2,
      minFontSize: 2,
    },
    // Large verified QR code on back
    {
      type: 'qr',
      id: 'back-large-qr',
      anchor: { x: 19, y: 46, w: 16, h: 16 },
      urlPattern: event.website?.value ? `${event.website.value.replace(/\/$/, '')}/verify/{{person.id}}` : `https://verify.eventpass.live/{{person.id}}`,
      fgColor: isDark ? '#ffffff' : '#14201C',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // Scan instructions
    {
      type: 'text',
      id: 'back-scan-hint',
      anchor: { x: 4, y: 63, w: 46, h: 3 },
      content: 'SCAN TO VERIFY CREDENTIALS',
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.5,
      fontWeight: '600',
      color: role.palette?.primary || '#0F5C4D',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // Emergency contact
    {
      type: 'text',
      id: 'back-emergency-header',
      anchor: { x: 4, y: 67.5, w: 46, h: 3 },
      content: 'EMERGENCY / HELPDESK',
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.4,
      fontWeight: '700',
      color: subtextColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    {
      type: 'text',
      id: 'back-emergency-val',
      anchor: { x: 4, y: 70.8, w: 46, h: 3.5 },
      content: event.contact?.value || (event.organizer?.value ? `contact@${event.organizer.value.toLowerCase().replace(/[^a-z0-9]/g, '')}.org` : 'helpdesk@eventpass.live'),
      fontFamily: 'Hanken Grotesk',
      fontSize: 2.5,
      fontWeight: '500',
      color: textColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // Barcode at bottom of back
    {
      type: 'barcode',
      id: 'back-barcode',
      anchor: { x: 8, y: 75, w: 38, h: 7 },
      valueBinding: '{{person.id}}',
      format: 'CODE128',
      fgColor: isDark ? '#ffffff' : '#14201C',
      bgColor: 'transparent',
    },
    // Copyright
    {
      type: 'text',
      id: 'back-copyright',
      anchor: { x: 2, y: 83, w: 50, h: 2.2 },
      content: `© ${new Date().getFullYear()} ${event.organizer?.value || (event.name?.value ? `${event.name.value} Organizing Team` : 'Event Organizing Committee')}`,
      fontFamily: 'Hanken Grotesk',
      fontSize: 1.9,
      fontWeight: '400',
      color: subtextColor,
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 1.6,
    },
  ]
}

const CATEGORY_METADATA: Record<EventCategory, {
  d1Name: (name: string) => string
  d1Desc: string
  d1Tags: string[]
  d2Name: (name: string) => string
  d2Desc: string
  d2Tags: string[]
  d3Name: (name: string) => string
  d3Desc: string
  d3Tags: string[]
}> = {
  sports: {
    d1Name: n => `Athletic Dual-Tone — ${n}`,
    d1Desc: 'High-contrast athletic badge with dynamic split framing, participant roster tagging, and tournament verification QR.',
    d1Tags: ['sports', 'athletic', 'tournament', 'championship', 'clean'],
    d2Name: n => `Dynamic Arena Pass — ${n}`,
    d2Desc: 'Energetic sports pass with athletic speed chevrons, bold chevron divider, and stadium credentials.',
    d2Tags: ['sports', 'arena', 'dynamic', 'chevron', 'scannable', 'match-day'],
    d3Name: n => `Championship Editorial — ${n}`,
    d3Desc: 'Bold sports credential with asymmetric player portrait, competition accent bar, and official roster verification.',
    d3Tags: ['sports', 'editorial', 'championship', 'prestige', 'roster'],
  },
  hackathon: {
    d1Name: n => `Modern Minimal — ${n}`,
    d1Desc: 'Clean dual-tone vertical badge with circular ring portrait, lanyard badge slot, and balanced typography.',
    d1Tags: ['minimal', 'dual-tone', 'vertical-split', 'lanyard-badge', 'hackathon'],
    d2Name: n => `Creative Tech — ${n}`,
    d2Desc: 'Scientific and geometric tech badge with hexagon molecular network, glowing halo avatar, chevron divider, and verification QR code.',
    d2Tags: ['creative', 'tech', 'hexagons', 'chevron', 'scannable', 'hackathon'],
    d3Name: n => `Premium Editorial — ${n}`,
    d3Desc: 'Clean warm editorial card with bold asymmetric rectangular photo framing, striking vertical accent block, and editorial typography.',
    d3Tags: ['editorial', 'asymmetric', 'matte-obsidian', 'editorial-paper', 'accent-block', 'prestige', 'hackathon'],
  },
  robotics: {
    d1Name: n => `Engineering Precision — ${n}`,
    d1Desc: 'Precision technical badge with geometric dual-tone layout, engineering badges, and automated verification.',
    d1Tags: ['robotics', 'engineering', 'precision', 'minimal', 'hardware'],
    d2Name: n => `Telemetry Grid — ${n}`,
    d2Desc: 'Robotics lab credential with telemetry caliper brackets, technical circuit accents, and technical accreditation QR.',
    d2Tags: ['robotics', 'telemetry', 'circuits', 'scannable', 'tech'],
    d3Name: n => `Lab Accreditation — ${n}`,
    d3Desc: 'Warm editorial research credential with asymmetric photo frame, telemetry accent bar, and laboratory accreditation.',
    d3Tags: ['robotics', 'lab', 'accreditation', 'editorial', 'prestige'],
  },
  conference: {
    d1Name: n => `Executive Symposium — ${n}`,
    d1Desc: 'Sophisticated executive badge with dual-tone layout, prestigious delegate credentials, and scannable verification.',
    d1Tags: ['conference', 'summit', 'executive', 'delegate', 'minimal'],
    d2Name: n => `Summit Diamond Crest — ${n}`,
    d2Desc: 'Prestigious conference badge with geometric crest accents, chevron divider, and keynote session credentials.',
    d2Tags: ['conference', 'summit', 'crest', 'keynote', 'scannable'],
    d3Name: n => `Prestigious Delegate — ${n}`,
    d3Desc: 'Premium editorial delegate pass with asymmetric portrait framing, champagne accent bar, and executive branding.',
    d3Tags: ['conference', 'delegate', 'editorial-paper', 'editorial', 'vip'],
  },
  cultural: {
    d1Name: n => `Festive Radiance — ${n}`,
    d1Desc: 'Celebratory festival badge with dynamic split styling, colorful role badge, and festival access QR code.',
    d1Tags: ['cultural', 'fest', 'radiance', 'arts', 'celebration'],
    d2Name: n => `Celebration Mosaic — ${n}`,
    d2Desc: 'Vibrant cultural identity card with festive star diamond motifs, chevron apex, and festival access QR.',
    d2Tags: ['cultural', 'festive', 'mosaic', 'celebration', 'scannable'],
    d3Name: n => `Artisan VIP Pass — ${n}`,
    d3Desc: 'Warm editorial festival pass with asymmetric artist portrait framing, vibrant accent block, and stage accreditation.',
    d3Tags: ['cultural', 'artisan', 'editorial', 'artist-pass', 'vip'],
  },
  business: {
    d1Name: n => `Venture Pitch — ${n}`,
    d1Desc: 'Executive startup pitch badge with pitch presenter silhouette, venture growth trajectory, and investor audience watermark.',
    d1Tags: ['business', 'pitch', 'shark-tank', 'startup', 'investor', 'executive'],
    d2Name: n => `Venture Capital Pass — ${n}`,
    d2Desc: 'High-stakes founder & investor credential with summit rays, growth metrics, chevron apex, and executive verification QR.',
    d2Tags: ['business', 'venture', 'founder', 'investor', 'growth', 'scannable'],
    d3Name: n => `Angel Syndicate VIP — ${n}`,
    d3Desc: 'Premium editorial executive pass with asymmetric portrait framing, champagne gold accent bar, and venture verification.',
    d3Tags: ['business', 'syndicate', 'angel', 'executive', 'editorial', 'vip'],
  },
  gaming: {
    d1Name: n => `Esports Arena — ${n}`,
    d1Desc: 'High-energy esports tournament badge with cyber neon split, gamer battlestation silhouette, arena lasers, and audience crowd.',
    d1Tags: ['gaming', 'esports', 'tournament', 'cyber', 'arena', 'gamer'],
    d2Name: n => `Cyber Battlestation — ${n}`,
    d2Desc: 'Futuristic gaming credential with laser matrix grid, halo avatar framing, battlestation watermark, and arena access QR.',
    d2Tags: ['gaming', 'battlestation', 'neon', 'cyber', 'scannable'],
    d3Name: n => `Pro Roster VIP — ${n}`,
    d3Desc: 'Editorial esports pass with asymmetric gamer portrait framing, electric violet accent bar, and tournament accreditation.',
    d3Tags: ['gaming', 'pro-roster', 'editorial', 'editorial-paper', 'tournament'],
  },
  music: {
    d1Name: n => `Live Concert Arena — ${n}`,
    d1Desc: 'Live concert stage pass with stage singer silhouette, cheering audience crowd, sweeping spotlights, and dynamic audio equalizer waveforms.',
    d1Tags: ['music', 'concert', 'singer', 'crowd', 'spotlight', 'live'],
    d2Name: n => `Neon Soundwave — ${n}`,
    d2Desc: 'High-voltage musical identity pass with dual stage lasers, concentric vinyl grooves, floating notes, and cheering audience silhouette.',
    d2Tags: ['music', 'concert', 'neon', 'soundwave', 'equalizer', 'lasers'],
    d3Name: n => `VIP Backstage Laminate — ${n}`,
    d3Desc: 'Exclusive backstage tour laminate with editorial stage depth, singer silhouette watermark, radiant accent block, and arena crowd horizon.',
    d3Tags: ['music', 'vip', 'backstage', 'tour-pass', 'editorial', 'concert'],
  },
  workshop: {
    d1Name: n => `Academic Minimal — ${n}`,
    d1Desc: 'Clean educational credential with dual-tone layout, cohort details, and verification badge.',
    d1Tags: ['workshop', 'academic', 'training', 'bootcamp', 'minimal'],
    d2Name: n => `Bootcamp Cohort Pass — ${n}`,
    d2Desc: 'Structured learning credential with technical motifs, chevron accent, and attendance verification QR.',
    d2Tags: ['workshop', 'cohort', 'bootcamp', 'scannable', 'learning'],
    d3Name: n => `Editorial Scholar — ${n}`,
    d3Desc: 'Warm scholar credential with asymmetric portrait framing, cohort accent bar, and masterclass certification.',
    d3Tags: ['workshop', 'scholar', 'editorial', 'masterclass', 'certification'],
  },
  general: {
    d1Name: n => `Modern Minimal — ${n}`,
    d1Desc: 'Clean dual-tone vertical badge with circular ring portrait, lanyard badge slot, and balanced typography.',
    d1Tags: ['minimal', 'dual-tone', 'vertical-split', 'lanyard-badge', 'clean'],
    d2Name: n => `Creative Tech — ${n}`,
    d2Desc: 'Scientific and geometric badge with molecular network, glowing halo avatar, chevron divider, and verification QR code.',
    d2Tags: ['creative', 'geometric', 'chevron', 'scannable', 'modern'],
    d3Name: n => `Premium Editorial — ${n}`,
    d3Desc: 'Clean warm editorial card with bold asymmetric rectangular photo framing, striking vertical accent block, and editorial typography.',
    d3Tags: ['editorial', 'asymmetric', 'editorial-paper', 'accent-block', 'prestige'],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER DETERMINISTIC GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateDraftsDeterministic(
  event: EventContext,
  roles: (Role | string)[],
  logos?: { instituteLogo?: string; clubLogo?: string },
  llmSuggestions?: any,
  seed = 1,
  excludedPairs: string[] = []
): CardTemplate[] {
  const rawRoles = roles && roles.length > 0 ? roles : DEFAULT_ROLES
  const effectiveRoles: Role[] = rawRoles.map(r => {
    if (typeof r === 'string') return getRoleOrDefault(r)
    if (!r.palette) return getRoleOrDefault(r.id)
    return r
  })
  const instLogo = logos?.instituteLogo || DEFAULT_SVNIT_LOGO
  const clubLogo = logos?.clubLogo || DEFAULT_ACM_LOGO
  const logoBag = { instLogo, clubLogo }
  const eventName = event.name?.value || 'Event Name'

  const category: EventCategory = (
    (llmSuggestions?.category && ['music', 'business', 'sports', 'hackathon', 'robotics', 'cultural', 'conference', 'gaming', 'workshop', 'general'].includes(llmSuggestions.category))
      ? llmSuggestions.category
      : detectEventCategory(event)
  )

  const meta = CATEGORY_METADATA[category] || CATEGORY_METADATA.general

  // Dynamic LLM proposal overrides if provided
  const llmD1 = Array.isArray(llmSuggestions?.drafts)
    ? llmSuggestions.drafts.find((d: any) => d.id === 'modern-minimal' || d.layoutId === 'bold-band') || llmSuggestions.drafts[0]
    : null
  const llmD2 = Array.isArray(llmSuggestions?.drafts)
    ? llmSuggestions.drafts.find((d: any) => d.id === 'creative-tech' || d.layoutId === 'modern-gradient' || d.id === 'bold-dynamic') || llmSuggestions.drafts[1]
    : null
  const llmD3 = Array.isArray(llmSuggestions?.drafts)
    ? llmSuggestions.drafts.find((d: any) => d.id === 'premium-editorial' || d.layoutId === 'minimal-clean') || llmSuggestions.drafts[2]
    : null

  const fullText = `${eventName} ${(event as any).description?.value || ''} ${(event as any).themeHint?.value || ''} ${(event as any).category?.value || ''}`
  const baseHue = extractBaseHue(fullText, (event as any).brandPrimary)

  // Apply seed offset for regeneration variety (rotating hues)
  const seedShift = ((seed - 1) * 55) % 360
  const effectiveBaseHue = (baseHue + seedShift) % 360

  // Derive 3 themes with distinct harmony schemes guaranteeing hue distance >= MIN_HUE_DISTANCE
  const theme1: Theme = llmD1?.theme || (llmD1?.primaryColor ? {
    background: llmD1.backgroundColor || '#FAF8F4',
    surface: '#ffffff',
    primary: llmD1.primaryColor,
    secondary: llmD1.accentColor || '#14201C',
    accent: llmD1.accentColor || llmD1.primaryColor,
    text: '#14201C',
    mutedText: '#66706A',
    onAccent: '#ffffff',
  } : generateThemeFromHue(effectiveBaseHue, 'analogous'))

  const theme2: Theme = llmD2?.theme || (llmD2?.primaryColor ? {
    background: llmD2.backgroundColor || '#FAF8F4',
    surface: '#ffffff',
    primary: llmD2.primaryColor,
    secondary: llmD2.accentColor || '#14201C',
    accent: llmD2.accentColor || llmD2.primaryColor,
    text: '#14201C',
    mutedText: '#66706A',
    onAccent: '#ffffff',
  } : generateThemeFromHue((effectiveBaseHue + 120) % 360, 'complementary'))

  const theme3: Theme = llmD3?.theme || (llmD3?.primaryColor ? {
    background: llmD3.backgroundColor || '#FAF8F4',
    surface: '#ffffff',
    primary: llmD3.primaryColor,
    secondary: llmD3.accentColor || '#14201C',
    accent: llmD3.accentColor || llmD3.primaryColor,
    text: '#14201C',
    mutedText: '#66706A',
    onAccent: '#ffffff',
  } : generateThemeFromHue((effectiveBaseHue + 240) % 360, 'triadic'))

  const draft1Tokens = {
    primaryColor: theme1.primary,
    accentColor: theme1.accent,
    backgroundColor: theme1.background,
    artworkPrompt: llmD1?.artworkPrompt || `${eventName}: ${(event as any).description?.value || ''}`,
  }
  const draft2Tokens = {
    primaryColor: theme2.primary,
    accentColor: theme2.accent,
    backgroundColor: theme2.background,
    artworkPrompt: llmD2?.artworkPrompt || `${eventName}: ${(event as any).description?.value || ''}`,
  }
  const draft3Tokens = {
    primaryColor: theme3.primary,
    accentColor: theme3.accent,
    backgroundColor: theme3.background,
    artworkPrompt: llmD3?.artworkPrompt || `${eventName}: ${(event as any).description?.value || ''}`,
  }

  // Build role elements for each draft family
  const draft1RoleFront: Record<string, Element[]> = {}
  const draft1RoleBack: Record<string, Element[]> = {}

  const draft2RoleFront: Record<string, Element[]> = {}
  const draft2RoleBack: Record<string, Element[]> = {}

  const draft3RoleFront: Record<string, Element[]> = {}
  const draft3RoleBack: Record<string, Element[]> = {}

  effectiveRoles.forEach(r => {
    draft1RoleFront[r.id] = buildModernMinimalFront(r, event, logoBag, category, draft1Tokens)
    draft1RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'modern-minimal', category)

    draft2RoleFront[r.id] = buildCreativeTechFront(r, event, logoBag, category, draft2Tokens)
    draft2RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'creative-tech', category)

    draft3RoleFront[r.id] = buildPremiumEditorialFront(r, event, logoBag, category, draft3Tokens)
    draft3RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'premium-editorial', category)
  })

  // Select participant or player role as default face
  const defaultRole = effectiveRoles.find(r => r.id === 'participant' || r.id === 'player') || effectiveRoles[0]

  // Draft 1: Modern Minimal (Dual-Tone Vertical)
  const draft1: CardTemplate = {
    id: 'modern-minimal',
    name: llmD1?.name ? `${llmD1.name} — ${eventName}` : meta.d1Name(eventName),
    designType: 'idCard',
    description: llmD1?.description || meta.d1Desc,
    version: 5,
    size: {
      name: 'CR80 (Standard ID 54x86mm)',
      widthMm: 54,
      heightMm: 85.6,
      bleedMm: 3,
      safeMarginMm: 3,
    },
    orientation: 'portrait',
    hasFrontBack: true,
    archetype: 'modern-minimal',
    tags: meta.d1Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft1RoleFront[defaultRole.id],
    backElements: draft1RoleBack[defaultRole.id],
    roleElements: draft1RoleFront,
    roleBackElements: draft1RoleBack,
    tokens: draft1Tokens,
    theme: theme1,
  }

  // Draft 2: Creative Dynamic (Chevron Banner & Visual Motifs)
  const draft2: CardTemplate = {
    id: 'creative-tech',
    name: llmD2?.name ? `${llmD2.name} — ${eventName}` : meta.d2Name(eventName),
    designType: 'idCard',
    description: llmD2?.description || meta.d2Desc,
    version: 5,
    size: {
      name: 'CR80 (Standard ID 54x86mm)',
      widthMm: 54,
      heightMm: 85.6,
      bleedMm: 3,
      safeMarginMm: 3,
    },
    orientation: 'portrait',
    hasFrontBack: true,
    archetype: 'creative-tech',
    tags: meta.d2Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft2RoleFront[defaultRole.id],
    backElements: draft2RoleBack[defaultRole.id],
    roleElements: draft2RoleFront,
    roleBackElements: draft2RoleBack,
    tokens: draft2Tokens,
    theme: theme2,
  }

  // Draft 3: Premium Editorial (Matte Obsidian & Accent Block)
  const draft3: CardTemplate = {
    id: 'premium-editorial',
    name: llmD3?.name ? `${llmD3.name} — ${eventName}` : meta.d3Name(eventName),
    designType: 'idCard',
    description: llmD3?.description || meta.d3Desc,
    version: 5,
    size: {
      name: 'CR80 (Standard ID 54x86mm)',
      widthMm: 54,
      heightMm: 85.6,
      bleedMm: 3,
      safeMarginMm: 3,
    },
    orientation: 'portrait',
    hasFrontBack: true,
    archetype: 'premium-editorial',
    tags: meta.d3Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft3RoleFront[defaultRole.id],
    backElements: draft3RoleBack[defaultRole.id],
    roleElements: draft3RoleFront,
    roleBackElements: draft3RoleBack,
    tokens: draft3Tokens,
    theme: theme3,
  }

  const allDrafts = [draft1, draft2, draft3]
  if (seed > 1) {
    const rot = (seed - 1) % 3
    return [
      allDrafts[rot],
      allDrafts[(rot + 1) % 3],
      allDrafts[(rot + 2) % 3],
    ]
  }

  return allDrafts
}

// ─────────────────────────────────────────────────────────────────────────────
// NATURAL LANGUAGE REFINEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function applyNlRefinement(
  template: CardTemplate,
  instruction: string
): Promise<CardTemplate> {
  const originalJson = JSON.stringify(template)
  try {
    const res = await fetch('/api/llm/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, instruction }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const patched = await res.json() as CardTemplate
    // If LLM returned empty, invalid, or untouched template, fallback to deterministic
    if (!patched || !patched.elements || JSON.stringify(patched) === originalJson) {
      return applyDeterministicRefinement(template, instruction)
    }
    return {
      ...patched,
      id: template.id,
      version: (template.version || 1) + 1,
    }
  } catch {
    return applyDeterministicRefinement(template, instruction)
  }
}

export function applyDeterministicRefinement(template: CardTemplate, instruction: string): CardTemplate {
  const lower = instruction.toLowerCase().trim()
  const isPortrait = template.orientation === 'portrait'
  const cardW = isPortrait ? Math.min(template.size.widthMm, template.size.heightMm) : Math.max(template.size.widthMm, template.size.heightMm)
  const cardH = isPortrait ? Math.max(template.size.widthMm, template.size.heightMm) : Math.min(template.size.widthMm, template.size.heightMm)

  // 1. Detect requested intents
  const wantsDarker = /dark(?:er)?|black|obsidian|night|dim|shadow|dark\s*theme|dark\s*mode/.test(lower)
  const wantsLighter = /light(?:er)?|white|clean|paper|cream|bright|light\s*theme|light\s*mode/.test(lower)
  const wantsWarmer = /warm(?:er)?|sunset|amber|terracotta|golden/.test(lower)
  const wantsMinimal = /minimal|minimalist|cleaner|simple|simplify/.test(lower)

  // Color accents
  const wantsBlue   = /\b(?:blue|cyan|azure|navy|indigo|cobalt)\b/.test(lower)
  const wantsGreen  = /\b(?:green|emerald|teal|mint|forest)\b/.test(lower)
  const wantsPurple = /\b(?:purple|violet|magenta|plum)\b/.test(lower)
  const wantsRed    = /\b(?:red|crimson|ruby|scarlet|coral)\b/.test(lower)
  const wantsOrange = /\b(?:orange|amber|tangerine)\b/.test(lower)
  const wantsGold   = /\b(?:gold|golden|yellow)\b/.test(lower)

  // Photo adjustments
  const wantsBiggerPhoto  = /bigger\s+photo|large(?:r)?\s+photo|increase\s+photo|expand\s+photo|zoom\s+photo|scale\s+photo\s+up|huge\s+photo/.test(lower)
  const wantsSmallerPhoto = /smaller\s+photo|tiny\s+photo|decrease\s+photo|reduce\s+photo|scale\s+photo\s+down/.test(lower)
  const wantsPhotoUp      = /move\s+photo\s+up|photo\s+up|higher\s+photo|raise\s+photo/.test(lower)
  const wantsPhotoDown    = /move\s+photo\s+down|photo\s+down|lower\s+photo/.test(lower)
  const wantsSquarePhoto  = /square\s+photo|rect(?:angle)?\s+photo/.test(lower)
  const wantsCirclePhoto  = /circle\s+photo|circular\s+photo|round\s+photo/.test(lower)
  const wantsRoundedPhoto = /rounded\s+photo|rounded\s+corners?\s+photo/.test(lower)

  // Logo adjustments
  const wantsCenterLogo  = /logo.*center|center.*logo|middle.*logo|logo.*middle/.test(lower)
  const wantsLeftLogo    = /logo.*left|left.*logo/.test(lower)
  const wantsRightLogo   = /logo.*right|right.*logo/.test(lower)
  const wantsBiggerLogo  = /bigger\s+logo|large(?:r)?\s+logo/.test(lower)
  const wantsSmallerLogo = /smaller\s+logo|tiny\s+logo/.test(lower)

  // Typography / Name adjustments
  const wantsBiggerName   = /bigger\s+name|large(?:r)?\s+name|increase\s+name|bold\s+name|big\s+name/.test(lower)
  const wantsSmallerName  = /smaller\s+name|reduce\s+name/.test(lower)
  const wantsBiggerFont   = /bigger\s+font|large(?:r)?\s+(?:text|font)|increase\s+(?:font|text)|larger/.test(lower)
  const wantsSmallerFont  = /smaller\s+(?:font|text)|reduce\s+(?:font|text)|compact\s+(?:font|text)/.test(lower)
  const wantsTextUp       = /move\s+(?:name|text)\s+up|(?:name|text)\s+up|higher\s+(?:name|text)/.test(lower)
  const wantsTextDown     = /move\s+(?:name|text)\s+down|(?:name|text)\s+down|lower\s+(?:name|text)/.test(lower)

  // QR Code adjustments
  const wantsBiggerQR  = /bigger\s+qr|large(?:r)?\s+qr/.test(lower)
  const wantsSmallerQR = /smaller\s+qr|tiny\s+qr|reduce\s+qr/.test(lower)
  const wantsCenterQR  = /qr.*center|center.*qr/.test(lower)
  const wantsHideQR    = /hide\s+qr|remove\s+qr|no\s+qr/.test(lower)

  let targetAccent: string | null = null
  if (wantsBlue) targetAccent = '#0284C7'
  else if (wantsGreen) targetAccent = '#059669'
  else if (wantsPurple) targetAccent = '#7C3AED'
  else if (wantsRed) targetAccent = '#DC2626'
  else if (wantsOrange) targetAccent = '#EA580C'
  else if (wantsGold) targetAccent = '#D97706'

  let newTheme: Theme = template.theme ? { ...template.theme } : {
    background: '#FAF8F4',
    surface: '#ffffff',
    primary: '#0F5C4D',
    secondary: '#14201C',
    accent: '#0F5C4D',
    text: '#14201C',
    mutedText: '#66706A',
    onAccent: '#ffffff',
  }

  if (wantsDarker && !wantsLighter) {
    newTheme = {
      ...newTheme,
      background: '#0B0F19',
      surface: '#151D2C',
      text: '#F8FAFC',
      mutedText: '#94A3B8',
    }
  } else if (wantsLighter && !wantsDarker) {
    newTheme = {
      ...newTheme,
      background: '#FAF8F4',
      surface: '#FFFFFF',
      text: '#0F172A',
      mutedText: '#64748B',
    }
  } else if (wantsWarmer) {
    newTheme = {
      ...newTheme,
      background: '#FFFBEB',
      surface: '#FEF3C7',
      primary: '#D97706',
      accent: '#B45309',
      text: '#78350F',
      mutedText: '#92400E',
    }
  } else if (wantsMinimal) {
    newTheme = {
      ...newTheme,
      background: '#FFFFFF',
      surface: '#F8FAFC',
      mutedText: '#94A3B8',
    }
  }
  if (targetAccent) {
    newTheme = {
      ...newTheme,
      primary: targetAccent,
      accent: targetAccent,
    }
  }

  // Generic fallback: if no known keywords matched, apply subtle layout polish & contrast
  const isGenericEdit = !wantsDarker && !wantsLighter && !wantsWarmer && !wantsMinimal && !targetAccent && !wantsBiggerPhoto && !wantsSmallerPhoto &&
    !wantsPhotoUp && !wantsPhotoDown && !wantsSquarePhoto && !wantsCirclePhoto && !wantsRoundedPhoto &&
    !wantsCenterLogo && !wantsLeftLogo && !wantsRightLogo && !wantsBiggerLogo && !wantsSmallerLogo &&
    !wantsBiggerName && !wantsSmallerName && !wantsBiggerFont && !wantsSmallerFont && !wantsTextUp && !wantsTextDown &&
    !wantsBiggerQR && !wantsSmallerQR && !wantsCenterQR && !wantsHideQR

  const patchElement = (el: Element): Element => {
    const patched = { ...el, anchor: { ...el.anchor } }

    // 1. Darker Theme
    if (wantsDarker && !wantsLighter) {
      if (patched.type === 'shape') {
        const fill = (patched.fill || '').toLowerCase()
        const isBgShape = patched.anchor.w >= cardW * 0.45 || patched.anchor.h >= cardH * 0.25 ||
          patched.id.includes('bg') || patched.id.includes('hero') || patched.id.includes('card')
        if (isBgShape) {
          if (fill === '#ffffff' || fill === '#faf8f4' || fill === '#f8fafc' || fill === '#e9e5d8' || fill === '#f1f5f9' || fill === 'white' || !fill) {
            patched.fill = '#0B0F19'
          } else if (fill === '#14201c' || fill === '#0f172a' || fill === '#1e293b') {
            patched.fill = '#05070D'
          }
        }
        if (patched.stroke && (patched.stroke.toLowerCase() === '#d9d5c7' || patched.stroke.toLowerCase() === '#cbd5e1')) {
          patched.stroke = '#1E293B'
        }
      } else if (patched.type === 'text') {
        const col = (patched.color || '').toLowerCase()
        if (col === '#14201c' || col === '#0f172a' || col === '#334155' || col === '#1e293b' || col === '#000000' || col === '#66706a') {
          patched.color = '#F8FAFC'
        }
      }
    }

    // 2. Lighter Theme
    if (wantsLighter && !wantsDarker) {
      if (patched.type === 'shape') {
        const fill = (patched.fill || '').toLowerCase()
        const isBgShape = patched.anchor.w >= cardW * 0.45 || patched.anchor.h >= cardH * 0.25 ||
          patched.id.includes('bg') || patched.id.includes('hero') || patched.id.includes('card')
        if (isBgShape) {
          if (fill === '#0b0f19' || fill === '#05070d' || fill === '#14201c' || fill === '#090a10' || fill === '#0f172a') {
            patched.fill = '#FAF8F4'
          }
        }
        if (patched.stroke && (patched.stroke.toLowerCase() === '#1e293b' || patched.stroke.toLowerCase() === '#334155')) {
          patched.stroke = '#E2E8F0'
        }
      } else if (patched.type === 'text') {
        const col = (patched.color || '').toLowerCase()
        if (col === '#ffffff' || col === '#f8fafc' || col === '#f1f5f9') {
          patched.color = '#0F172A'
        }
      }
    }

    // 3. Color Accent changes
    if (targetAccent) {
      if (patched.type === 'shape') {
        if (patched.id.includes('slash') || patched.id.includes('pill') || patched.id.includes('accent') || patched.id.includes('bar') || patched.id.includes('strip')) {
          patched.fill = targetAccent
        }
        if (patched.stroke && patched.stroke !== 'transparent' && patched.stroke !== 'none') {
          if (patched.id.includes('photo-ring') || patched.id.includes('halo') || patched.id.includes('accent')) {
            patched.stroke = targetAccent
          }
        }
      } else if (patched.type === 'text') {
        if (patched.id.includes('role') || patched.id.includes('badge') || patched.id.includes('highlight') || patched.id.includes('accent')) {
          if (!patched.id.includes('pill')) {
            patched.color = targetAccent
          }
        }
      } else if (patched.type === 'photo') {
        patched.initialsBg = targetAccent
      }
    }

    // 4. Photo Size Adjustments
    if (wantsBiggerPhoto) {
      if (patched.type === 'photo' || patched.id === 'photo-ring' || patched.id === 'halo-ring' || patched.id === 'photo-frame-bg') {
        const scale = 1.18
        const oldW = patched.anchor.w
        const oldH = patched.anchor.h
        const newW = oldW * scale
        const newH = oldH * scale
        const isNearCenter = Math.abs(patched.anchor.x + oldW / 2 - cardW / 2) < 4
        const newX = isNearCenter ? (cardW - newW) / 2 : patched.anchor.x - (newW - oldW) / 2
        const newY = patched.anchor.y - (newH - oldH) * 0.4
        patched.anchor = { ...patched.anchor, x: Math.max(1, newX), y: Math.max(1, newY), w: newW, h: newH }
        if (patched.type === 'photo' && patched.shape === 'circle') {
          patched.cornerRadius = newW / 2
        }
      }
    } else if (wantsSmallerPhoto) {
      if (patched.type === 'photo' || patched.id === 'photo-ring' || patched.id === 'halo-ring' || patched.id === 'photo-frame-bg') {
        const scale = 0.85
        const oldW = patched.anchor.w
        const oldH = patched.anchor.h
        const newW = oldW * scale
        const newH = oldH * scale
        const isNearCenter = Math.abs(patched.anchor.x + oldW / 2 - cardW / 2) < 4
        const newX = isNearCenter ? (cardW - newW) / 2 : patched.anchor.x + (oldW - newW) / 2
        const newY = patched.anchor.y + (oldH - newH) * 0.4
        patched.anchor = { ...patched.anchor, x: newX, y: newY, w: newW, h: newH }
        if (patched.type === 'photo' && patched.shape === 'circle') {
          patched.cornerRadius = newW / 2
        }
      }
    }

    // 5. Photo Position Adjustments
    if (wantsPhotoUp) {
      if (patched.type === 'photo' || patched.id === 'photo-ring' || patched.id === 'halo-ring' || patched.id === 'photo-frame-bg') {
        patched.anchor.y = Math.max(2, patched.anchor.y - 4)
      }
    } else if (wantsPhotoDown) {
      if (patched.type === 'photo' || patched.id === 'photo-ring' || patched.id === 'halo-ring' || patched.id === 'photo-frame-bg') {
        patched.anchor.y = patched.anchor.y + 4
      }
    }

    // 6. Photo Shape Adjustments
    if (patched.type === 'photo') {
      if (wantsSquarePhoto) {
        patched.shape = 'square'
        patched.cornerRadius = 0
      } else if (wantsCirclePhoto) {
        patched.shape = 'circle'
        patched.cornerRadius = patched.anchor.w / 2
      } else if (wantsRoundedPhoto) {
        patched.shape = 'rounded'
        patched.cornerRadius = 3.5
      }
    }

    // 7. Logo Position & Alignment
    if ((patched as any).isLogo || patched.id.includes('logo')) {
      if (wantsCenterLogo) {
        if (patched.id === 'acm-logo') {
          patched.anchor.x = 15.5
          patched.anchor.y = 4.5
        } else if (patched.id === 'svnit-logo') {
          patched.anchor.x = 29.5
          patched.anchor.y = 4.5
        } else {
          patched.anchor.x = (cardW - patched.anchor.w) / 2
        }
      } else if (wantsLeftLogo) {
        patched.anchor.x = 3.5
      } else if (wantsRightLogo) {
        patched.anchor.x = cardW - patched.anchor.w - 3.5
      }

      if (wantsBiggerLogo) {
        const sc = 1.25
        patched.anchor.w = patched.anchor.w * sc
        patched.anchor.h = patched.anchor.h * sc
      } else if (wantsSmallerLogo) {
        const sc = 0.8
        patched.anchor.w = patched.anchor.w * sc
        patched.anchor.h = patched.anchor.h * sc
      }
    }

    // 8. Typography & Name Adjustments
    if (patched.type === 'text') {
      const isName = patched.id.includes('name') || patched.content.includes('person.name')
      if (isName) {
        if (wantsBiggerName || wantsBiggerFont) {
          patched.fontSize = (patched.fontSize || 9) * 1.2
        } else if (wantsSmallerName || wantsSmallerFont) {
          patched.fontSize = (patched.fontSize || 9) * 0.85
        }
        if (wantsTextUp) {
          patched.anchor.y = Math.max(10, patched.anchor.y - 3.5)
        } else if (wantsTextDown) {
          patched.anchor.y = patched.anchor.y + 3.5
        }
      } else {
        if (wantsBiggerFont) {
          patched.fontSize = (patched.fontSize || 3) * 1.15
        } else if (wantsSmallerFont) {
          patched.fontSize = (patched.fontSize || 3) * 0.88
        }
        if (wantsTextUp && patched.anchor.y > 45) {
          patched.anchor.y = Math.max(10, patched.anchor.y - 3.5)
        } else if (wantsTextDown && patched.anchor.y > 45) {
          patched.anchor.y = patched.anchor.y + 3.5
        }
      }
    }

    // 9. Role Pill position sync
    if (patched.id === 'role-pill-bg') {
      if (wantsTextUp) {
        patched.anchor.y = Math.max(10, patched.anchor.y - 3.5)
      } else if (wantsTextDown) {
        patched.anchor.y = patched.anchor.y + 3.5
      }
    }

    // 10. QR Code Adjustments
    if (patched.type === 'qr' || patched.id.includes('qr')) {
      if (wantsBiggerQR) {
        const sc = 1.25
        const oldW = patched.anchor.w
        const newW = oldW * sc
        patched.anchor.w = newW
        patched.anchor.h = newW
        if (Math.abs(patched.anchor.x + oldW / 2 - cardW / 2) < 4) {
          patched.anchor.x = (cardW - newW) / 2
        }
      } else if (wantsSmallerQR) {
        const sc = 0.8
        const oldW = patched.anchor.w
        const newW = oldW * sc
        patched.anchor.w = newW
        patched.anchor.h = newW
        if (Math.abs(patched.anchor.x + oldW / 2 - cardW / 2) < 4) {
          patched.anchor.x = (cardW - newW) / 2
        }
      }
      if (wantsCenterQR) {
        patched.anchor.x = (cardW - patched.anchor.w) / 2
      }
      if (wantsHideQR) {
        (patched as any).opacity = 0
      }
    }

    // 11. Generic polish if unlisted natural language instruction was provided
    if (isGenericEdit) {
      if (patched.type === 'text' && (patched.id.includes('name') || patched.content.includes('person.name'))) {
        patched.fontSize = (patched.fontSize || 9) * 1.08
        patched.fontWeight = '600'
      }
      if (patched.type === 'photo') {
        patched.anchor.w = patched.anchor.w * 1.05
        patched.anchor.h = patched.anchor.h * 1.05
        if (patched.shape === 'circle') patched.cornerRadius = patched.anchor.w / 2
      }
    }

    return patched
  }

  const elements = template.elements.map(patchElement)
  const roleElements: Record<string, Element[]> = {}
  if (template.roleElements) {
    for (const [rId, rList] of Object.entries(template.roleElements)) {
      roleElements[rId] = rList.map(patchElement)
    }
  }

  return {
    ...template,
    version: (template.version || 1) + 1,
    theme: newTheme,
    elements,
    roleElements: Object.keys(roleElements).length > 0 ? roleElements : template.roleElements,
  }
}
