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
  const models = ['gemini-3-flash-preview', 'gemini-3.8-flash', 'gemini-3.1-pro-preview']
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
   - "sports" for tournaments, leagues, matches, athletic competitions (football, cricket, etc.)
   - "hackathon" for hackathons, coding contests, codefests
   - "robotics" for robotics, battlebots, hardware competitions
   - "conference" for business conferences, summits, symposiums
   - "cultural" for arts, garba, dandiya, navratri, music, dance festivals, cultural celebrations
   - "music" for concerts, singing competitions, musical fests, band shows
   - "business" for startup pitch competitions, shark tank events, investor syndicates
   - "gaming" for esports tournaments, gaming LANs, game dev contests
   - "workshop" for hands-on bootcamps, masterclasses, technical seminars
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

// ─── Event-specific generative SVG artwork fallback ───────────────────────
// When external image model quota is exceeded (e.g. Free Tier limit: 0),
// generate a rich, distinct, high-fidelity procedural artwork based on the AI's concept
function generateEventSpecificFallbackArtwork(options: {
  eventName?: string
  eventDescription?: string
  category?: string
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  concept?: string
}): string {
  const p = options.primaryColor || '#6366f1'
  const a = options.accentColor || '#ec4899'
  const bg = options.backgroundColor || '#090d16'
  const desc = (options.eventDescription || options.concept || '').toLowerCase()
  const isCulturalOrGarba = desc.includes('garba') || desc.includes('dandiya') || desc.includes('navratri') || desc.includes('folk') || desc.includes('festive')
  const isDanceOrHipHop = desc.includes('hip') || desc.includes('hop') || desc.includes('dance') || desc.includes('cypher') || desc.includes('battle') || desc.includes('dj')
  const isSports = desc.includes('sport') || desc.includes('cricket') || desc.includes('football') || desc.includes('tournament') || desc.includes('league')
  const isTechOrRobotics = desc.includes('hack') || desc.includes('robot') || desc.includes('code') || desc.includes('cyber') || desc.includes('tech')

  let decorativeElements = ''

  if (isCulturalOrGarba) {
    // Rich traditional festive lighting, radiant mandala arcs and celebratory star motifs
    decorativeElements = `
      <defs>
        <radialGradient id="diyaGlow" cx="50%" cy="85%" r="65%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.45"/>
          <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="festiveDrapes" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${a}" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <circle cx="27" cy="80" r="35" fill="url(#diyaGlow)" />
      <!-- Radiant festoon arcs -->
      <path d="M -10,15 Q 27,35 64,15" fill="none" stroke="${a}" stroke-width="0.75" opacity="0.6"/>
      <path d="M -10,22 Q 27,42 64,22" fill="none" stroke="#fbbf24" stroke-width="0.5" opacity="0.4" stroke-dasharray="1.5,1.5"/>
      <!-- Celebratory cultural starbursts -->
      <g transform="translate(10, 28) scale(0.6)" fill="#fbbf24" opacity="0.7">
        <polygon points="5,0 6.5,3.5 10,5 6.5,6.5 5,10 3.5,6.5 0,5 3.5,3.5"/>
      </g>
      <g transform="translate(42, 28) scale(0.6)" fill="#fbbf24" opacity="0.7">
        <polygon points="5,0 6.5,3.5 10,5 6.5,6.5 5,10 3.5,6.5 0,5 3.5,3.5"/>
      </g>
      <!-- Hanging traditional festive lantern motif -->
      <line x1="8" y1="0" x2="8" y2="18" stroke="#fbbf24" stroke-width="0.35" opacity="0.7"/>
      <polygon points="8,18 5.5,23 10.5,23" fill="${a}" opacity="0.8"/>
      <line x1="46" y1="0" x2="46" y2="18" stroke="#fbbf24" stroke-width="0.35" opacity="0.7"/>
      <polygon points="46,18 43.5,23 48.5,23" fill="${a}" opacity="0.8"/>
    `
  } else if (isDanceOrHipHop) {
    // Modern urban street-dance cypher: dramatic stage light beams, neon angled trusses and audio frequencies
    decorativeElements = `
      <defs>
        <linearGradient id="neonBeam1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${a}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="neonBeam2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <!-- Angled stage searchlight beams -->
      <polygon points="0,0 20,0 45,86 0,86" fill="url(#neonBeam1)" />
      <polygon points="54,0 34,0 9,86 54,86" fill="url(#neonBeam2)" />
      <!-- Urban stage grid & rhythm bars -->
      <line x1="0" y1="70" x2="54" y2="70" stroke="${a}" stroke-width="0.4" opacity="0.5"/>
      <line x1="0" y1="75" x2="54" y2="75" stroke="${p}" stroke-width="0.25" opacity="0.4"/>
      <!-- Neon spotlight bursts -->
      <circle cx="8" cy="18" r="1.5" fill="#ffffff" opacity="0.9"/>
      <circle cx="46" cy="18" r="1.5" fill="#ffffff" opacity="0.9"/>
    `
  } else if (isSports) {
    // Dynamic athletic speed chevrons, track curves and stadium floodlight flares
    decorativeElements = `
      <defs>
        <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${p}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${a}" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <!-- Stadium dynamic curved motion tracks -->
      <path d="M -10,35 Q 27,15 64,45" fill="none" stroke="${a}" stroke-width="1.2" opacity="0.6"/>
      <path d="M -10,42 Q 27,22 64,52" fill="none" stroke="${p}" stroke-width="0.8" opacity="0.4"/>
      <!-- Athletic angular slash -->
      <polygon points="0,0 15,0 35,86 20,86" fill="url(#speedGrad)" />
    `
  } else if (isTechOrRobotics) {
    // Precision engineering lines, subtle circuit traces and cybernetic glow
    decorativeElements = `
      <defs>
        <pattern id="techGrid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="${p}" stroke-width="0.15" opacity="0.2"/>
        </pattern>
      </defs>
      <rect width="54" height="85.6" fill="url(#techGrid)"/>
      <!-- Precision bus lines -->
      <polyline points="4,25 12,25 18,32 36,32 42,25 50,25" fill="none" stroke="${a}" stroke-width="0.5" opacity="0.6"/>
      <circle cx="18" cy="32" r="1" fill="${a}" opacity="0.8"/>
      <circle cx="36" cy="32" r="1" fill="${a}" opacity="0.8"/>
    `
  } else {
    // Ambient editorial atmospheric depth
    decorativeElements = `
      <circle cx="10" cy="20" r="22" fill="${p}" opacity="0.15" filter="blur(8px)"/>
      <circle cx="44" cy="70" r="24" fill="${a}" opacity="0.15" filter="blur(8px)"/>
    `
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 85.6" width="54mm" height="85.6mm">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${p}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${bg}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="cardWash" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p}" stop-opacity="0.25"/>
      <stop offset="50%" stop-color="${bg}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${a}" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <!-- Deep Base Surface -->
  <rect width="54" height="85.6" fill="${bg}"/>
  <rect width="54" height="85.6" fill="url(#bgGlow)"/>
  <rect width="54" height="85.6" fill="url(#cardWash)"/>
  ${decorativeElements}
  <!-- Subtle Vignette Frame for text readability -->
  <rect width="54" height="85.6" fill="none" stroke="${p}" stroke-width="0.5" opacity="0.3"/>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ─── Gemini Dynamic Vector SVG Artwork Generation ────────────────────────
// When raster image model quota is exceeded (e.g. Free Tier limit: 0),
// use Gemini to dynamically generate custom event-specific SVG artwork on the fly
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
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
    const prompt = `
You are a senior identity & visual designer creating vector background artwork for an event ID card.
Event Name: "${options.eventName || 'Event'}"
Event Details: "${options.eventDescription || options.prompt || ''}"
Category & Concept: "${options.category || ''}" - ${options.prompt || ''}
Color Palette: Primary ${options.primaryColor || '#6366f1'}, Accent ${options.accentColor || '#ec4899'}, Base Background ${options.backgroundColor || '#090d16'}

CRITICAL DESIGN SPECIFICATIONS:
1. Root element MUST be: <svg viewBox="0 0 54 85.6" width="54mm" height="85.6mm" xmlns="http://www.w3.org/2000/svg">
2. Create an atmospheric, deeply inspired visual background that communicates the exact nature of this event.
   - For traditional Indian cultural festivals (e.g. Garba/Navratri): use intricate Bandhani/Patola geometric arcs, festive diya/lantern glows, ornamental floral star mandalas, and rich warm jewel tones.
   - For modern urban dance / music battles: use dynamic stage light searchlights, neon lasers, soundwave frequency grids, and deep urban club contrasts.
   - For sports tournaments: use athletic speed vectors, turf/court texture gradients, and stadium light flares.
   - For hackathons/robotics/tech: use precision engineering gridlines, circuit nodes, and cybernetic telemetry rays.
3. Keep the center area (around y: 20 to 50) and lower credential area clean/darker with subtle gradients so attendee photos and typography remain 100% readable.
4. Absolutely NO text, NO typography, NO letters, NO words, NO logos.
5. Return ONLY the raw valid <svg>...</svg> code. Absolutely NO markdown backticks, NO markdown tags, NO preamble.
`
    const res = await model.generateContent(prompt)
    const text = res.response.text().trim().replace(/```xml?\n?/g, '').replace(/```svg?\n?/g, '').replace(/```/g, '').trim()
    if (text.startsWith('<svg') && text.endsWith('</svg>')) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`
    }
  } catch (err: any) {
    console.warn('AI SVG background generation error:', err.message?.slice(0, 100))
  }
  return null
}

