import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import { exportSvg, downloadSvg } from '../../core/export/svg'
import { exportPdf, downloadPdf } from '../../core/export/pdf'
import { exportPng, downloadPng } from '../../core/export/png'
import { listTemplates } from '../../templates/registry'

const SAMPLE_PERSON = {
  id: 'SAMPLE-001',
  name: 'Aarav Sharma',
  role: 'participant',
  email: 'aarav@example.com',
  team: 'Team Alpha',
  photoUrl: '',
  extra: {},
}

export function ExportPage() {
  const navigate  = useNavigate()
  const project   = useProjectStore(s => s.project)
  const people    = useProjectStore(s => s.people)

  const [format,       setFormat]       = useState<'svg' | 'pdf' | 'png'>('pdf')
  const [dpi,          setDpi]          = useState<150 | 300 | 600>(300)
  const [includeBleed, setIncludeBleed] = useState(true)
  const [exportFace,   setExportFace]   = useState<'front' | 'back'>('front')
  const [exporting,    setExporting]    = useState(false)
  const [done,         setDone]         = useState(false)

  useEffect(() => {
    const hasInput = Boolean(project?.eventContext?.description?.value?.trim() || project?.eventContext?.name?.value?.trim())
    if (!project || !hasInput) {
      navigate('/studio/describe', { replace: true })
    }
  }, [project])

  const brandKit = getDefaultBrandKit()
  const roles    = (project?.roles && project.roles.length > 0) ? project.roles : DEFAULT_ROLES
  const template = project?.activeTemplate || project?.drafts?.[0] || listTemplates()[0]
  const cardSize = template?.size || { name: 'CR80', widthMm: 54, heightMm: 85.6, bleedMm: 3, safeMarginMm: 3 }
  const samplePhotoUrl = useProjectStore(s => s.samplePhotoUrl)

  const exportPeople = (people.length > 0 ? people : [SAMPLE_PERSON]).map(p => ({
    ...p,
    photoUrl: p.photoUrl || samplePhotoUrl || '',
  }))
  const previewRole  = roles.find(r => r.id === exportPeople[0]?.role) ?? roles[0] ?? DEFAULT_ROLES[0]

  async function handleExport() {
    if (!template) return
    setExporting(true)
    setDone(false)

    try {
      const eventCtx = project?.eventContext ?? { name: { value: 'event_cards', status: 'provided' } }
      const filename = `${((eventCtx.name as any)?.value ?? 'cards').replace(/\s+/g, '_')}`

      if (format === 'svg') {
        // Export first person as sample SVG
        const person = exportPeople[0]
        const role   = roles.find(r => r.id === person.role) ?? roles[0] ?? DEFAULT_ROLES[0]
        const svg    = exportSvg({ template, role, person, event: eventCtx as any, brandKit, includeBleed, face: exportFace })
        downloadSvg(svg, `${filename}_${person.name.replace(/\s+/g, '_')}_${exportFace}.svg`)

      } else if (format === 'pdf') {
        const pdfBytes = await exportPdf({
          template,
          roles,
          people: exportPeople,
          event:  eventCtx as any,
          brandKit,
          includeBleed,
          dpi,
          multiPage: true,
        })
        downloadPdf(pdfBytes, `${filename}_cards.pdf`)

      } else if (format === 'png') {
        const person = exportPeople[0]
        const role   = roles.find(r => r.id === person.role) ?? roles[0] ?? DEFAULT_ROLES[0]
        const blob   = await exportPng({ template, role, person, event: eventCtx as any, brandKit, dpi, includeBleed, face: exportFace })
        downloadPng(blob, `${filename}_${person.name.replace(/\s+/g, '_')}_${exportFace}_${dpi}dpi.png`)
      }

      setDone(true)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  if (!template) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">No template available to export. Complete the wizard first.</p>
        <button onClick={() => navigate('/studio/drafts')} className="btn-primary mt-4">← Back to Drafts</button>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 6 of 6 — Export
        </div>
        <h1 className="text-2xl font-display font-bold text-white">Export print-ready files</h1>
        <p className="text-slate-400 text-sm mt-1">{exportPeople.length} {exportPeople.length === 1 ? 'card' : 'cards'} ready to export</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Options */}
        <div className="space-y-5">
          {/* Format */}
          <div className="glass p-5">
            <h3 className="section-heading text-sm mb-4">Export Format</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: 'pdf', icon: '📄', label: 'PDF', desc: 'Multi-page, vector, print-ready' },
                { id: 'png', icon: '🖼', label: 'PNG', desc: 'Rasterized at chosen DPI' },
                { id: 'svg', icon: '⬡', label: 'SVG', desc: 'Native vector, editable' },
              ] as const).map(f => (
                <button
                  key={f.id}
                  id={`format-${f.id}`}
                  onClick={() => setFormat(f.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${format === f.id
                      ? 'border-acm-500 bg-acm-600/20'
                      : 'border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02]'
                    }`}
                >
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="font-semibold text-white text-sm">{f.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* DPI (PNG only) */}
          {format === 'png' && (
            <div className="glass p-5">
              <h3 className="section-heading text-sm mb-4">Resolution (DPI)</h3>
              <div className="flex gap-3">
                {([150, 300, 600] as const).map(d => (
                  <button
                    key={d}
                    id={`dpi-${d}`}
                    onClick={() => setDpi(d)}
                    className={`flex-1 py-3 rounded-xl border-2 text-center text-sm font-semibold transition-all
                      ${dpi === d ? 'border-acm-500 bg-acm-600/20 text-white' : 'border-white/[0.08] text-slate-400 hover:border-white/[0.2]'}`}
                  >
                    {d} DPI
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {dpi === 150 ? 'Screen quality' : dpi === 300 ? 'Print quality (recommended)' : 'High-res print (large files)'}
              </p>
            </div>
          )}

          {/* Options */}
          <div className="glass p-5">
            <h3 className="section-heading text-sm mb-4">Print Options</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-white font-medium">Include bleed area</span>
                  <p className="text-xs text-slate-500 mt-0.5">Adds {cardSize.bleedMm}mm bleed + crop marks</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-acm-500"
                  checked={includeBleed}
                  onChange={e => setIncludeBleed(e.target.checked)}
                />
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="glass-sm p-4">
            <h3 className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Export Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Cards</span>
                <span className="text-white font-medium">{exportPeople.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Format</span>
                <span className="text-white font-medium uppercase">{format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Card size</span>
                <span className="text-white font-medium">{cardSize.widthMm} × {cardSize.heightMm} mm</span>
              </div>
              {includeBleed && (
                <div className="flex justify-between">
                  <span className="text-slate-500">With bleed</span>
                  <span className="text-white font-medium">{cardSize.widthMm + cardSize.bleedMm * 2} × {cardSize.heightMm + cardSize.bleedMm * 2} mm</span>
                </div>
              )}
              {format === 'png' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Output pixels</span>
                  <span className="text-white font-medium">
                    {Math.round((cardSize.widthMm / 25.4) * dpi)} × {Math.round((cardSize.heightMm / 25.4) * dpi)} px
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Export button */}
          <button
            id="export-btn"
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary w-full text-base py-4 justify-center"
          >
            {exporting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting {exportPeople.length} cards…
              </>
            ) : (
              <>⬇ Export {format.toUpperCase()} ({exportPeople.length} cards)</>
            )}
          </button>

          {done && (
            <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm text-center">
              ✓ Export complete! Check your downloads.
            </div>
          )}

          <button onClick={() => navigate('/studio/data')} className="btn-ghost w-full text-sm">← Back to Data</button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="glass p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Export Preview</p>
              <div className="flex items-center gap-1 p-0.5 bg-surface-900 rounded-lg border border-white/10">
                <button
                  onClick={() => setExportFace('front')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    exportFace === 'front' ? 'bg-acm-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setExportFace('back')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    exportFace === 'back' ? 'bg-acm-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            {template && (
              <div className="card-preview-wrapper shadow-2xl rounded-xl overflow-hidden">
                <CardPreview
                  template={template}
                  role={previewRole}
                  person={exportPeople[0]}
                  event={project?.eventContext}
                  brandKit={brandKit}
                  face={exportFace}
                  includeBleed={includeBleed}
                />
              </div>
            )}
            {includeBleed && (
              <p className="text-[11px] text-slate-500 mt-2 text-center">Dashed border = 3mm bleed area with crop marks</p>
            )}
          </div>

          {/* Color & Print Note */}
          <div className="glass-sm p-4 text-xs text-slate-500 space-y-1">
            <p className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>🖨</span> Print-Ready Accuracy (54 × 86 mm)
            </p>
            <p>Export files preserve exact CR80 physical dimensions, 300 DPI resolution, and vector badge integrity.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

