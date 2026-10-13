import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { generateQuestions, type Question } from '../../core/ai/questionGenerator'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../../brandKits/defaultLogos'
import type { EventContext } from '../../core/schema/EventContext'
import { DEFAULT_ROLES } from '../../core/schema/Role'

export function ClarifyPage() {
  const navigate        = useNavigate()
  const project         = useProjectStore(s => s.project)
  const setEventContext = useProjectStore(s => s.setEventContext)
  const setRoles        = useProjectStore(s => s.setRoles)
  const setWizardStep   = useProjectStore(s => s.setWizardStep)

  const instituteLogo      = useProjectStore(s => s.instituteLogo)
  const clubLogo           = useProjectStore(s => s.clubLogo)
  const setInstituteLogo   = useProjectStore(s => s.setInstituteLogo)
  const setClubLogo        = useProjectStore(s => s.setClubLogo)
  const resetInstituteLogo = useProjectStore(s => s.resetInstituteLogo)
  const resetClubLogo      = useProjectStore(s => s.resetClubLogo)

  const instInputRef = useRef<HTMLInputElement>(null)
  const clubInputRef = useRef<HTMLInputElement>(null)

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [questions, setQuestions] = useState<Question[]>([])

  function handleInstituteUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setInstituteLogo(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function handleClubUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setClubLogo(reader.result)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!project) { navigate('/studio/describe'); return }
    const qs = generateQuestions(project.eventContext, project.roles)
    setQuestions(qs)
  }, [project])

  if (!project) return null

  function handleAnswer(qid: string, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [qid]: value }))
  }

  function handleSkip(qid: string) {
    setAnswers(prev => ({ ...prev, [qid]: '__skipped__' }))
  }

  function applyAnswers() {
    const ctx = { ...project!.eventContext }
    for (const q of questions) {
      const val = answers[q.id]
      if (!val || val === '__skipped__') continue

      if (q.field === 'name')      ctx.name      = { value: String(val), status: 'confirmed' }
      if (q.field === 'category')  (ctx as any).category = { value: String(val), status: 'confirmed' }
      if (q.field === 'dateStart') ctx.dateStart  = { value: String(val), status: 'confirmed' }
      if (q.field === 'venue')     ctx.venue      = { value: String(val), status: 'confirmed' }
      if (q.field === 'tagline')   ctx.tagline    = { value: String(val), status: 'confirmed' }
      if (q.field === 'contact')   ctx.contact    = { value: String(val), status: 'confirmed' }
      if (q.field === 'website')   ctx.website    = { value: String(val) as any, status: 'confirmed' }

      if (q.field === 'roles' && Array.isArray(val)) {
        setRoles(val.map(id => DEFAULT_ROLES.find(r => r.id === id) ?? DEFAULT_ROLES[0]))
      }
    }
    setEventContext(ctx as Partial<EventContext>)
  }

  function handleContinue() {
    applyAnswers()
    setWizardStep(2)
    navigate('/studio/drafts')
  }

  // Count answered required questions
  const requiredQs  = questions.filter(q => q.required)
  const answeredReq = requiredQs.filter(q => answers[q.id] && answers[q.id] !== '__skipped__').length
  const canContinue = answeredReq === requiredQs.length || requiredQs.length === 0

  // Show already-known info as chips
  const knownFields = Object.entries(project.eventContext)
    .filter(([, v]) => v.status === 'provided' && v.value)
    .map(([k, v]) => ({ key: k, value: String(v.value) }))

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 2 of 6 — Fill in Missing Details
        </div>
        <h1 className="text-2xl font-display font-bold text-white mb-2">
          Let's fill in the gaps
        </h1>
        <p className="text-slate-400">
          I extracted what I could. Answer only what's needed — skip anything optional.
        </p>
      </div>

      {/* Already known chips */}
      {knownFields.length > 0 && (
        <div className="glass-sm p-4 mb-6">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Already detected ✓</p>
          <div className="flex flex-wrap gap-2">
            {knownFields.map(({ key, value }) => (
              <span key={key} className="chip">
                <span className="text-acm-400">✓</span>
                <span className="text-slate-300 capitalize">{key}:</span>
                <span className="font-medium">{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions */}
      {questions.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-white font-semibold mb-1">All details captured!</p>
          <p className="text-slate-400 text-sm">No clarifying questions needed. Let's generate your drafts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map(q => (
            <QuestionCard
              key={q.id}
              question={q}
              value={answers[q.id]}
              onAnswer={val => handleAnswer(q.id, val)}
              onSkip={() => handleSkip(q.id)}
            />
          ))}
        </div>
      )}

      {/* Logos Section */}
      <div className="glass p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Event & Institute Logos</h3>
            <p className="text-xs text-slate-400">SVNIT is used as default institute logo and ACM for club/event logo. You can upload custom logos anytime.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Institute Logo */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={instituteLogo} alt="SVNIT Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-slate-200">Institute Logo</span>
                <span className="text-[10px] text-slate-400">{instituteLogo === DEFAULT_SVNIT_LOGO ? 'SVNIT' : 'Custom'}</span>
              </div>
              <input ref={instInputRef} type="file" accept="image/*" className="hidden" onChange={handleInstituteUpload} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => instInputRef.current?.click()}
                  className="btn-secondary text-[11px] py-1 px-2.5"
                >
                  📁 Change Logo
                </button>
                {instituteLogo !== DEFAULT_SVNIT_LOGO && (
                  <button type="button" onClick={resetInstituteLogo} className="text-[11px] text-slate-400 hover:text-white underline">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Club / Event Logo */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-surface-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
              <img src={clubLogo} alt="ACM Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-slate-200">Club / Event Logo</span>
                <span className="text-[10px] text-slate-400">{clubLogo === DEFAULT_ACM_LOGO ? 'ACM' : 'Custom'}</span>
              </div>
              <input ref={clubInputRef} type="file" accept="image/*" className="hidden" onChange={handleClubUpload} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clubInputRef.current?.click()}
                  className="btn-secondary text-[11px] py-1 px-2.5"
                >
                  📁 Change Logo
                </button>
                {clubLogo !== DEFAULT_ACM_LOGO && (
                  <button type="button" onClick={resetClubLogo} className="text-[11px] text-slate-400 hover:text-white underline">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-6 mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>{answeredReq}/{requiredQs.length} required fields completed</span>
        {!canContinue && <span className="text-amber-400">Complete required fields to continue</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/studio/describe')} className="btn-secondary">
          ← Back
        </button>
        <button
          id="clarify-continue-btn"
          onClick={handleContinue}
          disabled={!canContinue}
          className="btn-primary flex-1"
        >
          Generate Drafts →
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function QuestionCard({
  question, value, onAnswer, onSkip
}: {
  question: Question
  value:    string | string[] | undefined
  onAnswer: (val: string | string[]) => void
  onSkip:   () => void
}) {
  const isSkipped   = value === '__skipped__'
  const isAnswered  = value && value !== '__skipped__'

  return (
    <div className={`glass p-5 transition-all duration-200 ${isAnswered ? 'border-acm-500/30' : ''} ${isSkipped ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {question.required ? (
              <span className="badge-red py-0.5 px-2 text-[10px]">Required</span>
            ) : (
              <span className="badge py-0.5 px-2 text-[10px] bg-white/[0.04] text-slate-500 border border-white/[0.08]">Optional</span>
            )}
            {isAnswered && <span className="badge-green py-0.5 px-2 text-[10px]">✓ Answered</span>}
          </div>
          <label className="text-sm font-medium text-white">{question.label}</label>
          {question.hint && <p className="text-xs text-slate-500 mt-0.5">{question.hint}</p>}
        </div>
        {!question.required && !isSkipped && (
          <button onClick={onSkip} className="btn-ghost text-xs shrink-0 py-1">
            Skip
          </button>
        )}
      </div>

      {/* Input based on type */}
      {!isSkipped && (
        <QuestionInput question={question} value={value} onAnswer={onAnswer} />
      )}
    </div>
  )
}

function QuestionInput({ question, value, onAnswer }: {
  question: Question
  value:    string | string[] | undefined
  onAnswer: (val: string | string[]) => void
}) {
  if (question.type === 'text') {
    return (
      <input
        id={question.id}
        type="text"
        className="input"
        placeholder={question.hint}
        value={typeof value === 'string' ? value : ''}
        onChange={e => onAnswer(e.target.value)}
      />
    )
  }

  if (question.type === 'date') {
    return (
      <input
        id={question.id}
        type="date"
        className="input"
        value={typeof value === 'string' ? value : ''}
        onChange={e => onAnswer(e.target.value)}
      />
    )
  }

  if (question.type === 'multiselect' && question.options) {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map(opt => (
          <button
            key={opt.value}
            id={`${question.id}-${opt.value}`}
            onClick={() => {
              const next = selected.includes(opt.value)
                ? selected.filter(v => v !== opt.value)
                : [...selected, opt.value]
              onAnswer(next)
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border
              ${selected.includes(opt.value)
                ? 'bg-acm-600/30 text-acm-300 border-acm-500/50'
                : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:border-white/[0.2]'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'select' && question.options) {
    return (
      <select
        id={question.id}
        className="input"
        value={typeof value === 'string' ? value : ''}
        onChange={e => onAnswer(e.target.value)}
      >
        <option value="">Select…</option>
        {question.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  return null
}
