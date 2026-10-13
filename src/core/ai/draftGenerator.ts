import type { CardTemplate } from '../schema/CardTemplate'
import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import type { Element } from '../schema/Element'
import { getRoleOrDefault, DEFAULT_ROLES } from '../schema/Role'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../../brandKits/defaultLogos'

export type EventCategory = 'sports' | 'hackathon' | 'robotics' | 'conference' | 'cultural' | 'workshop' | 'general'

export function detectEventCategory(event: EventContext): EventCategory {
  const catObj = (event as any).category
  if (catObj && catObj.status !== 'missing' && catObj.value) {
    const explicit = String(catObj.value).toLowerCase()
    if (['sports', 'hackathon', 'robotics', 'conference', 'cultural', 'workshop'].includes(explicit)) {
      return explicit as EventCategory
    }
  }
  const text = `${event.name?.value || ''} ${(event as any).description?.value || ''} ${(event as any).themeHint?.value || ''}`.toLowerCase()
  if (/(?:sports?|tournament|football|cricket|basketball|badminton|athletics?|championship|league|match|referee|players?)/i.test(text)) return 'sports'
  if (/(?:robotics?|robots?|robos?|bots?|battlebots?|mechatronics)/i.test(text)) return 'robotics'
  if (/(?:cultural|fest|festival|music|dance|arts?|celebration)/i.test(text)) return 'cultural'
  if (/(?:conference|summit|symposium|keynote|business|seminar)/i.test(text)) return 'conference'
  if (/(?:workshop|bootcamp|masterclass|training)/i.test(text)) return 'workshop'
  if (/(?:hackathon|coding|codefest|hacknit|datathon|programming)/i.test(text)) return 'hackathon'
  return 'general'
}

/**
 * Generate 3 distinct draft templates customized based on the user's event description,
 * missing questions answered, role definitions, and event category.
 */
