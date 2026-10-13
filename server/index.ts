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
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite']
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
You are an event design assistant. Extract structured data from the user's event description.
Return ONLY valid JSON matching this exact shape (no markdown, no explanation):
{
  "eventContext": {
    "name":      { "value": "string|null", "status": "provided|missing" },
    "tagline":   { "value": "string|null", "status": "provided|missing" },
    "dateStart": { "value": "YYYY-MM-DD|null", "status": "provided|missing" },
    "dateEnd":   { "value": "YYYY-MM-DD|null", "status": "provided|missing" },
    "duration":  { "value": "string|null", "status": "provided|missing" },
    "venue":     { "value": "string|null", "status": "provided|missing" },
    "organizer": { "value": "string|null", "status": "provided|missing" },
    "website":   { "value": null, "status": "missing" },
    "contact":   { "value": null, "status": "missing" }
  },
  "roles": [
    { "id": "participant|organizer|mentor|volunteer|speaker", "label": "string", "count": number|null }
  ],
  "designType": "idCard",
  "confidence": 0.0-1.0
}
IMPORTANT: Only extract information explicitly mentioned. Do NOT invent data. Set status "missing" for anything not stated.

User description: "${text}"
`
    const raw = await generateWithGemini(genAI, prompt)
    const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''))
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
You are a expert graphic design generator for event ID cards.
Given this event details: ${JSON.stringify(event)}
And these roles: ${JSON.stringify(roles)}

Suggest theme colors (primary, accent, background) and title style for 3 distinct card designs (Cyber/Modern, Bold Accent, Minimal Clean).
Return ONLY valid JSON matching this shape:
{
  "theme": { "primary": "#hex", "accent": "#hex", "bgDark": "#hex" },
  "styleHint": "description string"
}
`
    const raw = await generateWithGemini(genAI, prompt)
    const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''))
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

