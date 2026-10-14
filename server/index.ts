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
  const models = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']
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
- If MUSIC / CONCERT / SINGING: use live concert stage ambiance, audio equalizer waveforms, spotlight beams, glowing neon gradients (magenta/violet/cyan), musical note motifs, stage singer silhouette and cheering audience crowds.
- If BUSINESS / STARTUP / PITCH / SHARK TANK: use venture growth charts, executive spotlight, founder/pitch presenter silhouette, investor audience watermark, deep obsidian navy and amber gold accents.
- If GAMING / ESPORTS: use futuristic esports arena, laser grids, battlestations, cyber violet and neon cyan.
- If SPORTS: use athletic motion, dynamic jersey/stadium accents, sprinting runner athlete, spectator crowd silhouettes.
- If HACKATHON: use modern technology, matrix cascades, coder workspaces, electric blue/cyan accents.
- If ROBOTICS: use industrial robotic arms, engineering caliper lines, technical precision, cyan/amber/slate.
- If CULTURAL / ARTS / DANCE: use celebratory artistic flair, festive drapery arcs, leaping dancers, vibrant expression.
- If CONFERENCE / SEMINAR: use executive prestige, editorial typography, subtle institutional pinstripes.

Return ONLY a valid JSON object matching this exact shape (no markdown, no backticks):
{
  "category": "music|business|sports|hackathon|robotics|cultural|conference|gaming|workshop|general",
  "visualDirection": "Brief description of the visual identity",
  "drafts": [
    {
      "id": "modern-minimal",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex"
    },
    {
      "id": "creative-tech",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex"
    },
    {
      "id": "premium-editorial",
      "name": "Creative Event-Specific Title",
      "description": "Specific 1-2 sentence description explaining the visual elements chosen for this event",
      "primaryColor": "#hex",
      "accentColor": "#hex"
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