// ─── Image generation endpoint ───────────────────────────────────────────

const artworkCache = new Map<string, { imageUrl: string; isGenerated: boolean; prompt: string }>()

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

    const cacheKey = `${draftId || 'draft'}_${eventName || ''}_${prompt?.slice(0, 40) || ''}`
    if (!forceRegenerate && artworkCache.has(cacheKey)) {
      const cached = artworkCache.get(cacheKey)!
      return res.json({
        success: true,
        imageUrl: cached.imageUrl,
        isGenerated: cached.isGenerated,
        cached: true,
        promptUsed: cached.prompt,
      })
    }

    // 1. Try Google Generative AI raster image models if key is present
    if (process.env.GEMINI_API_KEY && prompt) {
      const genAI = getGenAI()
      try {
        const fullArtworkPrompt = `Cinematic vertical event ID card background artwork for "${eventName || 'Event'}". ${prompt}. High quality, rich lighting, detailed atmosphere and realistic textures, vertical portrait composition (3:4 aspect ratio). Completely clean negative space in the center for photo badge overlay. Absolutely NO text, NO typography, NO watermark, NO letters, NO numbers.`
        const result = await generateImageWithGemini(genAI, fullArtworkPrompt)
        const imageUrl = `data:${result.mimeType};base64,${result.data}`
        artworkCache.set(cacheKey, { imageUrl, isGenerated: true, prompt: fullArtworkPrompt })
        return res.json({
          success: true,
          imageUrl,
          isGenerated: true,
          model: result.modelName,
          promptUsed: fullArtworkPrompt,
        })
      } catch (imgErr: any) {
        console.warn('Gemini raster image model quota exceeded or unavailable:', imgErr.message?.slice(0, 120))
      }

      // 2. Dynamic AI Vector SVG Generation: Use Gemini to generate custom artwork for this exact event description
      try {
        const aiSvgUrl = await generateAiSvgArtworkWithGemini(genAI, {
          prompt,
          eventName,
          eventDescription,
          category,
          primaryColor,
          accentColor,
          backgroundColor,
        })
        if (aiSvgUrl) {
          artworkCache.set(cacheKey, { imageUrl: aiSvgUrl, isGenerated: true, prompt: prompt || '' })
          return res.json({
            success: true,
            imageUrl: aiSvgUrl,
            isGenerated: true,
            model: 'gemini-3-flash-preview (AI Vector Artwork)',
            promptUsed: prompt || '',
          })
        }
      } catch (svgErr: any) {
        console.warn('AI vector artwork generation failed:', svgErr.message?.slice(0, 100))
      }
    }

    // 3. Fallback: Event-specific generative artwork derived from the AI concept
    const fallbackUrl = generateEventSpecificFallbackArtwork({
      eventName,
      eventDescription,
      category,
      primaryColor,
      accentColor,
      backgroundColor,
      concept,
    })

    artworkCache.set(cacheKey, { imageUrl: fallbackUrl, isGenerated: false, prompt: prompt || '' })
    return res.json({
      success: true,
      imageUrl: fallbackUrl,
      isGenerated: false,
      isFallback: true,
      message: 'Gemini image generation model quota reached. Using event-specific generative background artwork fallback.',
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
1. Examine the ACTUAL event description and context deeply. Do NOT use generic silhouettes or repetitive preset themes.
2. If it is an Indian cultural celebration like traditional Garba/Dandiya, derive rich traditional Gujarati folk-dance aesthetics, textile patterns, festive lighting and warm jewel tones.
3. If it is a modern hip-hop dance battle, derive contemporary street-dance culture, stage lighting rigs, boombox / audio waveforms, urban arena glow and dynamic neon accents.
4. If it is a technical or robotics event, derive engineering schematics, precision titanium / circuit aesthetics.
5. If it is a sports tournament, derive the exact sport's dynamics, court/pitch turf textures, and athletic velocity lines.
6. Create 3 genuinely distinct design concepts for this event, each with an artworkPrompt suitable for an image generator (NO text, vertical portrait format, clean negative space in the center).

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

