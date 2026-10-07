import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import Papa from 'papaparse'
import type { Person, PersonRowStatus } from '../../core/schema/Person'
import { nanoid } from '../../utils/nanoid'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'

const KNOWN_COLUMNS = {
  name:     ['name', 'full name', 'fullname', 'participant name'],
  role:     ['role', 'type', 'category'],
  email:    ['email', 'e-mail', 'mail'],
  team:     ['team', 'team name', 'group'],
  id:       ['id', 'participant id', 'uid', 'student id', 'roll no'],
  photoUrl: ['photo', 'photo url', 'image', 'picture'],
}

export function DataPage() {
  const navigate      = useNavigate()
  const project       = useProjectStore(s => s.project)
  const setPeople     = useProjectStore(s => s.setPeople)
  const people        = useProjectStore(s => s.people)
  const setWizardStep = useProjectStore(s => s.setWizardStep)

  const [isDragging, setIsDragging]     = useState(false)
  const [columnMap, setColumnMap]       = useState<Record<string, string>>({})
  const [rawColumns, setRawColumns]     = useState<string[]>([])
  const [rawRows, setRawRows]           = useState<Record<string, string>[]>([])
  const [rowStatuses, setRowStatuses]   = useState<PersonRowStatus[]>([])
  const [previewIdx, setPreviewIdx]     = useState(0)
  const [error, setError]               = useState('')

  const brandKit = getDefaultBrandKit()
  const roles    = project?.roles ?? DEFAULT_ROLES.slice(0, 3)
  const template = project?.activeTemplate

  // Auto-detect column mapping
  function detectMapping(columns: string[]): Record<string, string> {
    const map: Record<string, string> = {}
    for (const [field, aliases] of Object.entries(KNOWN_COLUMNS)) {
      const match = columns.find(col =>
        aliases.some(alias => col.toLowerCase().trim() === alias.toLowerCase())
      )
      if (match) map[match] = field
    }
    return map
  }

  function parseCSV(text: string) {
    const result = Papa.parse<Record<string, string>>(text, {
      header:         true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    })
    if (result.errors.length > 0) {
      setError(`CSV parse error: ${result.errors[0].message}`)
      return
    }
    const cols = result.meta.fields ?? []
    setRawColumns(cols)
    setRawRows(result.data)
    setColumnMap(detectMapping(cols))
    setError('')
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      if (file.name.endsWith('.csv')) {
        parseCSV(text)
      } else {
        try {
          const json = JSON.parse(text)
          const arr = Array.isArray(json) ? json : json.data ?? json.participants ?? []
          if (arr.length > 0) {
            const cols = Object.keys(arr[0])
            setRawColumns(cols)
            setRawRows(arr)
            setColumnMap(detectMapping(cols))
          }
        } catch { setError('Invalid JSON file') }
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  function applyMapping() {
    const inverseMap: Record<string, string> = {}
    for (const [col, field] of Object.entries(columnMap)) {
      inverseMap[field] = col
    }

    const statuses: PersonRowStatus[] = rawRows.map((row, idx) => {
      const errors:   string[] = []
      const warnings: string[] = []

      const name = row[inverseMap.name] ?? ''
      const role = (row[inverseMap.role] ?? 'participant').toLowerCase()
      const id   = row[inverseMap.id] ?? nanoid(8)

      if (!name.trim()) errors.push('Missing name')
      if (!roles.some(r => r.id === role)) warnings.push(`Unknown role "${role}" — defaulting to participant`)

      const extra: Record<string, string> = {}
      for (const col of rawColumns) {
        if (!Object.values(inverseMap).includes(col)) {
          extra[col] = row[col] ?? ''
        }
      }

      const person: Person = {
        id,
        name:     name || '[No Name]',
        role:     roles.some(r => r.id === role) ? role : 'participant',
        email:    row[inverseMap.email] ?? undefined,
        team:     row[inverseMap.team] ?? undefined,
        photoUrl: row[inverseMap.photoUrl] ?? undefined,
        extra,
      }

      return { person, errors, warnings, rowIndex: idx }
    })

    setRowStatuses(statuses)
    setPeople(statuses.map(s => s.person))
  }

  const errorCount   = rowStatuses.filter(s => s.errors.length > 0).length
  const warningCount = rowStatuses.filter(s => s.warnings.length > 0).length
  const previewPerson = rowStatuses[previewIdx]?.person

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 5 of 6 — Participant Data
        </div>
        <h1 className="text-2xl font-display font-bold text-white">Import participant data</h1>
        <p className="text-slate-400 text-sm mt-1">CSV or JSON from Google Forms export. We'll auto-detect columns.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5">
          {/* Upload zone */}
          <div
            id="csv-drop-zone"
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
              ${isDragging ? 'border-acm-500 bg-acm-600/10' : 'border-white/[0.1] hover:border-white/[0.2]'}`}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="text-4xl mb-3">📊</div>
            <p className="text-white font-medium mb-1">Drop CSV or JSON here</p>
            <p className="text-slate-500 text-sm">or click to browse • Google Forms export friendly</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
          )}

          {/* Column mapping */}
          {rawColumns.length > 0 && (
            <div className="glass p-5">
              <h3 className="section-heading text-sm mb-4">Column Mapping</h3>
              <div className="grid grid-cols-2 gap-3">
                {rawColumns.map(col => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 w-28 truncate" title={col}>{col}</span>
                    <span className="text-slate-600">→</span>
                    <select
                      className="input flex-1 text-xs py-1.5"
                      value={columnMap[col] ?? ''}
                      onChange={e => setColumnMap(m => ({ ...m, [col]: e.target.value }))}
                    >
                      <option value="">— ignore —</option>
                      {Object.keys(KNOWN_COLUMNS).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                      <option value="extra">extra field</option>
                    </select>
                  </div>
                ))}
              </div>
              <button id="apply-mapping-btn" onClick={applyMapping} className="btn-primary mt-4 w-full">
                Apply Mapping & Preview ({rawRows.length} rows)
              </button>
            </div>
          )}

          {/* Data table */}
          {rowStatuses.length > 0 && (
            <div className="glass p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-heading text-sm">
                  {rowStatuses.length} people imported
                </h3>
                <div className="flex gap-2">
                  {errorCount > 0   && <span className="badge-red">{errorCount} errors</span>}
                  {warningCount > 0 && <span className="badge-amber">{warningCount} warnings</span>}
                  {errorCount === 0 && <span className="badge-green">✓ Ready</span>}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-800 text-slate-400">
                    <tr>
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Name</th>
                      <th className="text-left py-2 px-2">Role</th>
                      <th className="text-left py-2 px-2">Team</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowStatuses.map((rs, i) => (
                      <tr
                        key={i}
                        onClick={() => setPreviewIdx(i)}
                        className={`border-t border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition-colors
                          ${previewIdx === i ? 'bg-acm-600/10' : ''}`}
                      >
                        <td className="py-2 px-2 text-slate-600">{i + 1}</td>
                        <td className="py-2 px-2 text-white font-medium">{rs.person.name}</td>
                        <td className="py-2 px-2 text-slate-400 capitalize">{rs.person.role}</td>
                        <td className="py-2 px-2 text-slate-500">{rs.person.team ?? '—'}</td>
                        <td className="py-2 px-2">
                          {rs.errors.length > 0   && <span className="badge-red text-[10px]">⚠ Error</span>}
                          {rs.errors.length === 0 && rs.warnings.length > 0 && <span className="badge-amber text-[10px]">⚠ Warn</span>}
                          {rs.errors.length === 0 && rs.warnings.length === 0 && <span className="text-emerald-500 text-[10px]">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="space-y-4">
          {template && previewPerson ? (
            <div className="glass p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Card Preview</p>
              <div className="card-preview-wrapper">
                <CardPreview
                  template={template}
                  role={roles.find(r => r.id === previewPerson.role) ?? roles[0]}
                  person={previewPerson}
                  event={project?.eventContext}
                  brandKit={brandKit}
                />
              </div>
              <p className="text-center text-xs text-slate-500 mt-2">{previewPerson.name}</p>
            </div>
          ) : (
            <div className="glass p-8 text-center">
              <p className="text-slate-500 text-sm">Import data to see a preview</p>
            </div>
          )}

          {/* Skip option */}
          <div className="glass-sm p-4 text-sm text-slate-500">
            <p className="mb-2 text-slate-300 font-medium">No data file yet?</p>
            <p>You can skip this step and export a single sample card, or come back later.</p>
          </div>

          {/* Next */}
          <button
            id="data-next-btn"
            onClick={() => { setWizardStep(5); navigate('/studio/export') }}
            className="btn-primary w-full"
          >
            Go to Export →
          </button>
          <button onClick={() => navigate('/studio/editor')} className="btn-ghost w-full text-sm">← Back to Editor</button>
        </div>
      </div>
    </div>
  )
}
