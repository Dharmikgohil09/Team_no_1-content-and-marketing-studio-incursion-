import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { extractIntent } from '../../core/ai/intentExtractor'
import { generateQuestions } from '../../core/ai/questionGenerator'
import { DEFAULT_ROLES, getRoleOrDefault, type Role } from '../../core/schema/Role'

const EXAMPLES = [
  'ID cards for our 24-hour hackathon on 18 October at SVNIT, with separate looks for participants, organizers and mentors',
  'Name badges for ACM TechFest 2024 — 150 attendees, 20 speakers, 10 volunteers',
  'Event passes for InCursion Hackathon at NIT Surat, 200 participants and 15 organizers',
]

export function DescribePage() {
  const navigate      = useNavigate()
  const newProject    = useProjectStore(s => s.newProject)
  const addNlMessage  = useProjectStore(s => s.addNlMessage)
  const setWizardStep = useProjectStore(s => s.setWizardStep)

  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const textareaRef             = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit() {
    if (!text.trim()) { setError('Please describe your event first.'); return }
    setLoading(true)
    setError('')

    try {
      // Create project
      const project = newProject()
      addNlMessage('user', text)

      // Extract intent
      const intent = await extractIntent(text)
      addNlMessage('assistant', `Got it! I detected: ${Object.entries({
        name:      intent.eventContext.name.value,
        venue:     intent.eventContext.venue.value,
        date:      intent.eventContext.dateStart.value,
        duration:  intent.eventContext.duration.value,
        roles:     intent.roles.map((r: { label: string }) => r.label).join(', '),
      }).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' | ')}`)

      // Update store with parsed intent
      const parsedRoles: Role[] = intent.roles.map((r: { id: string; label: string; count?: number }) => {
        const found = DEFAULT_ROLES.find(d => d.id === r.id)
        if (found) return { ...found, count: r.count }
        const fallback = getRoleOrDefault(r.id)
        return { ...fallback, label: r.label, count: r.count }
      })
      // Ensure description is always preserved on eventContext for downstream theme matching
      intent.eventContext.description = { value: text, status: 'provided' }
      useProjectStore.getState().setEventContext(intent.eventContext)
      useProjectStore.getState().setRoles(parsedRoles)

      const remainingQuestions = generateQuestions(intent.eventContext, parsedRoles)
      if (remainingQuestions.length === 0) {
        setWizardStep(2)
        navigate('/studio/drafts')
      } else {
        setWizardStep(1)
        navigate('/studio/clarify')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-slide-up">
      {/* Page heading */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 1 of 6 — Describe Your Event
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-3">
          What are you designing today?
        </h1>
        <p className="text-slate-400 text-lg">
          Describe your event in natural language. The more detail you give, the fewer questions we'll ask.
        </p>
      </div>

      {/* Main input */}
      <div className="glass p-6 mb-6">
        <label className="label">Event Description</label>
        <textarea
          ref={textareaRef}
          id="event-description"
          className="textarea min-h-[140px] text-base leading-relaxed mb-4"
          placeholder="e.g. ID cards for our 24-hour hackathon on 18 October at SVNIT, with separate looks for participants, organizers and mentors"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
          }}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-xs">Ctrl+↵</kbd> to continue
          </span>
          <button
            id="describe-next-btn"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="btn-primary"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analysing…
              </>
            ) : (
              <>Continue →</>
            )}
          </button>
        </div>
      </div>

      {/* Quick-start examples */}
      <div>
        <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-medium">Quick-start examples</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              id={`example-btn-${i}`}
              onClick={() => { setText(ex); textareaRef.current?.focus() }}
              className="text-left px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]
                         hover:bg-white/[0.07] hover:border-acm-500/30 transition-all duration-150
                         text-sm text-slate-300 group"
            >
              <span className="text-acm-500 mr-2 group-hover:text-acm-400">→</span>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Asset upload hint */}
      <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-sm text-slate-500">
        <span className="text-slate-400 font-medium">💡 Tip:</span>{' '}
        You can upload logos, CSV participant data, and photos in later steps.
        We'll ask exactly the right follow-up questions.
      </div>
    </div>
  )
}