export async function generateDrafts(
  event: EventContext,
  roles: (Role | string)[],
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
    const data = await res.json() as any
    if (Array.isArray(data) && data.length > 0) return data
    return generateDraftsDeterministic(event, roles, logos, data)
  } catch {
    return generateDraftsDeterministic(event, roles, logos)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER 1: MODERN MINIMAL (Dual-Tone Vertical Split - Category Aware)
// ─────────────────────────────────────────────────────────────────────────────

function buildModernMinimalFront(
  role: Role,
  event: EventContext,
  logos: { instLogo: string; clubLogo: string },
  category: EventCategory = 'general'
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor'
  const isPlayer = roleId === 'player'

  // Refined palette mapping
  const lowerBg = category === 'sports'
    ? (isOrganizer ? '#0f172a' : isJudge ? '#1e293b' : '#0a192f')
    : isOrganizer
    ? '#090b10'
    : isJudge
    ? '#0f172a'
    : isMentor
    ? '#14132b'
    : isVolunteer
    ? '#064e3b'
    : isSpeaker
    ? '#2b0b18'
    : '#091128'

  const accentColor = category === 'sports'
    ? (isOrganizer ? '#f59e0b' : isJudge ? '#e2e8f0' : '#38bdf8')
    : isOrganizer
    ? '#f59e0b'
    : isJudge
    ? '#e2e8f0'
    : isMentor
    ? '#14b8a6'
    : isVolunteer
    ? '#f59e0b'
    : isSpeaker
    ? '#fbbf24'
    : '#38bdf8'

  const badgeTypeLabel = category === 'sports'
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

  const ringStroke = isOrganizer ? '#f59e0b' : isJudge ? '#e2e8f0' : '#ffffff'

  const elements: Element[] = [
    // 1. Top White Header Section
    {
      type: 'shape',
      id: 'header-bg',
      anchor: { x: 0, y: 0, w: 54, h: 38 },
      shape: 'rect',
      fill: isOrganizer ? '#f8fafc' : '#ffffff',
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
      fill: '#e2e8f0',
      stroke: '#cbd5e1',
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
      fontFamily: 'Space Grotesk',
      fontSize: 2.7,
      fontWeight: '700',
      color: isOrganizer ? '#b45309' : '#64748b',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // 6. Event Name
    {
      type: 'text',
      id: 'event-name-header',
      anchor: { x: 13, y: 10.2, w: 28, h: 5 },
      content: event.name?.value || 'InCursion Hackathon',
      fontFamily: 'Space Grotesk',
      fontSize: 4.6,
      fontWeight: '700',
      color: '#0f172a',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3.5,
    },
    // 7. Badge Serial No. (Ref 1 style "No. 0250")
    {
      type: 'text',
      id: 'badge-serial',
      anchor: { x: 13, y: 15.5, w: 28, h: 3 },
      content: 'No. {{person.id}}',
      fontFamily: 'Inter',
      fontSize: 2.7,
      fontWeight: '500',
      color: '#94a3b8',
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
    // 9. Diagonal Geometric Slashes flanking the boundary (Ref 1 signature)
    {
      type: 'shape',
      id: 'split-slash-left',
      anchor: { x: 3, y: 36.5, w: 10, h: 3 },
      shape: 'polygon',
      points: '0,0 8,0 6,3 0,3',
      fill: role.palette.primary,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.9,
    },
    {
      type: 'shape',
      id: 'split-slash-right',
      anchor: { x: 41, y: 36.5, w: 10, h: 3 },
      shape: 'polygon',
      points: '2,0 10,0 10,3 4,3',
      fill: role.palette.primary,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 0.9,
    },
    // 10. Subtle Monogram Wireframe Lines in background (Ref 1 texture)
    {
      type: 'shape',
      id: 'bg-wireframe',
      anchor: { x: 0, y: 64, w: 54, h: 21 },
      shape: 'polygon',
      points: '0,21 12,0 24,21 36,0 48,21 54,10',
      fill: 'transparent',
      stroke: role.palette.primary,
      strokeWidth: 0.35,
      cornerRadius: 0,
      opacity: 0.22,
    },
    // 11. Circular Photo Ring Border (intersecting split cleanly)
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
      initialsBg: role.palette.primary,
    },
    // 13. Participant Name Typography
    {
      type: 'text',
      id: 'person-name',
      anchor: { x: 2, y: 52, w: 50, h: 7.8 },
      content: '{{person.name}}',
      fontFamily: 'Space Grotesk',
      fontSize: 8.5,
      fontWeight: '700',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 2,
      minFontSize: 5.5,
    },
    // 14. Role Pill Badge
    {
      type: 'shape',
      id: 'role-pill-bg',
      anchor: { x: 13, y: 60.5, w: 28, h: 5.5 },
      shape: 'rect',
      cornerRadius: 2.75,
      fill: role.palette.primary,
      stroke: isOrganizer ? '#f59e0b' : 'transparent',
      strokeWidth: isOrganizer ? 0.4 : 0,
      opacity: 1,
    },
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 13, y: 60.5, w: 28, h: 5.5 },
      content: role.label.toUpperCase(),
      fontFamily: 'Space Grotesk',
      fontSize: 4.2,
      fontWeight: '700',
      color: isOrganizer && role.palette.primary === '#0f172a' ? '#f59e0b' : '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3.2,
    },
    // 15. Secondary Detail (Team / Organization / Designation)
    {
      type: 'text',
      id: 'person-detail',
      anchor: { x: 2, y: 67.2, w: 50, h: 4 },
      content: isOrganizer
        ? 'Executive Organizing Committee'
        : isJudge
        ? 'Grand Jury & Evaluation Panel'
        : isSpeaker
        ? 'Keynote & Industry Leader'
        : isVolunteer
        ? 'Operations & Logistics Crew'
        : isMentor
        ? 'Technical Advisor & Mentor'
        : '{{person.team}}',
      fontFamily: 'Inter',
      fontSize: 3.6,
      fontWeight: '500',
      color: '#94a3b8',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.8,
    },
    // 16. Event Venue & Date
    {
      type: 'text',
      id: 'event-venue-date',
      anchor: { x: 2, y: 71.6, w: 50, h: 3.5 },
      content: `${event.venue?.value || 'SVNIT, Surat'} · ${event.dateStart?.value || '2024'}`,
      fontFamily: 'Inter',
      fontSize: 3.1,
      fontWeight: '400',
      color: '#64748b',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 17. Real Scannable Vector QR Code
    {
      type: 'qr',
      id: 'person-qr',
      anchor: { x: 23, y: 75.6, w: 8, h: 8 },
      urlPattern: `https://acm.svnit.ac.in/verify/{{person.id}}`,
      fgColor: '#ffffff',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // 18. Footer Micro Branding
    {
      type: 'text',
      id: 'footer-branding',
      anchor: { x: 2, y: 84.4, w: 50, h: 2.4 },
      content: 'ACM NIT SURAT · SVNIT SURAT',
      fontFamily: 'Space Grotesk',
      fontSize: 2.2,
      fontWeight: '600',
      color: '#64748b',
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
  category: EventCategory = 'general'
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor'
  const isPlayer = roleId === 'player'

  const techBg = category === 'sports'
    ? (isOrganizer ? '#0f172a' : isJudge ? '#1e293b' : '#081426')
    : category === 'cultural'
    ? (isOrganizer ? '#1a0b2e' : '#1e052d')
    : category === 'robotics'
    ? (isOrganizer ? '#090d16' : '#0a101d')
    : category === 'conference'
    ? (isOrganizer ? '#0a0d14' : '#0f172a')
    : isOrganizer
    ? '#0d1117'
    : isJudge
    ? '#0f172a'
    : isMentor
    ? '#1c0d3f'
    : isVolunteer
    ? '#063f30'
    : isSpeaker
    ? '#260a18'
    : '#160d38'

  const accentColor = category === 'sports'
    ? (isOrganizer ? '#f59e0b' : isJudge ? '#e2e8f0' : '#38bdf8')
    : category === 'cultural'
    ? (isOrganizer ? '#fbbf24' : '#ec4899')
    : category === 'robotics'
    ? (isOrganizer ? '#f59e0b' : '#06b6d4')
    : category === 'conference'
    ? (isOrganizer ? '#f59e0b' : '#d97706')
    : role.palette.accent || '#8b5cf6'

  // Dynamic category-based motifs
  const categoryMotifs: Element[] = category === 'sports' ? [
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

  const orgSubtitle = category === 'sports'
    ? 'SPORTS COUNCIL · SVNIT'
    : category === 'cultural'
    ? 'CULTURAL FESTIVAL · SVNIT'
    : category === 'robotics'
    ? 'ROBOTICS LAB · NIT SURAT'
    : category === 'conference'
    ? 'EXECUTIVE SUMMIT · ACM & SVNIT'
    : 'ACM NIT SURAT'

  const roleBadgeLabel = category === 'sports'
    ? (isPlayer ? 'ATHLETE' : isJudge ? 'REFEREE' : isOrganizer ? 'DIRECTOR' : role.label.toUpperCase())
    : role.label.toUpperCase()

  const personDetailText = category === 'sports'
    ? (isOrganizer ? 'Tournament Operations' : isJudge ? 'Match Official Panel' : isMentor ? 'Coaching Staff' : isPlayer ? 'Squad: {{person.team}}' : '{{person.team}}')
    : isOrganizer ? 'Core Organizing Team' : isJudge ? 'Judge & Panelist' : isMentor ? 'Mentor & Coach' : isVolunteer ? 'Operations Support' : '{{person.team}}'

  const footerText = category === 'sports'
    ? 'OFFICIAL ATHLETIC PASS · SVNIT SURAT'
    : category === 'cultural'
    ? 'FESTIVAL ACCREDITATION · SVNIT SURAT'
    : category === 'robotics'
    ? 'TELEMETRY CREDENTIAL · SVNIT SURAT'
    : category === 'conference'
    ? 'CONFERENCE DELEGATE · ACM NIT SURAT'
    : 'VERIFIED CREDENTIAL · ACM SVNIT SURAT'

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
    // 2. Category-specific visual motifs
    ...categoryMotifs,
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
      anchor: { x: 12, y: 3.5, w: 30, h: 5 },
      content: event.name?.value || 'Event Title',
      fontFamily: 'Space Grotesk',
      fontSize: 4.8,
      fontWeight: '700',
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 3.5,
    },
    // 6. Organization Subtitle
    {
      type: 'text',
      id: 'org-subtitle',
      anchor: { x: 12, y: 8.5, w: 30, h: 3.5 },
      content: orgSubtitle,
      fontFamily: 'Space Grotesk',
      fontSize: 3.2,
      fontWeight: '600',
      color: accentColor,
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
      stroke: accentColor,
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
      initialsBg: role.palette.primary,
    },
    // 8. Crisp White Lower Zone (y: 47 to 85.6)
    {
      type: 'shape',
      id: 'info-zone-bg',
      anchor: { x: 0, y: 47, w: 54, h: 38.6 },
      shape: 'rect',
      fill: '#f8fafc',
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
      fill: '#f8fafc',
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
      fill: role.palette.primary,
      stroke: isOrganizer ? '#f59e0b' : 'transparent',
      strokeWidth: isOrganizer ? 0.4 : 0,
      opacity: 1,
    },
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 13, y: 39, w: 28, h: 6 },
      content: roleBadgeLabel,
      fontFamily: 'Space Grotesk',
      fontSize: 4.4,
      fontWeight: '700',
      color: isOrganizer && role.palette.primary === '#0f172a' ? '#f59e0b' : '#ffffff',
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
      fontFamily: 'Space Grotesk',
      fontSize: 8,
      fontWeight: '700',
      color: '#0f172a',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 5.2,
    },
    // 12. Team / Credential
    {
      type: 'text',
      id: 'person-team',
      anchor: { x: 2, y: 54.5, w: 50, h: 4 },
      content: personDetailText,
      fontFamily: 'Inter',
      fontSize: 3.9,
      fontWeight: '600',
      color: '#334155',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.8,
    },
    // 13. Event Date & Venue
    {
      type: 'text',
      id: 'event-venue-date',
      anchor: { x: 2, y: 59, w: 50, h: 3.5 },
      content: `${event.venue?.value || 'SVNIT, Surat'} · ${event.dateStart?.value || '2026'}`,
      fontFamily: 'Inter',
      fontSize: 3.2,
      fontWeight: '400',
      color: '#64748b',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 14. Real Vector QR Code
    {
      type: 'qr',
      id: 'person-qr',
      anchor: { x: 23, y: 63.5, w: 8, h: 8 },
      urlPattern: `https://acm.svnit.ac.in/verify/{{person.id}}`,
      fgColor: techBg,
      bgColor: '#f1f5f9',
      errorCorrection: 'M',
    },
    // 15. Vector Barcode Strip
    {
      type: 'barcode',
      id: 'person-barcode',
      anchor: { x: 7, y: 73, w: 40, h: 8 },
      valueBinding: '{{person.id}}',
      format: 'CODE128',
      fgColor: '#0f172a',
      bgColor: '#f8fafc',
    },
    // 16. Footer Validity Micro-Text
    {
      type: 'text',
      id: 'footer-validity',
      anchor: { x: 2, y: 82.5, w: 50, h: 2.4 },
      content: footerText,
      fontFamily: 'Space Grotesk',
      fontSize: 2.2,
      fontWeight: '600',
      color: '#94a3b8',
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
  category: EventCategory = 'general'
): Element[] {
  const roleId = role.id.toLowerCase()
  const isOrganizer = roleId === 'organizer'
  const isJudge = roleId === 'judge' || roleId === 'referee'
  const isSpeaker = roleId === 'speaker'
  const isVolunteer = roleId === 'volunteer'
  const isMentor = roleId === 'mentor'
  const isPlayer = roleId === 'player'

  const obsidianBg = category === 'sports'
    ? '#080e1a'
    : category === 'cultural'
    ? '#150720'
    : category === 'robotics'
    ? '#070b12'
    : category === 'conference'
    ? '#0a0d14'
    : '#090a10'

  const accentColor = category === 'sports'
    ? (isOrganizer ? '#f59e0b' : isJudge ? '#e2e8f0' : isPlayer ? '#dc2626' : '#2563eb')
    : category === 'cultural'
    ? (isOrganizer ? '#fbbf24' : '#d946ef')
    : category === 'robotics'
    ? (isOrganizer ? '#f59e0b' : '#06b6d4')
    : category === 'conference'
    ? (isOrganizer ? '#f59e0b' : '#d97706')
    : isOrganizer
    ? '#f59e0b'
    : isJudge
    ? '#e2e8f0'
    : isSpeaker
    ? '#be123c'
    : isVolunteer
    ? '#059669'
    : isMentor
    ? '#7c3aed'
    : '#2563eb'

  const headerCategoryText = category === 'sports'
    ? 'ATHLETIC PASS'
    : category === 'cultural'
    ? 'CULTURE VIP'
    : category === 'robotics'
    ? 'LAB ACCESS'
    : category === 'conference'
    ? 'DELEGATE PASS'
    : category === 'workshop'
    ? 'COHORT PASS'
    : 'ACM PASS'

  const serialText = category === 'sports'
    ? 'ROSTER-{{person.id}}'
    : category === 'robotics'
    ? 'UNIT-{{person.id}}'
    : 'ID-{{person.id}}'

  const personDetailContent = category === 'sports'
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

  const roleTextHighlight = isOrganizer ? '#f59e0b' : isJudge ? '#f8fafc' : role.palette.accent || accentColor

  const elements: Element[] = [
    // 1. Matte Obsidian Full Background
    {
      type: 'shape',
      id: 'bg-obsidian',
      anchor: { x: 0, y: 0, w: 54, h: 85.6 },
      shape: 'rect',
      fill: obsidianBg,
      stroke: 'transparent',
      strokeWidth: 0,
      cornerRadius: 0,
      opacity: 1,
    },
    // 2. Lanyard Slot Hole (Ref 3 clasp cut)
    {
      type: 'shape',
      id: 'lanyard-slot',
      anchor: { x: 22, y: 2, w: 10, h: 2.5 },
      shape: 'rect',
      fill: '#1a1d29',
      stroke: '#2e354a',
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
      fill: '#151924',
      stroke: 'transparent',
      strokeWidth: 0,
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
      initialsBg: role.palette.primary,
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
      fontFamily: 'Space Grotesk',
      fontSize: 2.6,
      fontWeight: '700',
      color: '#94a3b8',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2,
    },
    // 6. Serial Badge inside the vertical block
    {
      type: 'text',
      id: 'block-serial',
      anchor: { x: 37, y: 12, w: 12.5, h: 3.5 },
      content: serialText,
      fontFamily: 'Space Grotesk',
      fontSize: 2.4,
      fontWeight: '700',
      color: isJudge ? '#0f172a' : '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 1.8,
    },
    // 7. Compact QR code nested at bottom of the accent block
    {
      type: 'qr',
      id: 'block-qr',
      anchor: { x: 38.5, y: 44.5, w: 9.5, h: 9.5 },
      urlPattern: `https://acm.svnit.ac.in/verify/{{person.id}}`,
      fgColor: isJudge ? '#0f172a' : '#ffffff',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // 8. Bold Editorial Participant Name
    {
      type: 'text',
      id: 'person-name',
      anchor: { x: 4, y: 51.5, w: 46, h: 8.2 },
      content: '{{person.name}}',
      fontFamily: 'Space Grotesk',
      fontSize: 8.8,
      fontWeight: '700',
      color: '#ffffff',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 2,
      minFontSize: 6,
    },
    // 9. Role Title
    {
      type: 'text',
      id: 'role-label',
      anchor: { x: 4, y: 60.5, w: 46, h: 4.8 },
      content: role.label,
      fontFamily: 'Space Grotesk',
      fontSize: 4.8,
      fontWeight: '600',
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
      anchor: { x: 4, y: 65.5, w: 46, h: 4 },
      content: personDetailContent,
      fontFamily: 'Inter',
      fontSize: 3.8,
      fontWeight: '500',
      color: '#94a3b8',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.8,
    },
    // 11. Event Name
    {
      type: 'text',
      id: 'event-name',
      anchor: { x: 4, y: 70, w: 46, h: 3.5 },
      content: event.name?.value || 'Event Name',
      fontFamily: 'Inter',
      fontSize: 3.3,
      fontWeight: '400',
      color: '#64748b',
      align: 'left',
      verticalAlign: 'middle',
      maxLines: 1,
      minFontSize: 2.5,
    },
    // 12. Minimalist Horizontal Line Divider
    {
      type: 'shape',
      id: 'footer-divider',
      anchor: { x: 4, y: 74, w: 46, h: 0.35 },
      shape: 'line',
      fill: 'transparent',
      stroke: '#1e2436',
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
      content: event.website?.value || 'acm.svnit.ac.in',
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
  const isDark = style !== 'modern-minimal'
  const bgFill = style === 'creative-tech'
    ? (category === 'sports' ? '#081426' : category === 'cultural' ? '#1e052d' : category === 'robotics' ? '#0a101d' : '#170b38')
    : style === 'premium-editorial'
    ? (category === 'sports' ? '#080e1a' : category === 'cultural' ? '#150720' : category === 'robotics' ? '#070b12' : '#090a10')
    : '#ffffff'
  const textColor = isDark ? '#ffffff' : '#0f172a'
  const subtextColor = isDark ? '#94a3b8' : '#64748b'

  const rule1 = category === 'sports'
    ? '1. Pass must be visibly worn at all times by roster athletes and officials in the arena.'
    : category === 'cultural'
    ? '1. Festival badge grants entry to designated cultural venues and stage arenas.'
    : category === 'robotics'
    ? '1. Technical badge required for pit-lane entry and arena safety zone access.'
    : category === 'conference'
    ? '1. Delegate pass grants entry to keynote auditoriums and executive sessions.'
    : '1. Badge must be visibly worn at all times within SVNIT campus and hackathon venues.'

  const rule2 = category === 'sports'
    ? '2. Unauthorized badge transfer leads to immediate team disqualification.'
    : category === 'cultural'
    ? '2. This identification pass is strictly non-transferable and remains property of SVNIT.'
    : category === 'robotics'
    ? '2. All arena safety protocols must be followed by team marshals.'
    : category === 'conference'
    ? '2. Badge must be displayed at all times within conference halls.'
    : '2. This identification pass is strictly non-transferable and remains property of ACM NIT Surat.'

  const rule3 = category === 'sports'
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
      fill: isDark ? '#1e2230' : '#e2e8f0',
      stroke: isDark ? '#333b52' : '#cbd5e1',
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
      fontFamily: 'Space Grotesk',
      fontSize: 4,
      fontWeight: '700',
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
      fontFamily: 'Space Grotesk',
      fontSize: 2.8,
      fontWeight: '700',
      color: role.palette.primary,
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
      fontFamily: 'Inter',
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
      fontFamily: 'Inter',
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
      fontFamily: 'Inter',
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
      urlPattern: `https://acm.svnit.ac.in/verify/{{person.id}}`,
      fgColor: isDark ? '#ffffff' : '#0f172a',
      bgColor: 'transparent',
      errorCorrection: 'M',
    },
    // Scan instructions
    {
      type: 'text',
      id: 'back-scan-hint',
      anchor: { x: 4, y: 63, w: 46, h: 3 },
      content: 'SCAN TO VERIFY CREDENTIALS',
      fontFamily: 'Space Grotesk',
      fontSize: 2.5,
      fontWeight: '600',
      color: role.palette.primary,
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
      fontFamily: 'Space Grotesk',
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
      content: event.contact?.value || 'helpdesk@svnit.ac.in · +91 261 2227334',
      fontFamily: 'Inter',
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
      fgColor: isDark ? '#ffffff' : '#0f172a',
      bgColor: 'transparent',
    },
    // Copyright
    {
      type: 'text',
      id: 'back-copyright',
      anchor: { x: 2, y: 83, w: 50, h: 2.2 },
      content: '© SVNIT Surat · ACM NIT Surat Chapter',
      fontFamily: 'Inter',
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
    d2Desc: 'Energetic sports pass with athletic speed chevrons, bold chevron divider, player barcode, and stadium credentials.',
    d2Tags: ['sports', 'arena', 'dynamic', 'chevron', 'barcode', 'match-day'],
    d3Name: n => `Championship Editorial — ${n}`,
    d3Desc: 'Bold sports credential with asymmetric player portrait, competition accent bar, and official roster verification.',
    d3Tags: ['sports', 'editorial', 'championship', 'prestige', 'roster'],
  },
  hackathon: {
    d1Name: n => `Modern Minimal — ${n}`,
    d1Desc: 'Clean dual-tone vertical badge with circular ring portrait, lanyard badge slot, and balanced typography.',
    d1Tags: ['minimal', 'dual-tone', 'vertical-split', 'lanyard-badge', 'hackathon'],
    d2Name: n => `Creative Tech — ${n}`,
    d2Desc: 'Scientific and geometric tech badge with hexagon molecular network, glowing halo avatar, chevron divider, and barcode strip.',
    d2Tags: ['creative', 'tech', 'hexagons', 'chevron', 'barcode', 'hackathon'],
    d3Name: n => `Premium Editorial — ${n}`,
    d3Desc: 'Minimal matte obsidian card with bold asymmetric rectangular photo framing, striking vertical accent block, and cyber typography.',
    d3Tags: ['editorial', 'asymmetric', 'matte-obsidian', 'accent-block', 'prestige', 'hackathon'],
  },
  robotics: {
    d1Name: n => `Engineering Precision — ${n}`,
    d1Desc: 'Precision technical badge with geometric dual-tone layout, engineering badges, and automated verification.',
    d1Tags: ['robotics', 'engineering', 'precision', 'minimal', 'hardware'],
    d2Name: n => `Telemetry Grid — ${n}`,
    d2Desc: 'Robotics lab credential with telemetry caliper brackets, technical circuit accents, and equipment barcode.',
    d2Tags: ['robotics', 'telemetry', 'circuits', 'barcode', 'tech'],
    d3Name: n => `Lab Accreditation — ${n}`,
    d3Desc: 'Matte obsidian research credential with asymmetric photo frame, telemetry accent bar, and laboratory accreditation.',
    d3Tags: ['robotics', 'lab', 'accreditation', 'editorial', 'prestige'],
  },
  conference: {
    d1Name: n => `Executive Symposium — ${n}`,
    d1Desc: 'Sophisticated executive badge with dual-tone layout, prestigious delegate credentials, and scannable verification.',
    d1Tags: ['conference', 'summit', 'executive', 'delegate', 'minimal'],
    d2Name: n => `Summit Diamond Crest — ${n}`,
    d2Desc: 'Prestigious conference badge with geometric crest accents, chevron divider, and keynote session credentials.',
    d2Tags: ['conference', 'summit', 'crest', 'keynote', 'barcode'],
    d3Name: n => `Prestigious Delegate — ${n}`,
    d3Desc: 'Premium matte obsidian delegate pass with asymmetric portrait framing, champagne accent bar, and executive branding.',
    d3Tags: ['conference', 'delegate', 'obsidian', 'editorial', 'vip'],
  },
  cultural: {
    d1Name: n => `Festive Radiance — ${n}`,
    d1Desc: 'Celebratory festival badge with dynamic split styling, colorful role badge, and festival access QR code.',
    d1Tags: ['cultural', 'fest', 'radiance', 'arts', 'celebration'],
    d2Name: n => `Celebration Mosaic — ${n}`,
    d2Desc: 'Vibrant cultural identity card with festive star diamond motifs, chevron apex, and event entry barcode.',
    d2Tags: ['cultural', 'festive', 'mosaic', 'music', 'barcode'],
    d3Name: n => `Artisan VIP Pass — ${n}`,
    d3Desc: 'Deep velvet festival pass with asymmetric artist portrait framing, vibrant accent block, and stage accreditation.',
    d3Tags: ['cultural', 'artisan', 'editorial', 'artist-pass', 'vip'],
  },
  workshop: {
    d1Name: n => `Academic Minimal — ${n}`,
    d1Desc: 'Clean educational credential with dual-tone layout, cohort details, and verification badge.',
    d1Tags: ['workshop', 'academic', 'training', 'bootcamp', 'minimal'],
    d2Name: n => `Bootcamp Cohort Pass — ${n}`,
    d2Desc: 'Structured learning credential with technical motifs, chevron accent, and attendance barcode.',
    d2Tags: ['workshop', 'cohort', 'bootcamp', 'barcode', 'learning'],
    d3Name: n => `Editorial Scholar — ${n}`,
    d3Desc: 'Matte scholar credential with asymmetric portrait framing, cohort accent bar, and masterclass certification.',
    d3Tags: ['workshop', 'scholar', 'editorial', 'masterclass', 'certification'],
  },
  general: {
    d1Name: n => `Modern Minimal — ${n}`,
    d1Desc: 'Clean dual-tone vertical badge with circular ring portrait, lanyard badge slot, and balanced typography.',
    d1Tags: ['minimal', 'dual-tone', 'vertical-split', 'lanyard-badge', 'clean'],
    d2Name: n => `Creative Tech — ${n}`,
    d2Desc: 'Scientific and geometric badge with molecular network, glowing halo avatar, chevron divider, and barcode strip.',
    d2Tags: ['creative', 'geometric', 'chevron', 'barcode', 'modern'],
    d3Name: n => `Premium Editorial — ${n}`,
    d3Desc: 'Minimal matte obsidian card with bold asymmetric rectangular photo framing, striking vertical accent block, and editorial typography.',
    d3Tags: ['editorial', 'asymmetric', 'matte-obsidian', 'accent-block', 'prestige'],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER DETERMINISTIC GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateDraftsDeterministic(
  event: EventContext,
  roles: (Role | string)[],
  logos?: { instituteLogo?: string; clubLogo?: string },
  llmSuggestions?: any
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
    (llmSuggestions?.category && ['sports', 'hackathon', 'robotics', 'conference', 'cultural', 'workshop', 'general'].includes(llmSuggestions.category))
      ? llmSuggestions.category
      : detectEventCategory(event)
  )

  const meta = CATEGORY_METADATA[category] || CATEGORY_METADATA.general

  // Build role elements for each draft family
  const draft1RoleFront: Record<string, Element[]> = {}
  const draft1RoleBack: Record<string, Element[]> = {}

  const draft2RoleFront: Record<string, Element[]> = {}
  const draft2RoleBack: Record<string, Element[]> = {}

  const draft3RoleFront: Record<string, Element[]> = {}
  const draft3RoleBack: Record<string, Element[]> = {}

  effectiveRoles.forEach(r => {
    draft1RoleFront[r.id] = buildModernMinimalFront(r, event, logoBag, category)
    draft1RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'modern-minimal', category)

    draft2RoleFront[r.id] = buildCreativeTechFront(r, event, logoBag, category)
    draft2RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'creative-tech', category)

    draft3RoleFront[r.id] = buildPremiumEditorialFront(r, event, logoBag, category)
    draft3RoleBack[r.id] = buildCardBackElements(r, event, logoBag, 'premium-editorial', category)
  })

  // Select participant or player role as default face
  const defaultRole = effectiveRoles.find(r => r.id === 'participant' || r.id === 'player') || effectiveRoles[0]

  // Draft 1: Modern Minimal (Dual-Tone Vertical)
  const draft1: CardTemplate = {
    id: 'modern-minimal',
    name: meta.d1Name(eventName),
    designType: 'idCard',
    description: meta.d1Desc,
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
    tags: meta.d1Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft1RoleFront[defaultRole.id],
    backElements: draft1RoleBack[defaultRole.id],
    roleElements: draft1RoleFront,
    roleBackElements: draft1RoleBack,
  }

  // Draft 2: Creative Dynamic (Chevron Banner & Visual Motifs)
  const draft2: CardTemplate = {
    id: 'creative-tech',
    name: meta.d2Name(eventName),
    designType: 'idCard',
    description: meta.d2Desc,
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
    tags: meta.d2Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft2RoleFront[defaultRole.id],
    backElements: draft2RoleBack[defaultRole.id],
    roleElements: draft2RoleFront,
    roleBackElements: draft2RoleBack,
  }

  // Draft 3: Premium Editorial (Matte Obsidian & Accent Block)
  const draft3: CardTemplate = {
    id: 'premium-editorial',
    name: meta.d3Name(eventName),
    designType: 'idCard',
    description: meta.d3Desc,
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
    tags: meta.d3Tags,
    supportedRoles: effectiveRoles.map(r => r.id),
    elements: draft3RoleFront[defaultRole.id],
    backElements: draft3RoleBack[defaultRole.id],
    roleElements: draft3RoleFront,
    roleBackElements: draft3RoleBack,
  }

  return [draft1, draft2, draft3]
}

// ─────────────────────────────────────────────────────────────────────────────
// NATURAL LANGUAGE REFINEMENT
// ─────────────────────────────────────────────────────────────────────────────

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
  const patchElement = (el: Element): Element => {
    // Darker theme
    if (/dark(?:er)?\s+theme/.test(lower) || /dark mode/.test(lower) || /darker/.test(lower)) {
      if (el.type === 'shape' && (el.id === 'header-bg' || el.id === 'info-zone-bg')) {
        return { ...el, fill: '#090a10' }
      }
      if (el.type === 'text' && (el.color === '#0f172a' || el.color === '#334155')) {
        return { ...el, color: '#f8fafc' }
      }
    }
    // Lighter theme
    if (/light(?:er)?\s+theme/.test(lower) || /white/.test(lower)) {
      if (el.type === 'shape' && (el.id === 'lower-bg' || el.id === 'bg-obsidian' || el.id === 'tech-hero-bg')) {
        return { ...el, fill: '#f8fafc' }
      }
      if (el.type === 'text' && (el.color === '#ffffff' || el.color === '#f8fafc')) {
        return { ...el, color: '#0f172a' }
      }
    }
    // Bigger photo
    if (/bigger photo/.test(lower) || /large photo/.test(lower)) {
      if (el.type === 'photo' || el.id === 'photo-ring' || el.id === 'halo-ring') {
        const scale = 1.15
        return {
          ...el,
          anchor: {
            ...el.anchor,
            x: el.anchor.x - 1,
            y: el.anchor.y - 1,
            w: el.anchor.w * scale,
            h: el.anchor.h * scale,
          },
        }
      }
    }
    // Move logo to center
    if (/logo.*center/.test(lower)) {
      if (el.id === 'acm-logo') {
        return { ...el, anchor: { ...el.anchor, x: 22.5 } }
      }
    }
    return el
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
    elements,
    roleElements: Object.keys(roleElements).length > 0 ? roleElements : template.roleElements,
  }
}
