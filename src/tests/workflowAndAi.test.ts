import { describe, it, expect } from 'vitest'
import { parseIntentDeterministic } from '../core/ai/intentExtractor'
import { generateQuestions } from '../core/ai/questionGenerator'
import { generateDraftsDeterministic, detectEventCategory } from '../core/ai/draftGenerator'
import { renderCard } from '../core/renderer'
import { makeEmptyEventContext, type EventContext } from '../core/schema/EventContext'
import { getRoleOrDefault, DEFAULT_ROLES, type Role } from '../core/schema/Role'
import type { Person } from '../core/schema/Person'
import '../templates/registry'
import '../brandKits/loader'

describe('Workflow & AI Improvements — Tests 1 to 7', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Complete Hackathon Description
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 1: Complete Hackathon Description', () => {
    const input =
      'We are organizing a 24-hour hackathon called CodeStorm at SVNIT Surat on 18 October 2026. ' +
      'There will be approximately 200 participants, 20 mentors, 15 organizers, and 10 volunteers. ' +
      'We want professional ID cards with participant names, photos, team names, role labels, and QR codes. ' +
      'Use a modern technology-inspired theme.'

    it('extracts complete structured event context accurately without inventing data', () => {
      const result = parseIntentDeterministic(input)
      const ctx = result.eventContext

      expect(ctx.name.value).toBe('CodeStorm')
      expect(ctx.name.status).toBe('provided')
      expect((ctx as any).category.value).toBe('hackathon')
      expect(ctx.venue.value).toContain('SVNIT Surat')
      expect(ctx.dateStart.value).toContain('18 October 2026')
      expect(ctx.duration?.value).toBe('24-hour')
      expect((ctx as any).participantCount?.value).toBe(200)

      const roleIds = result.roles.map(r => r.id)
      expect(roleIds).toContain('participant')
      expect(roleIds).toContain('mentor')
      expect(roleIds).toContain('organizer')
      expect(roleIds).toContain('volunteer')

      const requested = (ctx as any).requestedFields?.value as string[]
      expect(requested).toContain('name')
      expect(requested).toContain('photo')
      expect(requested).toContain('team')
      expect(requested).toContain('role')
      expect(requested).toContain('qr')
    })

    it('does NOT ask repeated clarification questions for already supplied information', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const questions = generateQuestions(result.eventContext, roles)

      // All essential fields (name, category, date, venue, roles) are resolved
      expect(questions).toHaveLength(0)
    })

    it('generates three distinct technology-inspired drafts with fixed official branding', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      expect(drafts).toHaveLength(3)
      const [draft1, draft2, draft3] = drafts

      // Verify category-specific tags & names
      expect(draft1.tags).toContain('hackathon')
      expect(draft2.tags).toContain('hexagons')
      expect(draft3.tags).toContain('matte-obsidian')

      // Verify draft 2 has tech hexagonal and circuit motifs
      const hasHexMotifs = draft2.elements.some(e => e.id?.includes('hex') || e.id?.includes('circuit'))
      expect(hasHexMotifs).toBe(true)

      // Verify official ACM and SVNIT logos are at reliable fixed positions
      for (const draft of drafts) {
        const acmLogo = draft.elements.find(e => e.id === 'acm-logo')
        const svnitLogo = draft.elements.find(e => e.id === 'svnit-logo')
        expect(acmLogo).toBeDefined()
        expect(svnitLogo).toBeDefined()
        expect(acmLogo?.anchor.x).toBeLessThan(10) // Top Left
        expect(svnitLogo?.anchor.x).toBeGreaterThan(35) // Top Right
      }
    })

    it('accurately renders supplied event details onto participant SVG card', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      const person: Person = {
        id: 'CS-042',
        name: 'Aarav Patel',
        role: 'participant',
        team: 'Team Algorists',
        extra: {},
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      }

      const { svg } = renderCard({
        template: drafts[0],
        person,
        role: getRoleOrDefault(person.role),
        event: result.eventContext,
        face: 'front',
      })
      expect(svg).toContain('CodeStorm')
      expect(svg).toContain('Aarav Patel')
      expect(svg).toContain('PARTICIPANT')
      expect(svg).toContain('Team Algorists')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Sports Event
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 2: Sports Event', () => {
    const input =
      'Create ID cards for a sports tournament named SVNIT Champions League, happening at SVNIT Surat on 18 October 2026. ' +
      'We have 120 players, 15 organizers and 8 referees. ' +
      'I want the players\' names, photographs, team names and unique IDs on the cards.'

    it('identifies sports category correctly and extracts player/referee roles', () => {
      const result = parseIntentDeterministic(input)
      const ctx = result.eventContext

      expect(ctx.name.value).toBe('SVNIT Champions League')
      expect((ctx as any).category.value).toBe('sports')
      expect(ctx.venue.value).toContain('SVNIT Surat')
      expect(ctx.dateStart.value).toContain('18 October 2026')
      expect((ctx as any).participantCount?.value).toBe(120)

      const roleIds = result.roles.map(r => r.id)
      expect(roleIds).toContain('player')
      expect(roleIds).toContain('referee')
      expect(roleIds).toContain('organizer')
    })

    it('generates sports-specific visual motifs and excludes unrelated tech hexagons', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      expect(drafts).toHaveLength(3)
      const [d1, d2, d3] = drafts

      // Verify sports-specific naming & tags
      expect(d1.name).toContain('Athletic')
      expect(d2.name).toContain('Arena')
      expect(d3.name).toContain('Championship')
      expect(d1.tags).toContain('sports')
      expect(d2.tags).toContain('sports')

      // Verify Draft 2 has athletic chevron & motion line motifs
      const hasSportsChevrons = d2.elements.some(e => e.id?.includes('sports-chevron'))
      expect(hasSportsChevrons).toBe(true)

      // Ensure NO unrelated tech hexagons are inserted into sports badge
      const hasTechHexagons = d2.elements.some(e => e.id?.includes('hex-cluster'))
      expect(hasTechHexagons).toBe(false)

      // Verify sports-specific back card rules
      const backRule1 = d1.backElements?.find(e => e.id === 'back-rule-1')
      expect((backRule1 as any)?.content).toContain('roster athletes and officials in the arena')
    })

    it('renders player card with squad details, athletic badge, and scannable QR', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      const player: Person = {
        id: 'SCL-010',
        name: 'Rohan Sharma',
        role: 'player',
        team: 'Surat Strikers FC',
        extra: {},
      }

      const { svg } = renderCard({
        template: drafts[0],
        person: player,
        role: getRoleOrDefault(player.role),
        event: result.eventContext,
        face: 'front',
      })
      expect(svg).toContain('SVNIT Champions League')
      expect(svg).toContain('Rohan Sharma')
      expect(svg).toContain('Surat Strikers FC')
      expect(svg).toContain('SVNIT')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Incomplete Event Description
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 3: Incomplete Event Description', () => {
    const input = 'Create ID cards for our college event.'

    it('generates concise questions for essential missing info without inventing data', () => {
      const result = parseIntentDeterministic(input)
      const ctx = result.eventContext

      // Event name must NOT be invented
      expect(ctx.name.status).toBe('missing')
      expect(ctx.venue.status).toBe('missing')
      expect(ctx.dateStart.status).toBe('missing')

      // Must NOT prematurely assume category
      expect((ctx as any).category.value).toBe('general')
      expect((ctx as any).category.status).toBe('missing')

      // Generate questions
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const questions = generateQuestions(ctx, roles)

      const askedFields = questions.map(q => q.field)
      expect(askedFields).toContain('name')
      expect(askedFields).toContain('category')
      expect(askedFields).not.toContain('dateStart')
      expect(askedFields).not.toContain('venue')

      // Must not ask for optional fields like tagline, contact, or website
      expect(askedFields).not.toContain('tagline')
      expect(askedFields).not.toContain('contact')
      expect(askedFields).not.toContain('website')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Partially Complete Description
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 4: Partially Complete Description', () => {
    const input = 'Create ID cards for TechFest 2026 at SVNIT Surat on 12 November 2026.'

    it('preserves known details and asks only for genuinely unresolved fields', () => {
      const result = parseIntentDeterministic(input)
      const ctx = result.eventContext

      expect(ctx.name.value).toBe('TechFest 2026')
      expect(ctx.name.status).toBe('provided')
      expect(ctx.venue.value).toContain('SVNIT Surat')
      expect(ctx.venue.status).toBe('provided')
      expect(ctx.dateStart.value).toContain('12 November 2026')
      expect(ctx.dateStart.status).toBe('provided')

      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const questions = generateQuestions(ctx, roles)

      const askedFields = questions.map(q => q.field)
      // Must NOT repeat event name, date, or venue questions!
      expect(askedFields).not.toContain('name')
      expect(askedFields).not.toContain('dateStart')
      expect(askedFields).not.toContain('venue')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Follow-Up Answer Integration
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 5: Follow-Up Answer Integration', () => {
    it('saves answer and recalculates unresolved fields without repeating resolved ones', () => {
      const ctx: EventContext = makeEmptyEventContext()
      const roles = [getRoleOrDefault('participant')]

      // Initially name is missing (date and venue are not asked)
      const initialQuestions = generateQuestions(ctx, roles)
      expect(initialQuestions.some(q => q.field === 'name')).toBe(true)
      expect(initialQuestions.some(q => q.field === 'dateStart')).toBe(false)
      expect(initialQuestions.some(q => q.field === 'venue')).toBe(false)

      // User answers event name
      ctx.name = { value: 'InCursion Hackathon', status: 'confirmed' }
      const afterNameQuestions = generateQuestions(ctx, roles)
      expect(afterNameQuestions.some(q => q.field === 'name')).toBe(false) // Question resolved!
      expect(afterNameQuestions).toHaveLength(0) // Ready to proceed to drafts!
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Multiple Roles for the Same Event
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 6: Multiple Roles for the Same Event', () => {
    const event: EventContext = {
      ...makeEmptyEventContext(),
      name: { value: 'InCursion Hackathon', status: 'provided' },
      venue: { value: 'SVNIT Surat', status: 'provided' },
      dateStart: { value: '18 October 2026', status: 'provided' },
    }

    const testRoles = [
      getRoleOrDefault('participant'),
      getRoleOrDefault('organizer'),
      getRoleOrDefault('mentor'),
      getRoleOrDefault('volunteer'),
      getRoleOrDefault('judge'),
      getRoleOrDefault('vip-sponsor'), // custom role
    ]

    it('generates distinct role identities with consistent event branding and safe coordinates', () => {
      const drafts = generateDraftsDeterministic(event, testRoles)
      const draft = drafts[0] // Modern Minimal

      for (const role of testRoles) {
        const roleEls = draft.roleElements?.[role.id]
        expect(roleEls).toBeDefined()

        // Check role badge element exists
        const roleBadge = roleEls?.find(e => e.id === 'role-label')
        expect(roleBadge).toBeDefined()
        expect((roleBadge as any)?.content).toBe(role.label.toUpperCase())

        // Check official branding positions remain strictly identical across all roles
        const acmLogo = roleEls?.find(e => e.id === 'acm-logo')
        const svnitLogo = roleEls?.find(e => e.id === 'svnit-logo')
        expect(acmLogo?.anchor).toEqual({ x: 3.5, y: 6.5, w: 9, h: 9 })
        expect(svnitLogo?.anchor).toEqual({ x: 41.5, y: 6.5, w: 9, h: 9 })

        // Check render for person with this role
        const person: Person = {
          id: `ID-${role.id}-01`,
          name: `Sample ${role.label}`,
          role: role.id,
          extra: {},
        }
        const { svg } = renderCard({
          template: draft,
          person,
          role,
          event,
          face: 'front',
        })
        expect(svg).toContain(`Sample ${role.label}`)
        expect(svg).toContain(role.label.toUpperCase())
        expect(svg).not.toMatch(/[=" ]NaN[" ]/)
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Reliability and Regression
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 7: Reliability and Regression', () => {
    it('safely handles empty or minimal inputs without crashing or corrupting state', () => {
      const emptyResult = parseIntentDeterministic('')
      expect(emptyResult.eventContext).toBeDefined()
      expect(emptyResult.roles).toHaveLength(1) // default fallback role
      expect(emptyResult.confidence).toBeLessThanOrEqual(0.6)

      const drafts = generateDraftsDeterministic(emptyResult.eventContext, emptyResult.roles.map(r => r.id))
      expect(drafts).toHaveLength(3)
    })

    it('detects diverse event categories correctly', () => {
      const roboticsCtx = { ...makeEmptyEventContext(), name: { value: 'RoboWars 2026', status: 'provided' as const } }
      expect(detectEventCategory(roboticsCtx)).toBe('robotics')

      const culturalCtx = { ...makeEmptyEventContext(), name: { value: 'Sparsh Cultural Fest', status: 'provided' as const } }
      expect(detectEventCategory(culturalCtx)).toBe('cultural')

      const conferenceCtx = { ...makeEmptyEventContext(), name: { value: 'IEEE International Conference', status: 'provided' as const } }
      expect(detectEventCategory(conferenceCtx)).toBe('conference')

      const workshopCtx = { ...makeEmptyEventContext(), name: { value: 'Full-Stack Bootcamp Workshop', status: 'provided' as const } }
      expect(detectEventCategory(workshopCtx)).toBe('workshop')
    })

    it('ensures all 3 drafts adhere to standard CR80 physical card dimensions (54x85.6mm)', () => {
      const event: EventContext = {
        ...makeEmptyEventContext(),
        name: { value: 'SVNIT Summit', status: 'provided' },
      }
      const drafts = generateDraftsDeterministic(event, DEFAULT_ROLES)
      for (const draft of drafts) {
        expect(draft.size.widthMm).toBe(54)
        expect(draft.size.heightMm).toBe(85.6)
        expect(draft.size.bleedMm).toBe(3)
        expect(draft.size.safeMarginMm).toBe(3)
        expect(draft.hasFrontBack).toBe(true)
        expect(draft.backElements).toBeDefined()
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Singing Concert & Music Festival Theme Visuals
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 8: Singing Concert & Music Festival Theme Visuals', () => {
    const input =
      'Singing concert named Raag happening on 24 October 2026 at SVNIT Surat campus. ' +
      'We have 50 vocalists, 10 stage managers and 5 jury panelists. ' +
      'Cards need artist photo, stage name, role and scannable verification.'

    it('identifies music category and extracts vocalist / stage roles', () => {
      const result = parseIntentDeterministic(input)
      const ctx = result.eventContext

      expect(ctx.name.value).toBe('Raag')
      expect((ctx as any).category.value).toBe('music')
      expect(ctx.venue.value).toContain('SVNIT Surat')
      expect(ctx.dateStart.value).toContain('24 October 2026')

      const roleIds = result.roles.map(r => r.id)
      expect(roleIds).toContain('artist')
    })

    it('generates rich concert stage background visuals in all 3 drafts', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      expect(drafts).toHaveLength(3)
      const [d1, d2, d3] = drafts

      // Verify names and tags
      expect(d1.name).toContain('Live Concert Arena')
      expect(d1.tags).toContain('music')
      expect(d1.tags).toContain('concert')

      expect(d2.name).toContain('Neon Soundwave')
      expect(d2.tags).toContain('neon')
      expect(d2.tags).toContain('equalizer')

      expect(d3.name).toContain('VIP Backstage')
      expect(d3.tags).toContain('backstage')

      // Draft 1 must have stage spotlights, singer silhouette, cheering audience crowd, acoustic ripple ring, musical notes, and equalizer bars
      const d1HasSpotlights = d1.elements.some(e => e.id === 'music-spotlight-left' || e.id === 'music-spotlight-right')
      const d1HasSinger = d1.elements.some(e => e.id === 'music-singer-silhouette')
      const d1HasCrowd = d1.elements.some(e => e.id === 'music-crowd-silhouette')
      const d1HasAcousticRing = d1.elements.some(e => e.id === 'music-acoustic-ring')
      const d1HasMusicalNotes = d1.elements.some(e => e.id === 'music-note-left' || e.id === 'music-note-right')
      const d1HasEqBars = d1.elements.some(e => e.id?.startsWith('music-eq-bar-'))

      expect(d1HasSpotlights).toBe(true)
      expect(d1HasSinger).toBe(true)
      expect(d1HasCrowd).toBe(true)
      expect(d1HasAcousticRing).toBe(true)
      expect(d1HasMusicalNotes).toBe(true)
      expect(d1HasEqBars).toBe(true)

      // Draft 2 must have crossing stage lasers, vinyl grooves, floating notes, sonic equalizer, and crowd silhouette
      const d2HasLasers = d2.elements.some(e => e.id === 'music-laser-1' || e.id === 'music-laser-2')
      const d2HasVinylGrooves = d2.elements.some(e => e.id === 'music-groove-1')
      const d2HasNotes = d2.elements.some(e => e.id === 'music-note-crest-1' || e.id === 'music-note-crest-2')
      const d2HasEqBars = d2.elements.some(e => e.id?.startsWith('music-crest-eq-'))
      const d2HasCrowd = d2.elements.some(e => e.id === 'music-crowd-silhouette-d2')

      expect(d2HasLasers).toBe(true)
      expect(d2HasVinylGrooves).toBe(true)
      expect(d2HasNotes).toBe(true)
      expect(d2HasEqBars).toBe(true)
      expect(d2HasCrowd).toBe(true)

      // Draft 3 must have stage spotlight, singer watermark, cheering crowd, and vertical frequency spectrum bars
      const d3HasSpotlight = d3.elements.some(e => e.id === 'editorial-music-spotlight')
      const d3HasSinger = d3.elements.some(e => e.id === 'editorial-music-singer-watermark')
      const d3HasCrowd = d3.elements.some(e => e.id === 'editorial-music-crowd')
      const d3HasFreqBars = d3.elements.some(e => e.id?.startsWith('editorial-freq-bar-'))

      expect(d3HasSpotlight).toBe(true)
      expect(d3HasSinger).toBe(true)
      expect(d3HasCrowd).toBe(true)
      expect(d3HasFreqBars).toBe(true)
    })

    it('renders vector SVG with musical note paths, equalizers, and concert credentials without errors', () => {
      const result = parseIntentDeterministic(input)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      const samplePerson = {
        id: 'VOX-001',
        name: 'Arijit Sen',
        role: 'artist',
        team: 'Lead Vocal Ensemble',
      }

      // Render Draft 1 front
      const { svg: svgFront } = renderCard({
        template: drafts[0],
        person: samplePerson as any,
        role: getRoleOrDefault('artist'),
        event: result.eventContext,
        face: 'front',
      })
      expect(svgFront).toContain('Arijit Sen')
      expect(svgFront).toContain('Raag')
      expect(svgFront).toContain('music-note-left')
      expect(svgFront).toContain('music-eq-bar-')
      expect(svgFront).not.toMatch(/[=" ]NaN[" ]/)

      // Render Draft 2 front
      const { svg: svgD2 } = renderCard({
        template: drafts[1],
        person: samplePerson as any,
        role: getRoleOrDefault('artist'),
        event: result.eventContext,
        face: 'front',
      })
      expect(svgD2).toContain('Arijit Sen')
      expect(svgD2).toContain('music-laser-1')
      expect(svgD2).toContain('music-note-crest-1')
      expect(svgD2).not.toMatch(/[=" ]NaN[" ]/)

      // Render Draft 1 back
      const { svg: svgBack } = renderCard({
        template: drafts[0],
        person: samplePerson as any,
        role: getRoleOrDefault('artist'),
        event: result.eventContext,
        face: 'back',
      })
      expect(svgBack).toContain('TERMS &amp; EVENT GUIDELINES')
      expect(svgBack).toContain('soundboard')
      expect(svgBack).not.toMatch(/[=" ]NaN[" ]/)
    })

    it('understands "shark mank" or startup pitch and generates venture themed visuals in all 3 drafts', () => {
      const bizInput = 'shark mank event for college startup pitches on 25 October at SVNIT Surat with 100 founders, investors, and jury'
      const result = parseIntentDeterministic(bizInput)
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const drafts = generateDraftsDeterministic(result.eventContext, roles)

      expect(drafts).toHaveLength(3)
      const [d1, d2, d3] = drafts

      // Verify business tags
      expect(d1.tags).toContain('pitch')
      expect(d1.tags).toContain('shark-tank')

      // Draft 1 has presenter, growth curve, and audience
      expect(d1.elements.some(e => e.id === 'biz-presenter-silhouette')).toBe(true)
      expect(d1.elements.some(e => e.id === 'biz-growth-curve')).toBe(true)
      expect(d1.elements.some(e => e.id === 'biz-crowd-silhouette')).toBe(true)

      // Draft 2 has summit rays and presenter watermark
      expect(d2.elements.some(e => e.id === 'biz-laser-1')).toBe(true)
      expect(d2.elements.some(e => e.id === 'biz-presenter-d2')).toBe(true)

      // Draft 3 has executive spotlight and presenter watermark
      expect(d3.elements.some(e => e.id === 'editorial-biz-spotlight')).toBe(true)
      expect(d3.elements.some(e => e.id === 'editorial-biz-presenter-watermark')).toBe(true)

      // Render Draft 1 front
      const sampleFounder = {
        id: 'FND-001',
        name: 'Priya Mehta',
        role: 'founder',
        team: 'BioTech Innovations',
      }
      const { svg } = renderCard({
        template: d1,
        person: sampleFounder as any,
        role: getRoleOrDefault('founder'),
        event: result.eventContext,
        face: 'front',
      })
      expect(svg).toContain('Priya Mehta')
      expect(svg).toContain('biz-presenter-silhouette')
      expect(svg).toContain('biz-growth-curve')
      expect(svg).not.toMatch(/[=" ]NaN[" ]/)
    })

    it('extracts event name from "name as garba" and never asks for already provided details in clarification', () => {
      const input = "the event is cultural name as garba 10 participant and 3 organizer make card for them"
      const result = parseIntentDeterministic(input)

      // 1. Name must be extracted as Garba with status provided
      expect(result.eventContext.name.status).toBe('provided')
      expect(result.eventContext.name.value).toBe('Garba')

      // 2. Category must be cultural with status provided
      expect((result.eventContext as any).category?.value).toBe('cultural')
      expect((result.eventContext as any).category?.status).toBe('provided')

      // 3. Roles: participant (count 10), organizer (count 3)
      const roleMap = new Map(result.roles.map(r => [r.id, r]))
      expect(roleMap.has('participant')).toBe(true)
      expect(roleMap.get('participant')?.count).toBe(10)
      expect(roleMap.has('organizer')).toBe(true)
      expect(roleMap.get('organizer')?.count).toBe(3)

      // 4. Requested fields should NOT falsely contain 'name' from "name as garba"
      const reqFields = (result.eventContext as any).requestedFields?.value || []
      expect(reqFields).not.toContain('name')

      // 5. generateQuestions must NOT ask for event name, category, or roles because they were already provided in description!
      const roles = result.roles.map(r => getRoleOrDefault(r.id))
      const questions = generateQuestions(result.eventContext, roles)
      const questionIds = questions.map(q => q.id)

      expect(questionIds).not.toContain('q-event-name')
      expect(questionIds).not.toContain('q-category')
      expect(questionIds).not.toContain('q-roles')

      // 6. Date and venue are intentionally not asked
      expect(questionIds).not.toContain('q-date-start')
      expect(questionIds).not.toContain('q-venue')
      expect(questionIds).toHaveLength(0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Nukkad Natak Prompt (No hardcoded ACM/SVNIT, no 'Them' name, no clause venue)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 11: Nukkad Natak natural language prompt', () => {
    const input = 'i has to organize nukkad natak in which 20 participant 3 organizer name of event nukkad natak so make id card for them'

    it('extracts Nukkad Natak as event name without setting name=Them or venue=which 20 participant or organizer=ACM', () => {
      const result = parseIntentDeterministic(input)

      // 1. Name must be Nukkad Natak, NOT 'Them'
      expect(result.eventContext.name.value).toBe('Nukkad Natak')
      expect(result.eventContext.name.status).toBe('provided')

      // 2. Category must be cultural
      expect((result.eventContext as any).category?.value).toBe('cultural')

      // 3. Organizer must NOT be hardcoded to ACM NIT Surat
      expect(result.eventContext.organizer?.status).toBe('missing')
      expect(result.eventContext.organizer?.value).toBeUndefined()

      // 4. Venue must NOT match "which 20 participant..."
      expect(result.eventContext.venue?.status).toBe('missing')
      expect(result.eventContext.venue?.value).toBeUndefined()

      // 5. Roles: 20 participants, 3 organizers
      const roleMap = new Map(result.roles.map(r => [r.id, r]))
      expect(roleMap.get('participant')?.count).toBe(20)
      expect(roleMap.get('organizer')?.count).toBe(3)

      // 6. Card generation should not include hardcoded ACM NIT SURAT or SVNIT
      const drafts = generateDraftsDeterministic(result.eventContext, result.roles.map(r => getRoleOrDefault(r.id)))
      expect(drafts).toHaveLength(3)

      for (const draft of drafts) {
        const textElements = draft.elements.filter(e => e.type === 'text') as any[]
        for (const el of textElements) {
          expect(el.content).not.toContain('ACM NIT SURAT')
          expect(el.content).not.toContain('SVNIT SURAT')
        }
      }
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST: Dynamic Event-Specific Background Artwork Integration
  // ───────────────────────────────────────────────────────────────────────────
  describe('Dynamic Event-Specific Background Artwork Integration', () => {
    it('attaches background artwork image layer behind official logos and text', async () => {
      const { attachArtworkToDraft } = await import('../core/ai/draftGenerator')
      const result = parseIntentDeterministic('Raas Utsav traditional Gujarati Garba night with 5 participants')
      const drafts = generateDraftsDeterministic(result.eventContext, [getRoleOrDefault('participant')])
      const baseDraft = drafts[0]

      const sampleArtworkUrl = 'data:image/svg+xml;utf8,<svg width="54" height="85.6"><rect fill="#ec4899"/></svg>'
      const enrichedDraft = attachArtworkToDraft(baseDraft, sampleArtworkUrl, true, 'Festive traditional Garba')

      // 1. Verify bg-artwork element exists
      const bgArtwork = enrichedDraft.elements.find(e => e.id === 'bg-artwork')
      expect(bgArtwork).toBeDefined()
      expect(bgArtwork?.type).toBe('image')
      expect((bgArtwork as any)?.src).toBe(sampleArtworkUrl)

      // 2. Verify bg-artwork is positioned at the back (first elements in z-order)
      const bgIndex = enrichedDraft.elements.findIndex(e => e.id === 'bg-artwork')
      const acmIndex = enrichedDraft.elements.findIndex(e => e.id === 'acm-logo')
      const svnitIndex = enrichedDraft.elements.findIndex(e => e.id === 'svnit-logo')
      const nameIndex = enrichedDraft.elements.findIndex(e => e.id === 'person-name')

      expect(bgIndex).toBeLessThan(acmIndex)
      expect(bgIndex).toBeLessThan(svnitIndex)
      expect(bgIndex).toBeLessThan(nameIndex)

      // 3. Verify official logos are preserved in their fixed coordinates
      const acmLogo = enrichedDraft.elements.find(e => e.id === 'acm-logo')
      const svnitLogo = enrichedDraft.elements.find(e => e.id === 'svnit-logo')
      expect(acmLogo?.anchor.x).toBeLessThan(10) // Fixed Top-Left
      expect(svnitLogo?.anchor.x).toBeGreaterThan(35) // Fixed Top-Right

      // 4. Verify tokens reflect artwork status
      expect(enrichedDraft.tokens?.bgArtworkUrl).toBe(sampleArtworkUrl)
      expect(enrichedDraft.tokens?.isGeneratedArtwork).toBe('true')
    })
  })
})


