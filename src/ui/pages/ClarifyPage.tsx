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
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')

  const CATEGORY_OPTIONS = [
    { value: 'workshop',   label: 'Academic / Quiz / Workshop', icon: '🎓', desc: 'Quizzes, trivia, academic competitions, bootcamps' },
    { value: 'hackathon',  label: 'Hackathon & Coding',        icon: '💻', desc: 'Hackathons, coding challenges, datathons' },
    { value: 'cultural',   label: 'Cultural & Arts',           icon: '🎭', desc: 'Festivals, dance, drama, garba, celebrations' },
    { value: 'sports',     label: 'Sports & Athletics',        icon: '⚽', desc: 'Tournaments, matches, leagues, athletics' },
    { value: 'music',      label: 'Music & Concert',           icon: '🎵', desc: 'Live concerts, singing, band shows' },
    { value: 'business',   label: 'Business & Startup Pitch',  icon: '💼', desc: 'Startup summits, shark tank pitches, investors' },
    { value: 'gaming',     label: 'Gaming & Esports',          icon: '🎮', desc: 'Esports tourneys, LAN parties, competitive gaming' },
    { value: 'robotics',   label: 'Robotics & Hardware',       icon: '🤖', desc: 'RoboWars, battlebots, mechatronics' },
    { value: 'conference', label: 'Conference & Summit',       icon: '🎤', desc: 'Symposiums, keynotes, executive summits' },
    { value: 'general',    label: 'General Event',             icon: '🌐', desc: 'Standard multipurpose event passes' },
  ]

  function handleCategoryChange(newCat: string) {
    if (!project) return
    const updatedCtx = {
      ...project.eventContext,
      category: { value: newCat, status: 'confirmed' as const }
    }
    setEventContext(updatedCtx)
    const catLabel = CATEGORY_OPTIONS.find(c => c.value === newCat)?.label || newCat
    setFeedbackMsg(`Category updated to ${catLabel}`)
    setTimeout(() => setFeedbackMsg(''), 3500)
  }

  function handleParticipantCountChange(count: number) {
    if (!project || count < 1) return
    const updatedCtx = {
      ...project.eventContext,
      participantCount: { value: count, status: 'confirmed' as const }
    }
    setEventContext(updatedCtx)

    const updatedRoles = project.roles.map(r =>
      (r.id === 'participant' || r.id === 'player') ? { ...r, count } : r
    )
    setRoles(updatedRoles)

    try {
      sessionStorage.setItem('cms_expected_participants', String(count))
    } catch {}

    setFeedbackMsg(`Participant count set to ${count}`)
    setTimeout(() => setFeedbackMsg(''), 3000)
  }

  function handleStartEditDesc() {
    setDescDraft(project?.eventContext?.description?.value || '')
    setEditingDesc(true)
  }

  function handleSaveDesc() {
    if (!project) return
    const val = descDraft.trim()
    const updatedCtx = {
      ...project.eventContext,
      description: { value: val, status: 'provided' as const }
    }
    setEventContext(updatedCtx)
    try {
      sessionStorage.setItem('cms_event_description', val)
    } catch {}
    setEditingDesc(false)
    setFeedbackMsg('Event description updated')
    setTimeout(() => setFeedbackMsg(''), 3000)
  }

  function handleEventNameChange(name: string) {
    if (!project) return
    const updatedCtx = {
      ...project.eventContext,
      name: { value: name, status: name.trim() ? ('confirmed' as const) : ('missing' as const) }
    }
    setEventContext(updatedCtx)
    setFeedbackMsg('Event name updated')
    setTimeout(() => setFeedbackMsg(''), 2500)
  }

  function handleDateChange(date: string) {
    if (!project) return
    const updatedCtx = {
      ...project.eventContext,
      dateStart: { value: date, status: date.trim() ? ('confirmed' as const) : ('missing' as const) }
    }
    setEventContext(updatedCtx)
    setFeedbackMsg('Date updated')
    setTimeout(() => setFeedbackMsg(''), 2500)
  }

  function handleVenueChange(venue: string) {
    if (!project) return
    const updatedCtx = {
      ...project.eventContext,
      venue: { value: venue, status: venue.trim() ? ('confirmed' as const) : ('missing' as const) }
    }
    setEventContext(updatedCtx)
    setFeedbackMsg('Venue updated')
    setTimeout(() => setFeedbackMsg(''), 2500)
  }

  function handleOrganizerChange(organizer: string) {
    if (!project) return
    const updatedCtx = {
      ...project.eventContext,
      organizer: { value: organizer, status: organizer.trim() ? ('confirmed' as const) : ('missing' as const) }
    }
    setEventContext(updatedCtx)
    setFeedbackMsg('Organizer updated')
    setTimeout(() => setFeedbackMsg(''), 2500)
  }

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
    const hasInput = Boolean(project?.eventContext?.description?.value?.trim() || project?.eventContext?.name?.value?.trim())
    if (!project || !hasInput) {
      navigate('/studio/describe', { replace: true })
      return
    }
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
      if (q.field === 'organizer') ctx.organizer  = { value: String(val), status: 'confirmed' }
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
    try {
      const descVal = project?.eventContext?.description?.value
      if (descVal) {
        sessionStorage.setItem('cms_event_description', descVal)
      }
    } catch {}
    setWizardStep(2)
    navigate('/studio/drafts')
  }

  // Count answered required questions
  const requiredQs  = questions.filter(q => q.required)
  const answeredReq = requiredQs.filter(q => answers[q.id] && answers[q.id] !== '__skipped__').length
  const hasEventName = Boolean(project.eventContext.name?.value?.trim() || answers['q-event-name'])
  const canContinue = hasEventName && (answeredReq === requiredQs.length || requiredQs.length === 0)

  // Show already-known info as chips (excluding date and venue)
  const knownFields = Object.entries(project.eventContext)
    .filter(([k, v]) => k !== 'dateStart' && k !== 'dateEnd' && k !== 'venue' && v.status === 'provided' && v.value)
    .map(([k, v]) => ({ key: k, value: String(v.value) }))

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          Step 2 of 6 — Fill in Missing Details
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-normal text-ink mb-2">
          Let's fill in the gaps
        </h1>
        <p className="text-text">
          I extracted what I could. Answer only what's needed — skip anything optional.
        </p>
      </div>

      {/* Interactive AI Detected Parameters Panel */}
      <div className="glass-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">Already detected by AI</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-accent font-medium">
              Editable
            </span>
          </div>
          {feedbackMsg && (
            <span className="text-xs text-accent font-medium animate-fade-in flex items-center gap-1">
              ✓ {feedbackMsg}
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted mb-3">
          Review what the AI understood. You can change the category, participant count, or description at any time:
        </p>

        <div className="space-y-2.5">
          {/* Event Name */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className={project.eventContext.name?.value?.trim() ? "text-accent font-bold" : "text-amber-500 font-bold"}>
                {project.eventContext.name?.value?.trim() ? "✓" : "⚠️"}
              </span>
              <span className="text-xs font-semibold text-ink">Event Name:</span>
              <span className="text-[11px] text-muted hidden sm:inline">
                {project.eventContext.name?.value?.trim() ? "(Printed on cards & badges)" : "(Required for card identity)"}
              </span>
            </div>
            <input
              id="clarify-event-name"
              type="text"
              value={project.eventContext.name?.value || ''}
              onChange={e => handleEventNameChange(e.target.value)}
              placeholder="e.g. InCursion 2026"
              className="w-full sm:w-64 bg-white border border-line text-ink rounded-lg px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none"
            />
          </div>

          {/* Event Date */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className={project.eventContext.dateStart?.value?.trim() ? "text-accent font-bold" : "text-amber-500 font-bold"}>
                {project.eventContext.dateStart?.value?.trim() ? "✓" : "⚠️"}
              </span>
              <span className="text-xs font-semibold text-ink">Event Date:</span>
              <span className="text-[11px] text-muted hidden sm:inline">
                {project.eventContext.dateStart?.value?.trim() ? "(Credential validity date)" : "(Optional — appears on badge verification)"}
              </span>
            </div>
            <input
              id="clarify-event-date"
              type="text"
              value={project.eventContext.dateStart?.value || ''}
              onChange={e => handleDateChange(e.target.value)}
              placeholder="e.g. 24 October 2026"
              className="w-full sm:w-64 bg-white border border-line text-ink rounded-lg px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none"
            />
          </div>

          {/* Event Venue */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className={project.eventContext.venue?.value?.trim() ? "text-accent font-bold" : "text-amber-500 font-bold"}>
                {project.eventContext.venue?.value?.trim() ? "✓" : "⚠️"}
              </span>
              <span className="text-xs font-semibold text-ink">Venue / Location:</span>
              <span className="text-[11px] text-muted hidden sm:inline">
                {project.eventContext.venue?.value?.trim() ? "(Location accreditation)" : "(Optional — e.g. SVNIT Surat)"}
              </span>
            </div>
            <input
              id="clarify-event-venue"
              type="text"
              value={project.eventContext.venue?.value || ''}
              onChange={e => handleVenueChange(e.target.value)}
              placeholder="e.g. Main Auditorium, SVNIT"
              className="w-full sm:w-64 bg-white border border-line text-ink rounded-lg px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none"
            />
          </div>

          {/* Organizer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className={project.eventContext.organizer?.value?.trim() ? "text-accent font-bold" : "text-amber-500 font-bold"}>
                {project.eventContext.organizer?.value?.trim() ? "✓" : "⚠️"}
              </span>
              <span className="text-xs font-semibold text-ink">Organizer:</span>
              <span className="text-[11px] text-muted hidden sm:inline">
                {project.eventContext.organizer?.value?.trim() ? "(Hosting body)" : "(Optional — e.g. ACM NIT Surat)"}
              </span>
            </div>
            <input
              id="clarify-event-organizer"
              type="text"
              value={project.eventContext.organizer?.value || ''}
              onChange={e => handleOrganizerChange(e.target.value)}
              placeholder="e.g. ACM NIT Surat"
              className="w-full sm:w-64 bg-white border border-line text-ink rounded-lg px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none"
            />
          </div>

          {/* Category Dropdown Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className="text-accent font-bold">✓</span>
              <span className="text-xs font-semibold text-ink">Category:</span>
              <span className="text-[11px] text-muted hidden sm:inline">(Controls card styling & visual motifs)</span>
            </div>
            <select
              id="clarify-category-select"
              value={((project.eventContext as any).category?.value || 'general').toLowerCase()}
              onChange={e => handleCategoryChange(e.target.value)}
              className="bg-white border border-line text-ink rounded-lg px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none cursor-pointer"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Participant Count Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-hover-surface/40 border border-line gap-2">
            <div className="flex items-center gap-2">
              <span className="text-accent font-bold">✓</span>
              <span className="text-xs font-semibold text-ink">Expected Participants:</span>
              <span className="text-[11px] text-muted hidden sm:inline">(Prepopulates roster count)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const curr = (project.eventContext as any).participantCount?.value || (project.roles.find(r => r.id === 'participant' || r.id === 'player')?.count) || 5
                  handleParticipantCountChange(Math.max(1, curr - 1))
                }}
                className="w-6 h-6 rounded bg-hover-surface hover:bg-line-strong text-ink border border-line-strong flex items-center justify-center text-xs font-bold transition-colors"
              >
                -
              </button>
              <input
                id="clarify-participant-count"
                type="number"
                min="1"
                max="5000"
                value={(project.eventContext as any).participantCount?.value || (project.roles.find(r => r.id === 'participant' || r.id === 'player')?.count) || ''}
                onChange={e => handleParticipantCountChange(parseInt(e.target.value) || 1)}
                className="w-16 bg-white border border-line text-ink text-center rounded px-2 py-1 text-xs font-bold focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const curr = (project.eventContext as any).participantCount?.value || (project.roles.find(r => r.id === 'participant' || r.id === 'player')?.count) || 5
                  handleParticipantCountChange(curr + 1)
                }}
                className="w-6 h-6 rounded bg-hover-surface hover:bg-line-strong text-ink border border-line-strong flex items-center justify-center text-xs font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Description Editor */}
          <div className="p-3 rounded-xl bg-hover-surface/40 border border-line">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-accent font-bold">✓</span>
                <span className="text-xs font-semibold text-ink">Description:</span>
              </div>
              <button
                type="button"
                id="clarify-edit-desc-btn"
                onClick={() => editingDesc ? handleSaveDesc() : handleStartEditDesc()}
                className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1"
              >
                {editingDesc ? '✓ Save Changes' : '✏️ Edit Description'}
              </button>
            </div>
            {editingDesc ? (
              <div className="mt-2 space-y-2">
                <textarea
                  id="clarify-desc-textarea"
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-line text-ink text-xs rounded-lg p-2.5 focus:border-accent focus:outline-none"
                  placeholder="Describe your event..."
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDesc(false)}
                    className="text-xs text-muted hover:text-ink px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDesc}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text italic bg-white p-2.5 rounded-lg border border-line line-clamp-3">
                "{project.eventContext.description?.value || 'No description provided'}"
              </p>
            )}
          </div>

          {/* Requested Fields and Optional Tags */}
          {(project.eventContext as any).requestedFields?.value && (
            <div className="flex items-center gap-2 pt-1 text-[11px] text-muted">
              <span className="text-muted font-medium">Requested fields:</span>
              <div className="flex flex-wrap gap-1.5">
                {((project.eventContext as any).requestedFields.value as string[]).map(f => (
                  <span key={f} className="px-2 py-0.5 rounded bg-white border border-line text-ink font-mono text-[10px]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      {questions.length === 0 ? (
        <div className="glass p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-ink font-semibold mb-1">All details captured!</p>
          <p className="text-muted text-sm">No clarifying questions needed. Let's generate your drafts.</p>
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
            <h3 className="text-sm font-semibold text-ink">Event & Institute Logos</h3>
            <p className="text-xs text-muted">SVNIT is used as default institute logo and ACM for club/event logo. You can upload custom logos anytime.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Institute Logo */}
          <div className="p-3.5 rounded-xl bg-hover-surface/30 border border-line flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              <img src={instituteLogo} alt="SVNIT Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-ink">Institute Logo</span>
                <span className="text-[10px] text-muted">{instituteLogo === DEFAULT_SVNIT_LOGO ? 'SVNIT' : 'Custom'}</span>
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
                  <button type="button" onClick={resetInstituteLogo} className="text-[11px] text-muted hover:text-ink underline">
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Club / Event Logo */}
          <div className="p-3.5 rounded-xl bg-hover-surface/30 border border-line flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
              <img src={clubLogo} alt="ACM Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-medium text-ink">Club / Event Logo</span>
                <span className="text-[10px] text-muted">{clubLogo === DEFAULT_ACM_LOGO ? 'ACM' : 'Custom'}</span>
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
                  <button type="button" onClick={resetClubLogo} className="text-[11px] text-muted hover:text-ink underline">
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
    <div className={`glass p-5 transition-all duration-200 ${isAnswered ? 'border-accent/40' : ''} ${isSkipped ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {question.required ? (
              <span className="badge-red py-0.5 px-2 text-[10px]">Required</span>
            ) : (
              <span className="badge py-0.5 px-2 text-[10px] bg-hover-surface text-muted border border-line-strong">Optional</span>
            )}
            {isAnswered && <span className="badge-green py-0.5 px-2 text-[10px]">✓ Answered</span>}
          </div>
          <label className="text-sm font-medium text-ink">{question.label}</label>
          {question.hint && <p className="text-xs text-muted mt-0.5">{question.hint}</p>}
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
                ? 'bg-accent text-white border-accent'
                : 'bg-white text-ink border-line hover:border-line-strong hover:bg-hover-surface'
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
