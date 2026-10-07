import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

// ─── Intent extraction endpoint ────────────────────────────────────────────

app.post('/api/llm/extract-intent', async (req, res) => {
  try {
    const { text } = req.body as { text: string }
    if (!text) { res.status(400).json({ error: 'text required' }); return }

    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
    const result = await model.generateContent(prompt)
    const raw    = result.response.text().trim()
    const json   = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''))
    res.json(json)
  } catch (err: any) {
    console.error('LLM extract-intent error:', err.message)
    res.status(500).json({ error: 'LLM failed', detail: err.message })
  }
})

// ─── Generate drafts endpoint ────────────────────────────────────────────

app.post('/api/llm/generate-drafts', async (req, res) => {
  // In no-LLM mode, this just signals to use built-in templates
  res.status(501).json({ error: 'Use client-side deterministic drafts' })
})

// ─── NL Refinement endpoint ──────────────────────────────────────────────

app.post('/api/llm/refine', async (req, res) => {
  res.status(501).json({ error: 'Use client-side deterministic refinement' })
})

// ─── Health check ────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    llm: !!process.env.GEMINI_API_KEY ? 'enabled' : 'disabled (deterministic mode)',
    ts: new Date().toISOString()
  })
})

app.listen(PORT, () => {
  console.log(`\n🚀 CMS Server running at http://localhost:${PORT}`)
  console.log(`   LLM mode: ${process.env.GEMINI_API_KEY ? '✓ Gemini API' : '⚠ No API key — deterministic fallback'}`)
})
