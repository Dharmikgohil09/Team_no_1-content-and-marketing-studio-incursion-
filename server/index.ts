import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseServer } from './supabase'

dotenv.config()

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '2mb' }))

// ─── Gemini setup ──────────────────────────────────────────────────────────

function getGenAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set in .env')
  return new GoogleGenerativeAI(key)
}

async function generateWithGemini(genAI: GoogleGenerativeAI, prompt: string): Promise<string> {
  const models = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3-flash-preview', 'gemini-3.8-flash']
  let lastErr: any = null
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m })
      const res = await model.generateContent(prompt)
      return res.response.text().trim()
    } catch (e: any) {
      lastErr = e
      console.warn(`Model ${m} failed: ${e.message?.slice(0, 100)}. Trying fallback...`)
    }
  }
  throw lastErr || new Error('All Gemini models failed')
}

// ─── Intent extraction endpoint ────────────────────────────────────────────

app.post('/api/llm/extract-intent', async (req, res) => {
  try {
    const { text } = req.body as { text: string }
    if (!text) { res.status(400).json({ error: 'text required' }); return }

    const genAI = getGenAI()
    const prompt = `
You are an expert event understanding and design assistant for an ID card & event branding studio.
Analyze the user's natural language event description and extract all explicit information.

CRITICAL RULES:
1. Treat explicit user-provided information as the absolute source of truth.
2. If the user states the event name in ANY form (e.g. "name as Garba", "name is Garba", "named as Garba", "called Garba", "event is cultural named Garba", "Garba night", "titled X", "event: X", "CodeStorm", "Raag"), you MUST extract it as "name": { "value": "Garba", "status": "provided" }. NEVER mark name as "missing" when a name or event title is mentioned in the prompt.
3. If roles and participant counts are given (e.g. "10 participant and 3 organizer"), extract each role with its count (e.g. participant: count 10, organizer: count 3).
4. If venue is mentioned or implied, set "venue": { "value": "SVNIT Surat", "status": "provided" }. Default venue to "SVNIT Surat" with status "provided".
5. Extract the event category accurately:
   - "workshop" for academic contests, quiz competitions, trivia, debates, Olympiads, hands-on bootcamps, masterclasses, technical seminars (IMPORTANT: A quiz or trivia competition is an ACADEMIC/WORKSHOP event, NOT cultural!)
   - "sports" for tournaments, leagues, matches, athletic competitions (football, cricket, etc.)
   - "hackathon" for hackathons, coding contests, codefests
   - "robotics" for robotics, battlebots, hardware competitions
   - "conference" for business conferences, summits, symposiums
   - "cultural" for arts, garba, dandiya, navratri, music, dance festivals, cultural celebrations (never categorize a quiz, trivia, or test as cultural!)
   - "music" for concerts, singing competitions, musical fests, band shows
   - "business" for startup pitch competitions, shark tank events, investor syndicates
   - "gaming" for esports tournaments, gaming LANs, game dev contests
   - "general" if not specifically categorized.

Return ONLY a valid JSON object matching this exact shape (no markdown, no backticks, no conversational text):
{
  "eventContext": {
    "name":             { "value": "string or null", "status": "provided or missing" },
    "category":         { "value": "music|business|sports|hackathon|robotics|conference|cultural|gaming|workshop|general", "status": "provided or missing" },
    "description":      { "value": "string or null", "status": "provided or missing" },
    "tagline":          { "value": "string or null", "status": "provided or missing" },
    "dateStart":        { "value": "string or null", "status": "provided or missing" },
    "dateEnd":          { "value": "string or null", "status": "provided or missing" },
    "duration":         { "value": "string or null", "status": "provided or missing" },
    "venue":            { "value": "string or null", "status": "provided or missing" },
    "organizer":        { "value": "string or null", "status": "provided or missing" },
    "participantCount": { "value": null, "status": "provided or missing" },
    "requestedFields":  { "value": ["name", "photo", "team", "role", "id", "qr"], "status": "provided or missing" },
    "hasPhotos":        { "value": true or false or null, "status": "provided or missing" },
    "hasQrCode":        { "value": true or false or null, "status": "provided or missing" },
    "themeHint":        { "value": "string or null", "status": "provided or missing" },
    "website":          { "value": null, "status": "missing" },
    "contact":          { "value": null, "status": "missing" }
  },
  "roles": [
    { "id": "participant|organizer|mentor|volunteer|judge|speaker|player|referee|artist|vocalist|founder|investor|gamer|custom", "label": "string", "count": null }
  ],
  "designType": "idCard",
  "confidence": 0.0 to 1.0
}

User description:
"${text}"
`
    const raw = await generateWithGemini(genAI, prompt)
    const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

    // Category guard: Ensure quiz / trivia / academic competitions are never incorrectly tagged as cultural
    if (/(?:quiz|trivia|olympiad|debate|spelling\s*bee|academic|scholar|knowledge\s*bowl)/i.test(text)) {
      if (json.eventContext) {
        if (!json.eventContext.category) json.eventContext.category = {}
        json.eventContext.category.value = 'workshop'
        json.eventContext.category.status = 'provided'
      }
    }

    res.json(json)
  } catch (err: any) {
    console.error('LLM extract-intent error:', err.message)
    res.status(500).json({ error: 'LLM failed', detail: err.message })
  }
})

