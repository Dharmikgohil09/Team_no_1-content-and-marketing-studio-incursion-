import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import type { CardTemplate } from '../../core/schema/CardTemplate'
import type { Element, TextElement, ShapeElement } from '../../core/schema/Element'

const SAMPLE_PERSON = {
  id: 'SAMPLE-001',
  name: 'Aarav Sharma',
  role: 'participant',
  email: 'aarav@example.com',
  team: 'Team Alpha',
  photoUrl: '',
  extra: {},
}

export function EditorPage() {
  const navigate          = useNavigate()
  const project           = useProjectStore(s => s.project)
  const updateTemplate    = useProjectStore(s => s.updateActiveTemplate)
  const saveVersion       = useProjectStore(s => s.saveVersion)
  const setWizardStep     = useProjectStore(s => s.setWizardStep)

  const [selectedEl, setSelectedEl] = useState<string | null>(null)
  const [previewRole, setPreviewRole] = useState<string>('participant')
  const [history, setHistory]         = useState<CardTemplate[]>([])
  const [historyIdx, setHistoryIdx]   = useState(-1)
  const [showValidation, setShowValidation] = useState(false)

  const brandKit = getDefaultBrandKit()
  const roles    = project?.roles?.length ? project.roles : DEFAULT_ROLES.slice(0, 3)
  const template = project?.activeTemplate
  const role     = roles.find(r => r.id === previewRole) ?? roles[0]
  const person   = { ...SAMPLE_PERSON, role: previewRole }

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
    const newElements = template.elements.map(el =>
      el.id === elementId ? { ...el, ...patch } : el
    ) as Element[]
    const newTpl = { ...template, elements: newElements }
    pushHistory(template)
    updateTemplate(newTpl)
  }

  const selected = template?.elements.find(el => el.id === selectedEl)

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
            Step 4 of 6 — Editor
          </div>
          <h1 className="text-2xl font-display font-bold text-white">{template.name}</h1>
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
          {/* Role preview tabs */}
          <div className="flex gap-2 flex-wrap">
            {roles.map(r => (
              <button
                key={r.id}
                id={`editor-role-${r.id}`}
                onClick={() => setPreviewRole(r.id)}
                style={{
                  backgroundColor: previewRole === r.id ? r.palette.primary + '33' : undefined,
                  borderColor:     previewRole === r.id ? r.palette.primary : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border
                  ${previewRole === r.id ? 'text-white' : 'text-slate-400 border-white/[0.08] hover:text-white'}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Card canvas */}
          <div className="glass p-6 flex flex-col items-center gap-6">
            <div className="w-full max-w-lg card-preview-wrapper">
              <CardPreview
                template={template}
                role={role}
                person={person}
                event={project.eventContext}
                brandKit={brandKit}
                face="front"
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
                      person={{ ...SAMPLE_PERSON, role: r.id }}
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
          {/* Element list */}
          <div className="glass p-4">
            <h3 className="section-heading text-sm mb-3">Elements</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {template.elements.map(el => (
                <button
                  key={el.id}
                  onClick={() => setSelectedEl(el.id === selectedEl ? null : el.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2
                    ${el.id === selectedEl
                      ? 'bg-acm-600/30 text-acm-300 border border-acm-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 w-12 shrink-0">{el.type}</span>
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
            <h3 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Card Size</h3>
            <div className="text-sm text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Format</span>
                <span>{template.size.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Size</span>
                <span>{template.size.widthMm} × {template.size.heightMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bleed</span>
                <span>{template.size.bleedMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Safe margin</span>
                <span>{template.size.safeMarginMm} mm</span>
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
