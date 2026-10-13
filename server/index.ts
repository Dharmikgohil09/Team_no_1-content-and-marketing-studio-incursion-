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
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
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
2. NEVER invent fake event names, dates, venues, or roles. If a detail is not provided, set value to null and status to "missing".
3. Distinguish confirmed provided information from missing information.
4. Extract the event category accurately:
   - "sports" for tournaments, leagues, matches, athletic competitions (football, cricket, etc.)
   - "hackathon" for hackathons, coding contests, codefests
   - "robotics" for robotics, battlebots, hardware competitions
   - "conference" for business conferences, summits, symposiums
   - "cultural" for arts, music, dance festivals, cultural celebrations
   - "workshop" for hands-on bootcamps, masterclasses, technical seminars
   - "general" if not specifically categorized.

Return ONLY a valid JSON object matching this exact shape (no markdown, no backticks, no conversational text):
{
  "eventContext": {
    "name":             { "value": "string or null", "status": "provided or missing" },
    "category":         { "value": "sports|hackathon|robotics|conference|cultural|music|workshop|general", "status": "provided or missing" },
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
    { "id": "participant|organizer|mentor|volunteer|judge|speaker|player|referee|artist|vocalist|custom", "label": "string", "count": null }
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

// ─── Generate drafts endpoint ────────────────────────────────────────────

app.post('/api/llm/generate-drafts', async (req, res) => {
  try {
    const { event, roles } = req.body
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ mode: 'deterministic' })
    }

    const genAI = getGenAI()
    const prompt = `
You are a senior art director creating event-specific ID badge proposals.
Event: ${JSON.stringify(event)}
Roles: ${JSON.stringify(roles)}

Create 3 distinct design concepts that genuinely match the event category and theme:
- If MUSIC / CONCERT / SINGING: use live concert stage ambiance, audio equalizer waveforms, spotlight beams, glowing neon gradients (magenta/violet/cyan), musical note motifs.
- If SPORTS: use athletic motion, dynamic jersey/stadium accents, energetic palettes (e.g. navy/gold, emerald/volt, crimson/white).
- If HACKATHON: use modern technology, cyber/electric accents, clean tech geometry.
- If ROBOTICS: use engineering caliper lines, technical precision, cyan/amber/slate.
- If CULTURAL / ARTS: use celebratory artistic flair, festive gradients, vibrant expression.
- If CONFERENCE / SEMINAR: use executive prestige, editorial typography, subtle institutional pinstripes.

Return ONLY a valid JSON object matching this exact shape (no markdown, no backticks):
{
  "category": "sports|hackathon|robotics|conference|cultural|music|workshop|general",
  "visualDirection": "Brief description of the visual identity",
  "drafts": [
    {
      "id": "modern-minimal",
      "name": "Modern Minimal",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "motif": "sports-stripes|tech-circuits|concert-soundwaves|clean-minimal|engineering-grid|celebratory-arcs"
    },
    {
      "id": "bold-dynamic",
      "name": "Bold Dynamic",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "motif": "sports-stripes|tech-circuits|clean-minimal|engineering-grid|celebratory-arcs"
    },
    {
      "id": "premium-editorial",
      "name": "Premium Editorial",
      "primaryColor": "#hex",
      "accentColor": "#hex",
      "motif": "sports-stripes|tech-circuits|clean-minimal|engineering-grid|celebratory-arcs"
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