// ─── Gemini Image Generation setup ───────────────────────────────────────

async function generateImageWithGemini(
  genAI: GoogleGenerativeAI,
  prompt: string
): Promise<{ data: string; mimeType: string; modelName: string }> {
  const imageModels = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
    'gemini-3.1-flash-lite-image',
  ]
  let lastErr: any = null

  for (const m of imageModels) {
    try {
      const model = genAI.getGenerativeModel({ model: m })
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })
      const candidate = res.response?.candidates?.[0]
      const part = candidate?.content?.parts?.find((p: any) => p.inlineData)
      if (part && (part as any).inlineData?.data) {
        return {
          data: (part as any).inlineData.data,
          mimeType: (part as any).inlineData.mimeType || 'image/png',
          modelName: m,
        }
      }
    } catch (e: any) {
      lastErr = e
      console.warn(`Image model ${m} unavailable: ${e.message?.slice(0, 100)}`)
    }
  }

  throw lastErr || new Error('All Gemini image generation models failed or quota exceeded')
}

// ─── Dynamic Procedural Generative SVG Artwork Fallback ───────────────────
// When offline or external APIs cannot be reached, generate a rich, unique
// mathematical composition derived dynamically from a polynomial hash of the event details
function generateEventSpecificFallbackArtwork(options: {
  eventName?: string
  eventDescription?: string
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  concept?: string
}): string {
  const p = options.primaryColor || '#6366f1'
  const a = options.accentColor || '#ec4899'
  const bg = options.backgroundColor || '#090d16'
  const seedText = `${options.eventName || ''} ${options.eventDescription || ''} ${options.concept || ''}`.trim()

  // Compute a 32-bit polynomial hash from the event text for dynamic procedural variation
  let h = 5381
  for (let i = 0; i < seedText.length; i++) {
    h = ((h << 5) + h) + seedText.charCodeAt(i)
    h |= 0
  }
  const hash = Math.abs(h)

  // Derive dynamic geometric coordinates from hash
  const angle1 = (hash % 70) + 10
  const angle2 = ((hash >> 3) % 70) + 110
  const cx1 = 12 + ((hash >> 5) % 30)
  const cy1 = 15 + ((hash >> 7) % 20)
  const cx2 = 12 + ((hash >> 9) % 30)
  const cy2 = 65 + ((hash >> 11) % 18)
  const waveAmp = 7 + ((hash >> 13) % 14)
  const mode = hash % 3

  let dynamicLayers = ''
  if (mode === 0) {
    // Flowing harmonic energetic curves & focal radiant halos
    dynamicLayers = `
      <defs>
        <radialGradient id="dynHalo1" cx="${cx1}%" cy="${cy1}%" r="60%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.45"/>
          <stop offset="50%" stop-color="${p}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx1}" cy="${cy1}" r="32" fill="url(#dynHalo1)" />
      <path d="M -5,${cy1} Q ${cx1},${cy1 + waveAmp} 59,${cy1 - waveAmp}" fill="none" stroke="${a}" stroke-width="0.8" opacity="0.6"/>
      <path d="M -5,${cy1 + 6} Q ${cx1},${cy1 + waveAmp + 6} 59,${cy1 - waveAmp + 6}" fill="none" stroke="${p}" stroke-width="0.5" opacity="0.4" stroke-dasharray="2,2"/>
      <path d="M -5,${cy2} Q ${cx2},${cy2 - waveAmp} 59,${cy2 + waveAmp}" fill="none" stroke="${p}" stroke-width="0.7" opacity="0.5"/>
    `
  } else if (mode === 1) {
    // Dynamic angular velocity rays & structural geometry
    dynamicLayers = `
      <defs>
        <linearGradient id="rayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${p}" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <polygon points="0,0 ${cx1},0 ${cx2},85.6 0,85.6" fill="url(#rayGrad)"/>
      <line x1="0" y1="${cy1}" x2="54" y2="${cy1 + 10}" stroke="${a}" stroke-width="0.4" opacity="0.5"/>
      <line x1="0" y1="${cy2}" x2="54" y2="${cy2 - 8}" stroke="${p}" stroke-width="0.4" opacity="0.5"/>
      <circle cx="${cx1}" cy="${cy1}" r="2" fill="${a}" opacity="0.8"/>
      <circle cx="${cx2}" cy="${cy2}" r="2" fill="${p}" opacity="0.8"/>
    `
  } else {
    // Atmospheric cosmic depth & layered radiant prisms
    dynamicLayers = `
      <defs>
        <radialGradient id="prismGlow" cx="${cx2}%" cy="${cy2}%" r="65%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.4"/>
          <stop offset="60%" stop-color="${a}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${cx2}" cy="${cy2}" r="35" fill="url(#prismGlow)"/>
      <polyline points="0,${cy1} ${cx1},${cy1 - 5} 54,${cy1 + 8}" fill="none" stroke="${a}" stroke-width="0.6" opacity="0.5"/>
      <circle cx="8" cy="18" r="1.5" fill="#ffffff" opacity="0.85"/>
      <circle cx="46" cy="72" r="1.5" fill="#ffffff" opacity="0.85"/>
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
      <stop offset="0%" stop-color="${p}" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="${bg}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${a}" stop-opacity="0.22"/>
    </linearGradient>
  </defs>
  <rect width="54" height="85.6" fill="${bg}"/>
  <rect width="54" height="85.6" fill="url(#procBaseGlow)"/>
  <rect width="54" height="85.6" fill="url(#procCardWash)"/>
  ${dynamicLayers}
  <rect width="54" height="85.6" fill="none" stroke="${p}" stroke-width="0.4" opacity="0.25"/>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ─── Gemini Dynamic Vector SVG Artwork Generation ────────────────────────
// Calls Google Gemini with dynamic artistic instructions to synthesize custom
// vector SVG artwork tailored directly to the user's natural language event description
async function generateAiSvgArtworkWithGemini(
  genAI: GoogleGenerativeAI,
  options: {
    prompt?: string
    eventName?: string
    eventDescription?: string
    category?: string
    primaryColor?: string
    accentColor?: string
    backgroundColor?: string
  }
): Promise<{ url: string; modelName: string } | null> {
  const CANDIDATES = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest']
  const p = options.primaryColor || '#6366f1'
  const a = options.accentColor || '#ec4899'
  const bg = options.backgroundColor || '#090d16'

  const prompt = `
You are an expert generative graphics and vector artist creating an original vertical background artwork SVG for an official event ID card.
Event Name: "${options.eventName || 'Event'}"
Event Description: "${options.eventDescription || options.prompt || ''}"
Artistic Direction / Concept: "${options.prompt || ''}"
Color Palette: Primary ${p}, Accent ${a}, Deep Background ${bg}

CRITICAL RULES:
1. Root SVG element MUST be: <svg viewBox="0 0 54 85.6" width="54mm" height="85.6mm" xmlns="http://www.w3.org/2000/svg">
2. Deeply analyze the unique theme, atmosphere, era, culture, rhythms, or discipline of "${options.eventName || 'this event'}".
   - Create a rich, evocative, layered visual background (using gradients, lighting beams, rhythmic curves, geometric motifs, or atmospheric glow textures).
   - Safe visual zone: keep the center area (x: 10 to 44, y: 18 to 48) and bottom credential area clean and darker with subtle gradient wash so an attendee photo and text badge remain completely legible.
3. Absolutely NO text, NO typography, NO letters, NO words, NO logos.
4. Return ONLY valid SVG code. No markdown code blocks, no explanation, no preamble.
`

  for (const m of CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: m,
        generationConfig: {
          temperature: 0.85,
        },
      })
      const res = await model.generateContent(prompt)
      const rawText = res.response.text()
      const match = rawText.match(/<svg[\s\S]*?<\/svg>/i)
      if (match) {
        let svg = match[0]
        if (!svg.includes('viewBox')) {
          svg = svg.replace('<svg', '<svg viewBox="0 0 54 85.6" width="54mm" height="85.6mm"')
        }
        return {
          url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
          modelName: `${m} (AI Vector Artwork)`,
        }
      }
    } catch (e: any) {
      console.warn(`AI SVG model ${m} failed (${e.status || e.message?.slice(0, 60)}), trying fallback...`)
    }
  }
  return null
}

// ─── Image generation endpoint ───────────────────────────────────────────

interface CachedArtwork {
  imageUrl: string
  isGenerated: boolean
  prompt: string
  model?: string
}

const artworkCache = new Map<string, CachedArtwork>()

function createArtworkCacheKey(
  eventName?: string,
  eventDescription?: string,
  prompt?: string,
  draftId?: string,
  primaryColor?: string
): string {
  const norm = `${eventName || ''}|${eventDescription || ''}|${prompt || ''}|${draftId || ''}|${primaryColor || ''}`.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i)
    hash |= 0
  }
  return `art_${Math.abs(hash)}_${draftId || 'd'}`
}

app.post('/api/image/generate-background', async (req, res) => {
  try {
    const {
      prompt,
      eventName,
      eventDescription,
      category,
      primaryColor,
      accentColor,
      backgroundColor,
      concept,
      draftId,
      forceRegenerate,
    } = req.body as {
      prompt?: string
      eventName?: string
      eventDescription?: string
      category?: string
      primaryColor?: string
      accentColor?: string
      backgroundColor?: string
      concept?: string
      draftId?: string
      forceRegenerate?: boolean
    }

    const cacheKey = createArtworkCacheKey(eventName, eventDescription, prompt, draftId, primaryColor)
    if (forceRegenerate) {
      artworkCache.delete(cacheKey)
    } else if (artworkCache.has(cacheKey)) {
      const cached = artworkCache.get(cacheKey)!
      if (cached.isGenerated) {
        return res.json({
          success: true,
          imageUrl: cached.imageUrl,
          isGenerated: true,
          cached: true,
          model: cached.model,
          promptUsed: cached.prompt,
        })
      }
    }

    // 1. Try Google Generative AI raster image models if key is present
    if (process.env.GEMINI_API_KEY && prompt) {
      const genAI = getGenAI()
      try {
        const fullArtworkPrompt = `Cinematic vertical event ID card background artwork for "${eventName || 'Event'}". ${prompt}. High quality, rich lighting, detailed atmosphere and realistic textures, vertical portrait composition (3:4 aspect ratio). Completely clean negative space in the center for photo badge overlay. Absolutely NO text, NO typography, NO watermark, NO letters, NO numbers.`
        const result = await generateImageWithGemini(genAI, fullArtworkPrompt)
        const imageUrl = `data:${result.mimeType};base64,${result.data}`
        artworkCache.set(cacheKey, { imageUrl, isGenerated: true, prompt: fullArtworkPrompt, model: result.modelName })
        return res.json({
          success: true,
          imageUrl,
          isGenerated: true,
          model: result.modelName,
          promptUsed: fullArtworkPrompt,
        })
      } catch (imgErr: any) {
        console.warn('Gemini raster image model quota exceeded or unavailable:', imgErr.message?.slice(0, 100))
      }

      // 2. Dynamic AI Vector SVG Generation: Use Gemini to generate custom artwork for this exact event description
      try {
        const aiSvg = await generateAiSvgArtworkWithGemini(genAI, {
          prompt,
          eventName,
          eventDescription,
          category,
          primaryColor,
          accentColor,
          backgroundColor,
        })
        if (aiSvg) {
          artworkCache.set(cacheKey, { imageUrl: aiSvg.url, isGenerated: true, prompt: prompt || '', model: aiSvg.modelName })
          return res.json({
            success: true,
            imageUrl: aiSvg.url,
            isGenerated: true,
            model: aiSvg.modelName,
            promptUsed: prompt || '',
          })
        }
      } catch (svgErr: any) {
        console.warn('AI vector artwork generation failed:', svgErr.message?.slice(0, 100))
      }
    }

    // 3. Fallback: Dynamic procedural generative SVG artwork parameterized by event hash and colors
    const fallbackUrl = generateEventSpecificFallbackArtwork({
      eventName,
      eventDescription,
      primaryColor,
      accentColor,
      backgroundColor,
      concept,
    })

    return res.json({
      success: true,
      imageUrl: fallbackUrl,
      isGenerated: false,
      isFallback: true,
      message: 'Dynamic background artwork generated via procedural synthesis.',
      promptUsed: prompt || '',
    })
  } catch (err: any) {
    console.error('generate-background error:', err.message)
    res.status(500).json({ error: 'Failed to generate background artwork', detail: err.message })
  }
})

// ─── Generate drafts endpoint ────────────────────────────────────────────

app.post('/api/llm/generate-drafts', async (req, res) => {
  try {
    const { event, roles } = req.body
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ mode: 'deterministic' })
    }

    const genAI = getGenAI()
    const prompt = `
You are a world-class art director and identity designer creating 3 distinct, event-specific ID badge proposals.
Event: ${JSON.stringify(event)}
Roles: ${JSON.stringify(roles)}

CRITICAL INSTRUCTIONS:
1. Examine the ACTUAL event description and context deeply. Derive authentic visual aesthetics tailored specifically to this unique event.
2. Formulate 3 genuinely distinct design concepts for this event, extracting harmonious color palettes (primary, accent, background) and bespoke visual motifs.
3. For each proposal, provide an artworkPrompt suitable for an image generator capturing the atmosphere, lighting, and composition (portrait 3:4, clean negative space in the center, absolutely NO text or letters).

Return ONLY a valid JSON object matching this exact shape (no markdown, no backticks):
{
  "category": "music|business|sports|hackathon|robotics|cultural|conference|gaming|workshop|general",
  "visualDirection": "Detailed summary of the event visual concept and artistic identity",
  "drafts": [
    {
      "id": "modern-minimal",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "backgroundColor": "#hex",
      "artworkPrompt": "A highly descriptive image-generation prompt for a vertical portrait background artwork capturing the essence of the event, realistic lighting and scenery, absolutely NO text or typography"
    },
    {
      "id": "creative-tech",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "backgroundColor": "#hex",
      "artworkPrompt": "A highly descriptive image-generation prompt for a vertical portrait background artwork capturing the essence of the event, realistic lighting and scenery, absolutely NO text or typography"
    },
    {
      "id": "premium-editorial",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "backgroundColor": "#hex",
      "artworkPrompt": "A highly descriptive image-generation prompt for a vertical portrait background artwork capturing the essence of the event, realistic lighting and scenery, absolutely NO text or typography"
    }
  ]
}
`
    const raw = await generateWithGemini(genAI, prompt)
    const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    res.json(json)
  } catch (err: any) {
    console.error('LLM generate-drafts error:', err.message)
    res.status(200).json({ mode: 'deterministic' })
  }
})

// ─── NL Refinement endpoint ──────────────────────────────────────────────

app.post('/api/llm/refine', async (req, res) => {
  try {
    const { template, instruction } = req.body
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json(template)
    }

    const genAI = getGenAI()
    const prompt = `
Modify this card template JSON according to user instruction: "${instruction}"
Return ONLY updated valid JSON template.
Template JSON: ${JSON.stringify(template)}
`
    const raw = await generateWithGemini(genAI, prompt)
    const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''))
    res.json(json)
  } catch (err: any) {
    console.error('LLM refine error:', err.message)
    res.status(200).json(req.body.template)
  }
})

// ─── Health check ────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  let supabaseStatus = 'disconnected'
  try {
    const { error } = await supabaseServer.auth.getSession()
    if (!error) supabaseStatus = 'connected'
  } catch (err) {
    supabaseStatus = 'error'
  }

  res.json({ 
    status: 'ok', 
    llm: !!process.env.GEMINI_API_KEY ? 'enabled' : 'disabled (deterministic mode)',
    supabase: supabaseStatus,
    ts: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`\n🚀 CMS Server running at http://localhost:${PORT}`)
  console.log(`   LLM mode: ${process.env.GEMINI_API_KEY ? '✓ Gemini API' : '⚠ No API key — deterministic fallback'}`)
  console.log(`   Supabase: ${process.env.VITE_SUPABASE_URL ? '✓ Connected' : '⚠ Credentials missing'}`)
})

