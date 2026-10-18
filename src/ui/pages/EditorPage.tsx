import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../../brandKits/defaultLogos'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import type { CardTemplate } from '../../core/schema/CardTemplate'
import type { Element, TextElement, ShapeElement, ImageElement } from '../../core/schema/Element'

const BASE_SAMPLE_PERSON = {
  id: '',
  name: 'Aarav Sharma',
  role: 'participant',
  email: 'aarav@example.com',
  team: '',
  extra: {},
}

export function EditorPage() {
  const navigate          = useNavigate()
  const project           = useProjectStore(s => s.project)
  const updateTemplate    = useProjectStore(s => s.updateActiveTemplate)
  const saveVersion       = useProjectStore(s => s.saveVersion)
  const setWizardStep     = useProjectStore(s => s.setWizardStep)

  useEffect(() => {
    const hasInput = Boolean(project?.eventContext?.description?.value?.trim() || project?.eventContext?.name?.value?.trim())
    if (!project || !hasInput) {
      navigate('/studio/describe', { replace: true })
    }
  }, [project])
  const instituteLogo      = useProjectStore(s => s.instituteLogo)
  const clubLogo           = useProjectStore(s => s.clubLogo)
  const setInstituteLogo   = useProjectStore(s => s.setInstituteLogo)
  const setClubLogo        = useProjectStore(s => s.setClubLogo)
  const resetInstituteLogo = useProjectStore(s => s.resetInstituteLogo)
  const resetClubLogo      = useProjectStore(s => s.resetClubLogo)

  const instituteInputRef = useRef<HTMLInputElement>(null)
  const clubInputRef      = useRef<HTMLInputElement>(null)

  const [selectedEl, setSelectedEl] = useState<string | null>(null)
  const [previewRole, setPreviewRole] = useState<string>('participant')
  const [face, setFace]               = useState<'front' | 'back'>('front')
  const [history, setHistory]         = useState<CardTemplate[]>([])
  const [historyIdx, setHistoryIdx]   = useState(-1)
  const [showValidation, setShowValidation] = useState(false)

  function handleInstituteLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInstituteLogo(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleClubLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setClubLogo(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const brandKit = getDefaultBrandKit()
  const roles    = project?.roles?.length ? project.roles : DEFAULT_ROLES
  const template = project?.activeTemplate
  const role     = roles.find(r => r.id === previewRole) ?? roles[0]
  const person   = { ...BASE_SAMPLE_PERSON, role: previewRole, photoUrl: '' }

  function pushHistory(tpl: CardTemplate) {
    const next = history.slice(0, historyIdx + 1)
    setHistory([...next, tpl])
    setHistoryIdx(next.length)
  }

  function undo() {
    if (historyIdx <= 0) return
    const prev = history[historyIdx - 1]
    setHistoryIdx(historyIdx - 1)
    updateTemplate(prev)
  }

  function redo() {
    if (historyIdx >= history.length - 1) return
    const next = history[historyIdx + 1]
    setHistoryIdx(historyIdx + 1)
    updateTemplate(next)
  }

  function updateElement(elementId: string, patch: Partial<Element>) {
    if (!template) return
    const updateList = (list: Element[]) =>
      list.map(el => (el.id === elementId ? ({ ...el, ...patch } as Element) : el))

    const newElements = updateList(template.elements)
    const newRoleElements = template.roleElements ? { ...template.roleElements } : undefined
    if (newRoleElements && newRoleElements[previewRole]) {
      newRoleElements[previewRole] = updateList(newRoleElements[previewRole])
    }

    const newTpl: CardTemplate = {
      ...template,
      elements: newElements,
      roleElements: newRoleElements,
    }
    pushHistory(template)
    updateTemplate(newTpl)
  }

  const activeElementList = face === 'front'
    ? (template?.roleElements?.[previewRole] ?? template?.elements ?? [])
    : (template?.roleBackElements?.[previewRole] ?? template?.backElements ?? [])

  const selected = activeElementList.find(el => el.id === selectedEl)


  if (!project || !template) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">No template selected. Go back to Drafts.</p>
        <button onClick={() => navigate('/studio/drafts')} className="btn-primary mt-4">← Back to Drafts</button>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
            Step 4 of 6 — Editor
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-normal text-ink">{template.name}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={undo} disabled={historyIdx <= 0} className="btn-ghost text-xs" title="Undo (Ctrl+Z)">↩ Undo</button>
          <button onClick={redo} disabled={historyIdx >= history.length - 1} className="btn-ghost text-xs" title="Redo (Ctrl+Y)">↪ Redo</button>
          <button onClick={() => saveVersion('Manual save')} className="btn-secondary text-sm">💾 Save Version</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Canvas area */}
        <div className="space-y-4">
          {/* Controls: Role preview & Face toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {roles.map(r => (
                <button
                  key={r.id}
                  id={`editor-role-${r.id}`}
                  onClick={() => setPreviewRole(r.id)}
                  style={{
                    backgroundColor: previewRole === r.id ? r.palette.primary + '22' : undefined,
                    borderColor:     previewRole === r.id ? r.palette.primary : undefined,
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border
                    ${previewRole === r.id ? 'text-ink shadow-sm' : 'text-text border-line hover:text-ink hover:bg-hover-surface'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-hover-surface rounded-lg border border-line shrink-0">
              <button
                onClick={() => setFace('front')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  face === 'front' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Front Face
              </button>
              <button
                onClick={() => setFace('back')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  face === 'back' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Back Face
              </button>
            </div>
          </div>

          {/* Card canvas */}
          <div className="glass p-6 flex flex-col items-center gap-6">
            <div className="w-full max-w-[340px] card-preview-wrapper">
              <CardPreview
                template={template}
                role={role}
                person={person}
                event={project.eventContext}
                brandKit={brandKit}
                face={face}
              />
            </div>


            {/* All roles side by side */}
            <div className="w-full">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">All roles preview</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {roles.map(r => (
                  <div key={r.id} className="space-y-1">
                    <CardPreview
                      template={template}
                      role={r}
                      person={{ ...BASE_SAMPLE_PERSON, role: r.id, photoUrl: personPhotoUrl }}
                      event={project.eventContext}
                      brandKit={brandKit}
                      face="front"
                    />
                    <p className="text-center text-[10px] text-slate-400">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="space-y-4">

          {/* Card Logos (Institute & Club) */}
          <div className="glass p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-heading text-sm">Card Logos</h3>
              <span className="text-[10px] text-slate-400">SVNIT & ACM</span>
            </div>

            {/* Institute Logo */}
            <div className="p-3 rounded-xl bg-hover-surface/30 border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">Institute Logo</span>
                {instituteLogo === DEFAULT_SVNIT_LOGO ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">SVNIT Default</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/15 text-emerald-800 border border-emerald-700/30">Custom Uploaded</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  <img src={instituteLogo} alt="Institute Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <input
                    ref={instituteInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleInstituteLogoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => instituteInputRef.current?.click()}
                    className="btn-secondary text-xs py-1.5 px-2.5 text-center truncate"
                  >
                    📁 Change Logo
                  </button>
                  {instituteLogo !== DEFAULT_SVNIT_LOGO && (
                    <button
                      type="button"
                      onClick={resetInstituteLogo}
                      className="text-[11px] text-muted hover:text-ink underline text-left"
                    >
                      Reset to SVNIT
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Club / Event Logo */}
            <div className="p-3 rounded-xl bg-hover-surface/30 border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink">Club / Event Logo</span>
                {clubLogo === DEFAULT_ACM_LOGO ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">ACM Default</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700/15 text-emerald-800 border border-emerald-700/30">Custom Uploaded</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white border border-line p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  <img src={clubLogo} alt="Club Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <input
                    ref={clubInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleClubLogoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => clubInputRef.current?.click()}
                    className="btn-secondary text-xs py-1.5 px-2.5 text-center truncate"
                  >
                    📁 Change Logo
                  </button>
                  {clubLogo !== DEFAULT_ACM_LOGO && (
                    <button
                      type="button"
                      onClick={resetClubLogo}
                      className="text-[11px] text-muted hover:text-ink underline text-left"
                    >
                      Reset to ACM
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Element list */}
          <div className="glass p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-heading text-sm">Elements ({face === 'front' ? 'Front' : 'Back'})</h3>
              <span className="text-[10px] text-muted font-mono">{activeElementList.length} items</span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {activeElementList.map(el => (
                <button
                  key={el.id}
                  onClick={() => setSelectedEl(el.id === selectedEl ? null : el.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2
                    ${el.id === selectedEl
                      ? 'bg-accent/15 text-accent border border-accent/30 font-medium'
                      : 'text-text hover:text-ink hover:bg-hover-surface'
                    }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted w-12 shrink-0">{el.type}</span>
                  <span className="truncate font-mono text-xs">{el.id}</span>
                </button>
              ))}
            </div>
          </div>


          {/* Selected element properties */}
          {selected && (
            <div className="glass p-4">
              <h3 className="section-heading text-sm mb-3">Properties: {selected.id}</h3>
              <ElementProperties element={selected} onChange={(patch) => updateElement(selected.id, patch)} />
            </div>
          )}

          {/* Card size info */}
          <div className="glass-sm p-4">
            <h3 className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Card Size</h3>
            <div className="text-sm text-text space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Format</span>
                <span className="text-ink font-medium">{template.size.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Size</span>
                <span className="text-ink font-medium">{template.size.widthMm} × {template.size.heightMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Bleed</span>
                <span className="text-ink font-medium">{template.size.bleedMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Safe margin</span>
                <span className="text-ink font-medium">{template.size.safeMarginMm} mm</span>
              </div>
            </div>
          </div>

          {/* Next step */}
          <button
            id="editor-next-btn"
            onClick={() => { setWizardStep(4); navigate('/studio/data') }}
            className="btn-primary w-full"
          >
            Add Participant Data →
          </button>
          <button onClick={() => navigate('/studio/drafts')} className="btn-ghost w-full text-sm">← Back to Drafts</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ElementProperties({ element, onChange }: {
  element:  Element
  onChange: (patch: Partial<Element>) => void
}) {
  if (element.type === 'text') {
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Content</label>
          <input
            type="text"
            className="input text-xs font-mono"
            value={element.content}
            onChange={e => onChange({ content: e.target.value } as any)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Font size (pt)</label>
            <input
              type="number"
              className="input"
              value={element.fontSize}
              min={5} max={72} step={0.5}
              onChange={e => onChange({ fontSize: Number(e.target.value) } as any)}
            />
          </div>
          <div>
            <label className="label">Color</label>
            <input
              type="color"
              className="w-full h-10 rounded-lg cursor-pointer bg-surface-700 border border-white/[0.08] p-1"
              value={element.color}
              onChange={e => onChange({ color: e.target.value } as any)}
            />
          </div>
        </div>
        <div>
          <label className="label">Font weight</label>
          <select
            className="input"
            value={element.fontWeight}
            onChange={e => onChange({ fontWeight: e.target.value as any } as any)}
          >
            {['300','400','500','600','700'].map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Alignment</label>
          <div className="flex gap-1">
            {(['left','center','right'] as const).map(align => (
              <button
                key={align}
                onClick={() => onChange({ align } as any)}
                className={`flex-1 py-2 rounded-lg text-xs transition-colors
                  ${element.align === align ? 'bg-acm-600/40 text-acm-300' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (element.type === 'shape') {
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Fill color</label>
          <input
            type="color"
            className="w-full h-10 rounded-lg cursor-pointer bg-surface-700 border border-white/[0.08] p-1"
            value={element.fill || '#000000'}
            onChange={e => onChange({ fill: e.target.value } as any)}
          />
        </div>
        <div>
          <label className="label">Opacity</label>
          <input
            type="range"
            className="w-full"
            min={0} max={1} step={0.05}
            value={element.opacity}
            onChange={e => onChange({ opacity: Number(e.target.value) } as any)}
          />
          <span className="text-xs text-slate-500">{(element.opacity * 100).toFixed(0)}%</span>
        </div>
      </div>
    )
  }

  if (element.type === 'image') {
    const fileRef = useRef<HTMLInputElement>(null)
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onChange({ src: reader.result } as any)
        }
      }
      reader.readAsDataURL(file)
    }

    return (
      <div className="space-y-3">
        <div>
          <label className="label">Image / Logo Preview</label>
          <div className="w-full h-24 rounded-lg bg-surface-900 border border-white/10 flex items-center justify-center p-2 mb-2 overflow-hidden">
            {element.src ? (
              <img src={element.src} alt={element.id} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-500">No image loaded</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary w-full text-xs py-2"
          >
            📁 Upload / Replace Image
          </button>
        </div>
        <div>
          <label className="label">Opacity</label>
          <input
            type="range"
            className="w-full"
            min={0} max={1} step={0.05}
            value={element.opacity}
            onChange={e => onChange({ opacity: Number(e.target.value) } as any)}
          />
          <span className="text-xs text-slate-500">{(element.opacity * 100).toFixed(0)}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-mono text-slate-500">Position</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {(['x','y','w','h'] as const).map(k => (
          <div key={k}>
            <label className="label">{k} (mm)</label>
            <input
              type="number"
              className="input text-xs"
              value={element.anchor[k]}
              step={0.5}
              onChange={e => onChange({ anchor: { ...element.anchor, [k]: Number(e.target.value) } } as any)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
