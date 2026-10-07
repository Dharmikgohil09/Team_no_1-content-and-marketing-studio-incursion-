import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { generateDraftsDeterministic } from '../../core/ai/draftGenerator'
import { CardPreview } from '../components/CardPreview'
import type { CardTemplate } from '../../core/schema/CardTemplate'
import type { Role } from '../../core/schema/Role'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { DEFAULT_ROLES } from '../../core/schema/Role'

// Sample person for previewing drafts
const SAMPLE_PERSON = {
  id: 'SAMPLE-001',
  name: 'Aarav Sharma',
  role: 'participant',
  email: 'aarav@example.com',
  team: 'Team Alpha',
  photoUrl: '',
  extra: {},
}

export function DraftsPage() {
  const navigate          = useNavigate()
  const project           = useProjectStore(s => s.project)
  const setDrafts         = useProjectStore(s => s.setDrafts)
  const setActiveTemplate = useProjectStore(s => s.setActiveTemplate)
  const setWizardStep     = useProjectStore(s => s.setWizardStep)

  const [loading, setLoading]           = useState(false)
  const [drafts, setLocalDrafts]        = useState<CardTemplate[]>([])
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const [previewRole, setPreviewRole]   = useState<string>('participant')
  const [nlInput, setNlInput]           = useState('')
  const [refining, setRefining]         = useState(false)

  const brandKit = getDefaultBrandKit()

  useEffect(() => {
    if (!project) { navigate('/studio/describe'); return }
    generate()
  }, [])

  async function generate() {
    setLoading(true)
    try {
      const generated = generateDraftsDeterministic(project!.eventContext, project!.roles)
      setLocalDrafts(generated)
      setDrafts(generated)
    } finally {
      setLoading(false)
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

  async function handleRefine() {
    if (!nlInput.trim()) return
    setRefining(true)
    const { applyNlRefinement } = await import('../../core/ai/draftGenerator')
    const refined = await applyNlRefinement(drafts[selectedIdx], nlInput)
    const newDrafts = [...drafts]
    newDrafts[selectedIdx] = refined
    setLocalDrafts(newDrafts)
    setDrafts(newDrafts)
    setNlInput('')
    setRefining(false)
  }

  const roles   = project?.roles?.length ? project.roles : DEFAULT_ROLES.slice(0, 3)
  const person  = { ...SAMPLE_PERSON, role: previewRole }

  if (!project) return null

  return (
    <div className="animate-slide-up">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 3 of 6 — Choose a Design Draft
        </div>
        <h1 className="text-2xl font-display font-bold text-white mb-2">
          Pick your design
        </h1>
        <p className="text-slate-400">
          Three distinct layouts, each showing all roles. Select one and refine from there.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-6 py-20">
          <div className="w-12 h-12 border-2 border-acm-500/30 border-t-acm-500 rounded-full animate-spin" />
          <p className="text-slate-400">Generating design drafts…</p>
        </div>
      ) : (
        <>
          {/* Role switcher */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="text-xs text-slate-500 mr-1">Preview role:</span>
            {roles.map(role => (
              <button
                key={role.id}
                id={`preview-role-${role.id}`}
                onClick={() => setPreviewRole(role.id)}
                style={{
                  borderColor: previewRole === role.id ? role.palette.primary : undefined,
                  backgroundColor: previewRole === role.id ? role.palette.primary + '33' : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border
                  ${previewRole === role.id
                    ? 'text-white'
                    : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:text-white'
                  }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Draft gallery */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {drafts.map((draft, idx) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                isSelected={idx === selectedIdx}
                onClick={() => handleSelect(idx)}
                roles={roles}
                previewRoleId={previewRole}
                person={person}
                brandKit={brandKit}
                event={project.eventContext}
              />
            ))}
          </div>

          {/* NL Refinement */}
          <div className="glass p-5 mb-6">
            <label className="label">Refine the selected design</label>
            <div className="flex gap-3">
              <input
                id="nl-refine-input"
                type="text"
                className="input flex-1"
                placeholder='e.g. "Make it darker", "Move the logo to center", "Use a bolder font"'
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRefine()}
              />
              <button
                id="nl-refine-btn"
                onClick={handleRefine}
                disabled={refining || !nlInput.trim()}
                className="btn-secondary shrink-0"
              >
                {refining ? 'Applying…' : 'Apply'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Make it darker', 'More minimal', 'Bigger photo', 'Lighter theme'].map(s => (
                <button key={s} onClick={() => setNlInput(s)}
                  className="text-xs px-3 py-1 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:border-white/[0.2] hover:text-white transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button onClick={() => navigate('/studio/clarify')} className="btn-ghost">← Back</button>
              <button onClick={generate} className="btn-secondary">
                ↺ Regenerate
              </button>
            </div>
            <button
              id="drafts-use-btn"
              onClick={handleContinue}
              disabled={drafts.length === 0}
              className="btn-primary"
            >
              Use This Design →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function DraftCard({ draft, isSelected, onClick, roles, previewRoleId, person, brandKit, event }: {
  draft:        CardTemplate
  isSelected:   boolean
  onClick:      () => void
  roles:        Role[]
  previewRoleId: string
  person:       typeof SAMPLE_PERSON
  brandKit:     ReturnType<typeof getDefaultBrandKit>
  event:        any
}) {
  const role = roles.find(r => r.id === previewRoleId) ?? roles[0]

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-2xl p-4 transition-all duration-300 border-2
        ${isSelected
          ? 'border-acm-500 bg-acm-600/10 shadow-glow-acm'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.05]'
        }
      `}
    >
      {isSelected && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="badge-blue text-xs px-3 py-0.5 shadow-glow-acm">Selected</div>
        </div>
      )}

      {/* Card name */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-white">{draft.name}</h3>
        <div className="flex gap-1">
          {draft.tags?.slice(0, 2).map(t => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">{t}</span>
          ))}
        </div>
      </div>

      {/* Card preview */}
      <div className="rounded-xl overflow-hidden card-preview-wrapper">
        <CardPreview
          template={draft}
          role={role ?? roles[0]}
          person={person}
          event={event}
          brandKit={brandKit}
          scale={1.8}
        />
      </div>

      {/* Role swatches */}
      <div className="mt-3 flex gap-1.5">
        {roles.slice(0, 5).map(r => (
          <div
            key={r.id}
            title={r.label}
            style={{ backgroundColor: r.palette.primary }}
            className="w-4 h-4 rounded-full border-2 border-white/20"
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">{draft.description}</p>
    </div>
  )
}
