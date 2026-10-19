import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { generateDrafts, generateArtworkForDraft, applyNlRefinement } from '../../core/ai/draftGenerator'
import { CardPreview } from '../components/CardPreview'
import type { CardTemplate } from '../../core/schema/CardTemplate'
import type { Role } from '../../core/schema/Role'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { DEFAULT_ROLES, getRoleOrDefault } from '../../core/schema/Role'

// Sample person for previewing drafts
const SAMPLE_PERSON = {
  id: '',
  name: 'Aarav Sharma',
  role: 'participant',
  email: 'aarav@example.com',
  team: '',
  photoUrl: '',
  extra: {},
}

export function DraftsPage() {
  const navigate          = useNavigate()
  const project           = useProjectStore(s => s.project)
  const setDrafts         = useProjectStore(s => s.setDrafts)
  const setRoles          = useProjectStore(s => s.setRoles)
  const setActiveTemplate = useProjectStore(s => s.setActiveTemplate)
  const setWizardStep     = useProjectStore(s => s.setWizardStep)

  const instituteLogo     = useProjectStore(s => s.instituteLogo)
  const clubLogo          = useProjectStore(s => s.clubLogo)

  const [loading, setLoading]                 = useState(false)
  const [drafts, setLocalDrafts]              = useState<CardTemplate[]>([])
  const [selectedIdx, setSelectedIdx]         = useState(0)
  const [previewRole, setPreviewRole]         = useState<string>('participant')
  const [nlInput, setNlInput]                 = useState('')
  const [refining, setRefining]               = useState(false)
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)

  // Full-size preview modal state
  const [modalDraft, setModalDraft]           = useState<CardTemplate | null>(null)
  const [modalFace, setModalFace]             = useState<'front' | 'back'>('front')
  const [modalScale, setModalScale]           = useState<number>(3.0)

  // Custom role input state
  const [showAddRole, setShowAddRole]         = useState(false)
  const [customRoleText, setCustomRoleText]   = useState('')

  const brandKit = getDefaultBrandKit()

  useEffect(() => {
    const hasInput = Boolean(project?.eventContext?.description?.value?.trim() || project?.eventContext?.name?.value?.trim())
    if (!project || !hasInput) {
      navigate('/studio/describe', { replace: true })
      return
    }
    generate()
  }, [])

  async function generate(rolesToUse?: Role[]) {
    setLoading(true)
    try {
      const activeRoles = rolesToUse || (project?.roles?.length ? project.roles : DEFAULT_ROLES)
      const generated = await generateDrafts(project!.eventContext, activeRoles, { instituteLogo, clubLogo })

      // Generate distinct background artwork for the drafts
      const eventName = project?.eventContext?.name?.value || 'Event'
      const eventDesc = (project?.eventContext as any)?.description?.value || ''
      const withArtwork = await Promise.all(
        generated.map((d, i) =>
          generateArtworkForDraft(
            d,
            project!.eventContext,
            d.tokens?.artworkPrompt || `${eventName}: ${eventDesc} (Concept ${i + 1})`,
            true
          )
        )
      )

      setLocalDrafts(withArtwork)
      setDrafts(withArtwork)
      if (withArtwork[selectedIdx]) {
        setActiveTemplate(withArtwork[selectedIdx])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerateArtwork(idx: number) {
    const draft = drafts[idx]
    if (!draft || !project) return
    setRegeneratingIdx(idx)
    try {
      const eventName = project.eventContext.name?.value || 'Event'
      const eventDesc = (project.eventContext as any)?.description?.value || ''
      const updated = await generateArtworkForDraft(
        draft,
        project.eventContext,
        draft.tokens?.artworkPrompt || `${eventName}: ${eventDesc}`,
        true
      )
      const newDrafts = [...drafts]
      newDrafts[idx] = updated
      setLocalDrafts(newDrafts)
      setDrafts(newDrafts)
      if (selectedIdx === idx) {
        setActiveTemplate(updated)
      }
      if (modalDraft && modalDraft.id === draft.id) {
        setModalDraft(updated)
      }
    } finally {
      setRegeneratingIdx(null)
    }
  }

  function handleSelect(idx: number) {
    setSelectedIdx(idx)
  }

  function handleContinue() {
    const tpl = drafts[selectedIdx]
    if (!tpl) return
    setActiveTemplate(tpl)
    setWizardStep(3)
    navigate('/studio/editor')
  }

  async function handleRefine(instructionOverride?: string) {
    const text = (instructionOverride || nlInput).trim()
    if (!text || !drafts[selectedIdx]) return
    setRefining(true)
    try {
      const refined = await applyNlRefinement(drafts[selectedIdx], text)
      const newDrafts = [...drafts]
      newDrafts[selectedIdx] = refined
      setLocalDrafts(newDrafts)
      setDrafts(newDrafts)
      setActiveTemplate(refined)
      setNlInput('')
    } finally {
      setRefining(false)
    }
  }

  function handleAddCustomRole() {
    if (!customRoleText.trim()) return
    const newRole = getRoleOrDefault(customRoleText.trim(), project?.roles)
    const currentRoles = project?.roles?.length ? project.roles : DEFAULT_ROLES
    if (!currentRoles.some(r => r.id === newRole.id)) {
      const updated = [...currentRoles, newRole]
      setRoles(updated)
      setPreviewRole(newRole.id)
      generate(updated)
    } else {
      setPreviewRole(newRole.id)
    }
    setCustomRoleText('')
    setShowAddRole(false)
  }

  const roles = project?.roles?.length ? project.roles : DEFAULT_ROLES
  const person = { ...SAMPLE_PERSON, role: previewRole }
  const currentRole = roles.find(r => r.id === previewRole) || roles[0]

  if (!project) return null

  return (
    <div className="animate-slide-up">
      {/* Page Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          Step 3 of 6 — Choose a Design Draft
        </div>
        <h1 className="text-3xl sm:text-4xl font-heading font-normal text-ink mb-2">
          Pick your badge identity
        </h1>
        <p className="text-text max-w-2xl mx-auto text-sm">
          Three genuinely distinct design families inspired by professional event credentials.
          Switch roles or add custom communities to see how each design adapts.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-6 py-24">
          <div className="w-12 h-12 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text text-sm font-medium">Generating 3 distinct role-tailored design drafts…</p>
        </div>
      ) : (
        <>
          {/* Interactive Role Switcher Bar */}
          <div className="glass p-3.5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted mr-1 uppercase tracking-wider">
                Preview Community:
              </span>
              {roles.map(role => {
                const isActive = previewRole === role.id
                return (
                  <button
                    key={role.id}
                    id={`preview-role-${role.id}`}
                    onClick={() => setPreviewRole(role.id)}
                    style={{
                      borderColor: isActive ? role.palette.accent : undefined,
                      backgroundColor: isActive ? role.palette.primary + '22' : undefined,
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border
                      ${isActive
                        ? 'text-ink shadow-sm'
                        : 'bg-hover-surface/60 text-text border-line hover:text-ink hover:bg-hover-surface'
                      }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: role.palette.primary }}
                    />
                    {role.label}
                  </button>
                )
              })}

              {/* Add Custom Role Button */}
              {showAddRole ? (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customRoleText}
                    onChange={e => setCustomRoleText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCustomRole()}
                    placeholder="e.g. VIP, Sponsor, Press"
                    className="input text-xs py-1 px-2.5 w-36 h-7"
                    autoFocus
                  />
                  <button
                    onClick={handleAddCustomRole}
                    className="btn-primary text-xs py-1 px-2.5 h-7"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddRole(false)}
                    className="btn-ghost text-xs py-1 px-1.5 h-7"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  id="add-custom-role-btn"
                  onClick={() => setShowAddRole(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
                >
                  + Custom Community
                </button>
              )}
            </div>

            {/* Active role badge identity summary */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-muted">Active Theme:</span>
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
                style={{
                  backgroundColor: currentRole.palette.primary + '22',
                  borderColor: currentRole.palette.accent,
                  color: currentRole.palette.accent,
                }}
              >
                {currentRole.label}
              </span>
            </div>
          </div>

          {/* Three Distinct Draft Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {drafts.map((draft, idx) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                index={idx}
                isSelected={idx === selectedIdx}
                onSelect={() => handleSelect(idx)}
                onOpenModal={() => {
                  setModalDraft(draft)
                  setModalFace('front')
                }}
                onRegenerateArtwork={() => handleRegenerateArtwork(idx)}
                isRegenerating={regeneratingIdx === idx}
                role={currentRole}
                roles={roles}
                person={person}
                brandKit={brandKit}
                event={project.eventContext}
              />
            ))}
          </div>

          {/* Natural Language Refinement Bar */}
          <div className="glass p-5 mb-8">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 text-ink font-semibold">
                Refine Selected Design ({drafts[selectedIdx]?.name || 'Current'})
              </label>
              <span className="text-xs text-muted">
                AI / Rule-based interactive micro-edits
              </span>
            </div>
            <div className="flex gap-3">
              <input
                id="nl-refine-input"
                type="text"
                className="input flex-1"
                placeholder='e.g. "Make it darker", "Bigger photo", "Lighter theme", "Move logo to center"'
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRefine()}
              />
              <button
                id="nl-refine-btn"
                onClick={() => handleRefine()}
                disabled={refining || !nlInput.trim()}
                className="btn-secondary shrink-0 cursor-pointer"
              >
                {refining ? 'Applying…' : 'Apply Refinement'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'Darker theme',
                'Lighter theme',
                'Bigger photo',
                'Move logo to center',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setNlInput(s)
                    handleRefine(s)
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-hover-surface text-ink border border-line hover:border-line-strong transition-colors cursor-pointer"
                >
                  ⚡ {s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions Bottom Bar */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-3">
              <button onClick={() => navigate('/studio/clarify')} className="btn-ghost">
                ← Back to Clarify
              </button>
              <button onClick={() => generate()} className="btn-secondary">
                ↺ Regenerate Layouts
              </button>
            </div>
            <button
              id="drafts-use-btn"
              onClick={handleContinue}
              disabled={drafts.length === 0}
              className="btn-primary text-sm px-6 py-3"
            >
              Use Selected Design ({drafts[selectedIdx]?.name?.split('—')[0]?.trim() || 'Selected'}) →
            </button>
          </div>
        </>
      )}

      {/* Full-Size Interactive Preview Modal */}
      {modalDraft && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setModalDraft(null)}
        >
          <div
            className="glass max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-2xl p-6 border border-white/20 relative flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold text-white">
                    {modalDraft.name}
                  </h2>
                  <span className="badge-blue text-[10px] px-2 py-0.5">
                    54 × 86 mm (CR80)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalDraft.description}
                </p>
              </div>
              <button
                onClick={() => setModalDraft(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Controls: Face Toggle & Role Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
              {/* Front / Back Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-900 rounded-lg border border-white/10">
                <button
                  onClick={() => setModalFace('front')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    modalFace === 'front'
                      ? 'bg-acm-600 text-white shadow-glow-acm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front Face
                </button>
                <button
                  onClick={() => setModalFace('back')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    modalFace === 'back'
                      ? 'bg-acm-600 text-white shadow-glow-acm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back Face
                </button>
              </div>

              {/* Role preview switcher inside modal */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 mr-1">Preview Role:</span>
                {roles.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setPreviewRole(r.id)}
                    style={{
                      borderColor: previewRole === r.id ? r.palette.accent : undefined,
                      backgroundColor: previewRole === r.id ? r.palette.primary + '33' : undefined,
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                      previewRole === r.id
                        ? 'text-white'
                        : 'text-slate-400 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Card High-Fidelity Rendering Area */}
            <div className="flex-1 flex items-center justify-center py-4 bg-gradient-to-b from-surface-950/80 to-surface-900/80 rounded-xl border border-white/5 shadow-inner">
              <div
                className="card-preview-wrapper shadow-2xl rounded-xl overflow-hidden transition-transform duration-200"
                style={{ width: `${54 * modalScale}px` }}
              >
                <CardPreview
                  template={modalDraft}
                  role={currentRole}
                  person={person}
                  event={project.eventContext}
                  brandKit={brandKit}
                  face={modalFace}
                  scale={modalScale}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <div>
                <span>Standard badge dimensions: </span>
                <strong className="text-white">54 × 86 mm</strong>
                <span className="mx-2">•</span>
                <span>Vector SVG print-ready</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalDraft(null)}
                  className="btn-ghost text-xs py-2 px-3"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    const idx = drafts.findIndex(d => d.id === modalDraft.id)
                    if (idx >= 0) setSelectedIdx(idx)
                    setModalDraft(null)
                    handleContinue()
                  }}
                  className="btn-primary text-xs py-2 px-4"
                >
                  Use This Design →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface DraftCardProps {
  draft: CardTemplate
  index: number
  isSelected: boolean
  onSelect: () => void
  onOpenModal: () => void
  onRegenerateArtwork: () => void
  isRegenerating: boolean
  role: Role
  roles: Role[]
  person: typeof SAMPLE_PERSON
  brandKit: ReturnType<typeof getDefaultBrandKit>
  event: any
}

function DraftCard({
  draft,
  index,
  isSelected,
  onSelect,
  onOpenModal,
  onRegenerateArtwork,
  isRegenerating,
  role,
  roles,
  person,
  brandKit,
  event,
}: DraftCardProps) {
  // Design reference attribution labels
  const inspirationLabels = [
    'Reference 1: Dual-Tone Navy & Electric Blue Vertical Split',
    'Reference 2: Creative Purple Tech & Chevron divider',
    'Reference 3: Matte Obsidian & Asymmetric Accent Block',
  ]

  const styleNames = ['Modern Minimal', 'Creative Tech', 'Premium Editorial']

  const hasArtwork = !!draft.tokens?.bgArtworkUrl
  const isAiGenerated = draft.tokens?.isGeneratedArtwork === 'true'

  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-2xl p-4 transition-all duration-300 border-2 flex flex-col justify-between
        ${isSelected
          ? 'border-accent bg-accent/5 shadow-sm'
          : 'border-line bg-white hover:border-line-strong hover:bg-hover-surface/30'
        }
      `}
    >
      {/* Selected Badge */}
      {isSelected && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-accent text-white text-xs px-3.5 py-0.5 rounded-full shadow-sm font-semibold flex items-center gap-1.5">
            <span>✓</span> Selected Layout
          </div>
        </div>
      )}

      <div>
        {/* Card Header & Title */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-mono text-accent font-semibold uppercase tracking-wider mb-0.5">
              Draft {index + 1} — {draft.tags?.[0]?.toUpperCase() || styleNames[index] || 'STYLE'}
            </div>
            <h3 className="font-heading font-normal text-xl text-ink">
              {draft.name.split('—')[0]?.trim()}
            </h3>
          </div>
          <div className="flex gap-1 shrink-0">
            {draft.tags?.slice(0, 2).map(t => (
              <span
                key={t}
                className="text-[9px] px-2 py-0.5 rounded-full bg-hover-surface text-text font-medium border border-line"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Dynamic Event-Specific Description */}
        <p className="text-[11px] text-muted mb-2 italic leading-tight">
          {draft.description}
        </p>

        {/* Artwork Generation Status Indicator & Per-Card Regenerate Action */}
        <div className="mb-3 flex items-center justify-between text-[10px]">
          {hasArtwork ? (
            <span
              className={`px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                isAiGenerated
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'bg-amber-700/15 text-amber-800 border border-amber-700/30'
              }`}
              title={
                isAiGenerated
                  ? 'Background generated by Gemini Image Model'
                  : 'Event concept generative artwork fallback (Gemini free tier quota limit: 0)'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isAiGenerated ? 'bg-accent' : 'bg-amber-600'}`} />
              {isAiGenerated ? '✨ AI Artwork' : '🎨 Event Visual Concept'}
            </span>
          ) : (
            <span className="text-muted italic">Theme background</span>
          )}

          <button
            type="button"
            disabled={isRegenerating}
            onClick={e => {
              e.stopPropagation()
              onRegenerateArtwork()
            }}
            className="text-accent hover:text-accent-hover px-2 py-0.5 rounded bg-hover-surface border border-line hover:border-line-strong transition-colors flex items-center gap-1 font-medium disabled:opacity-50"
            title="Generate a fresh background artwork for this draft"
          >
            {isRegenerating ? (
              <>
                <span className="w-2.5 h-2.5 border-2 border-accent border-t-transparent rounded-full animate-spin inline-block" />
                Generating…
              </>
            ) : (
              '↺ New Background'
            )}
          </button>
        </div>

        {/* Card Preview Container */}
        <div className="relative group rounded-xl overflow-hidden card-preview-wrapper max-w-[270px] mx-auto shadow-sm bg-hover-surface/30 p-2 border border-line">
          <CardPreview
            template={draft}
            role={role}
            person={person}
            event={event}
            brandKit={brandKit}
            scale={2.0}
          />

          {/* Hover Overlay with Full-Size Preview Trigger */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onOpenModal()
              }}
              className="btn-primary text-xs py-2 px-3.5 shadow-glow-acm flex items-center gap-1.5 font-semibold"
            >
              🔍 Full-Size Preview
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">Communities:</span>
            <div className="flex gap-1">
              {roles.slice(0, 5).map(r => (
                <div
                  key={r.id}
                  title={r.label}
                  style={{ backgroundColor: r.palette.primary }}
                  className="w-3.5 h-3.5 rounded-full border border-white/30"
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onOpenModal()
            }}
            className="text-[11px] text-acm-300 hover:text-white underline font-medium"
          >
            Zoom (54×86mm) →
          </button>
        </div>
      </div>
    </div>
  )
}
