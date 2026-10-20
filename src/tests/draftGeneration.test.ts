import { describe, it, expect, vi } from 'vitest'
import { generateDrafts, generateDraftsDeterministic, validateAiResponse, applyDeterministicRefinement } from '../core/ai/draftGenerator'
import { MIN_HUE_DISTANCE, getHueDistance, hexToHsl } from '../core/ai/colorConfig'
import { parseIntentDeterministic } from '../core/ai/intentExtractor'
import { getRoleOrDefault, DEFAULT_ROLES } from '../core/schema/Role'
import { listTemplates, listLayoutArchetypes } from '../templates/registry'
import { renderCard } from '../core/renderer'
import type { CardTemplate } from '../core/schema/CardTemplate'
import type { Theme } from '../core/schema/Theme'
import type { Person } from '../core/schema/Person'

describe('ID Card Draft Generation & Variety Engine', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: One description gives 3 drafts with distinct layout ids and palettes beyond the hue threshold
  // ───────────────────────────────────────────────────────────────────────────
  it('gives 3 drafts with distinct layout ids and palettes beyond the hue threshold (>= 40 deg)', () => {
    const parsed = parseIntentDeterministic('Hackathon CodeClash at SVNIT')
    const roles = [getRoleOrDefault('participant'), getRoleOrDefault('mentor'), getRoleOrDefault('organizer')]
    const drafts = generateDraftsDeterministic(parsed.eventContext, roles)

    expect(drafts).toHaveLength(3)

    // 1. Layout archetypes / ids must be distinct
    const layoutIds = drafts.map(d => d.archetype || d.id)
    const uniqueLayoutIds = new Set(layoutIds)
    expect(uniqueLayoutIds.size).toBe(3)

    // 2. Primary hues must differ by at least MIN_HUE_DISTANCE
    const hues = drafts.map(d => {
      const primary = d.theme?.primary || d.tokens?.primaryColor || '#000000'
      return hexToHsl(primary).h
    })

    const dist01 = getHueDistance(hues[0], hues[1])
    const dist12 = getHueDistance(hues[1], hues[2])
    const dist02 = getHueDistance(hues[0], hues[2])

    expect(dist01).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE)
    expect(dist12).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE)
    expect(dist02).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Regenerate 3 times never repeats a layout+palette pair
  // ───────────────────────────────────────────────────────────────────────────
  it('regenerate 3 times never repeats a layout+palette pair', () => {
    const parsed = parseIntentDeterministic('National Robotics Championship 2026')
    const roles = DEFAULT_ROLES

    const seenPairs = new Set<string>()

    for (let seed = 1; seed <= 3; seed++) {
      const drafts = generateDraftsDeterministic(parsed.eventContext, roles, undefined, null, seed)
      for (const d of drafts) {
        const layout = d.archetype || d.id
        const primary = d.theme?.primary || d.tokens?.primaryColor || ''
        const accent = d.theme?.accent || d.tokens?.accentColor || ''
        const pairKey = `${layout}:${primary}:${accent}`

        // Pair must not have been seen before
        expect(seenPairs.has(pairKey)).toBe(false)
        seenPairs.add(pairKey)
      }
    }

    // 3 runs * 3 drafts = 9 unique pairs
    expect(seenPairs.size).toBe(9)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: "Playful college fest" and "formal corporate workshop" give different palettes
  // ───────────────────────────────────────────────────────────────────────────
  it('"Playful college fest" and "formal corporate workshop" give different palettes', () => {
    const parsedFest = parseIntentDeterministic('Playful college cultural fest celebration with dance and games')
    const parsedCorporate = parseIntentDeterministic('Formal executive corporate workshop leadership summit')

    const draftsFest = generateDraftsDeterministic(parsedFest.eventContext, DEFAULT_ROLES)
    const draftsCorp = generateDraftsDeterministic(parsedCorporate.eventContext, DEFAULT_ROLES)

    const festPrimary = draftsFest[0].theme?.primary || draftsFest[0].tokens?.primaryColor || ''
    const corpPrimary = draftsCorp[0].theme?.primary || draftsCorp[0].tokens?.primaryColor || ''

    expect(festPrimary.toLowerCase()).not.toBe(corpPrimary.toLowerCase())

    const festHue = hexToHsl(festPrimary).h
    const corpHue = hexToHsl(corpPrimary).h
    const diff = getHueDistance(festHue, corpHue)

    // Keywords should steer them to completely different color territories
    expect(diff).toBeGreaterThanOrEqual(30)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Theme change keeps geometry identical
  // ───────────────────────────────────────────────────────────────────────────
  it('changing the theme leaves every element x, y, w, h identical', () => {
    const parsed = parseIntentDeterministic('International Cloud Conference')
    const drafts = generateDraftsDeterministic(parsed.eventContext, DEFAULT_ROLES)
    const original = drafts[0]

    // Capture original geometries
    const originalGeometries = original.elements.map(e => ({
      id: e.id,
      x: e.anchor.x,
      y: e.anchor.y,
      w: e.anchor.w,
      h: e.anchor.h,
    }))

    // Apply multiple theme changes: direct theme assignment & natural language refinement
    const newTheme: Theme = {
      background: '#0F172A',
      surface: '#1E293B',
      primary: '#38BDF8',
      secondary: '#0F172A',
      accent: '#F43F5E',
      text: '#F8FAFC',
      mutedText: '#94A3B8',
      onAccent: '#FFFFFF',
    }

    const themeUpdatedTemplate: CardTemplate = {
      ...original,
      theme: newTheme,
    }

    const themeGeometries = themeUpdatedTemplate.elements.map(e => ({
      id: e.id,
      x: e.anchor.x,
      y: e.anchor.y,
      w: e.anchor.w,
      h: e.anchor.h,
    }))

    expect(themeGeometries).toEqual(originalGeometries)

    // Also test natural language refinement for "darker" and "warmer"
    const darkerRefined = applyDeterministicRefinement(original, 'darker theme')
    const darkerGeometries = darkerRefined.elements.map(e => ({
      id: e.id,
      x: e.anchor.x,
      y: e.anchor.y,
      w: e.anchor.w,
      h: e.anchor.h,
    }))
    expect(darkerGeometries).toEqual(originalGeometries)

    const warmerRefined = applyDeterministicRefinement(original, 'warmer')
    const warmerGeometries = warmerRefined.elements.map(e => ({
      id: e.id,
      x: e.anchor.x,
      y: e.anchor.y,
      w: e.anchor.w,
      h: e.anchor.h,
    }))
    expect(warmerGeometries).toEqual(originalGeometries)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Invalid AI output is rejected and the fallback notice flag is set
  // ───────────────────────────────────────────────────────────────────────────
  it('rejects invalid AI output (unknown layout, low contrast, bad hex) and triggers fallback notice', async () => {
    const allowedArchetypes = listLayoutArchetypes().map(a => a.id)

    // Case 1: Unknown layout
    const unknownLayoutResponse = {
      drafts: [
        {
          layoutId: 'non-existent-layout-xyz',
          theme: {
            background: '#ffffff',
            surface: '#ffffff',
            primary: '#0F5C4D',
            secondary: '#14201C',
            accent: '#0F5C4D',
            text: '#14201C',
            mutedText: '#66706A',
            onAccent: '#ffffff',
          },
        },
      ],
    }
    expect(validateAiResponse(unknownLayoutResponse, allowedArchetypes)).toBe(false)

    // Case 2: Bad hex color
    const badHexResponse = {
      drafts: [
        {
          layoutId: allowedArchetypes[0],
          theme: {
            background: 'not-a-color',
            surface: '#ffffff',
            primary: '#0F5C4D',
            secondary: '#14201C',
            accent: '#0F5C4D',
            text: '#14201C',
            mutedText: '#66706A',
            onAccent: '#ffffff',
          },
        },
      ],
    }
    expect(validateAiResponse(badHexResponse, allowedArchetypes)).toBe(false)

    // Case 3: Low contrast (white text on white background)
    const lowContrastResponse = {
      drafts: [
        {
          layoutId: allowedArchetypes[0],
          theme: {
            background: '#FFFFFF',
            surface: '#FFFFFF',
            primary: '#FFFFFF',
            secondary: '#FFFFFF',
            accent: '#FFFFFF',
            text: '#FFFFFF', // Contrast 1:1, fails WCAG 4.5:1
            mutedText: '#FFFFFF',
            onAccent: '#FFFFFF',
          },
        },
      ],
    }
    expect(validateAiResponse(lowContrastResponse, allowedArchetypes)).toBe(false)

    // Case 4: Verify generateDrafts calls onAiFallback(true) when fetch returns invalid AI response
    const originalFetch = globalThis.fetch
    let fallbackFlag = false

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => unknownLayoutResponse, // invalid response
    }) as any

    try {
      const parsed = parseIntentDeterministic('AI Tech Conference')
      const drafts = await generateDrafts(parsed.eventContext, DEFAULT_ROLES, {
        onAiFallback: (val) => {
          fallbackFlag = val
        },
      })

      expect(fallbackFlag).toBe(true)
      expect(drafts).toHaveLength(3)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Website link converted to unique QR code per participant
  // ───────────────────────────────────────────────────────────────────────────
  it('converts website link to QR code and generates unique QR code for every unique link', () => {
    const parsed = parseIntentDeterministic('National Developer Summit')
    const drafts = generateDraftsDeterministic(parsed.eventContext, DEFAULT_ROLES)
    const template = drafts[0] // modern-minimal has back-qr
    const templateWithFrontQr = drafts[1] // creative-tech has front qr
    const role = DEFAULT_ROLES[0]

    const person1: Person = {
      id: 'P001',
      name: 'Alice Johnson',
      role: 'participant',
      website: 'https://github.com/alicejohnson',
      extra: {},
    }

    const person2: Person = {
      id: 'P002',
      name: 'Bob Smith',
      role: 'participant',
      website: 'https://linkedin.com/in/bobsmith',
      extra: {},
    }

    // 1. Test back QR code on template 1
    const renderBack1 = renderCard({
      template,
      role,
      person: person1,
      event: parsed.eventContext,
      face: 'back',
    })

    const renderBack2 = renderCard({
      template,
      role,
      person: person2,
      event: parsed.eventContext,
      face: 'back',
    })

    expect(renderBack1.svg).toContain('id="back-large-qr"')
    expect(renderBack2.svg).toContain('id="back-large-qr"')

    const qrMatchBack1 = renderBack1.svg.match(/<g id="back-large-qr">[\s\S]*?<\/g>/)?.[0]
    const qrMatchBack2 = renderBack2.svg.match(/<g id="back-large-qr">[\s\S]*?<\/g>/)?.[0]

    expect(qrMatchBack1).toBeDefined()
    expect(qrMatchBack2).toBeDefined()
    expect(qrMatchBack1).not.toEqual(qrMatchBack2)

    // 2. Test front QR code on template 1
    const renderFront1 = renderCard({
      template,
      role,
      person: person1,
      event: parsed.eventContext,
      face: 'front',
    })

    const renderFront2 = renderCard({
      template,
      role,
      person: person2,
      event: parsed.eventContext,
      face: 'front',
    })

    expect(renderFront1.svg).toContain('id="person-qr"')
    expect(renderFront2.svg).toContain('id="person-qr"')

    const qrMatchFront1 = renderFront1.svg.match(/<g id="person-qr">[\s\S]*?<\/g>/)?.[0]
    const qrMatchFront2 = renderFront2.svg.match(/<g id="person-qr">[\s\S]*?<\/g>/)?.[0]

    expect(qrMatchFront1).toBeDefined()
    expect(qrMatchFront2).toBeDefined()
    expect(qrMatchFront1).not.toEqual(qrMatchFront2)
  })
})
