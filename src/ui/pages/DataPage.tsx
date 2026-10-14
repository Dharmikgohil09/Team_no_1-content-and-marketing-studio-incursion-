import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import Papa from 'papaparse'
import type { Person, PersonRowStatus } from '../../core/schema/Person'
import { nanoid } from '../../utils/nanoid'
import { DEFAULT_ROLES } from '../../core/schema/Role'
import { CardPreview } from '../components/CardPreview'
import { getDefaultBrandKit } from '../../brandKits/loader'
import {
  extractImagesFromFiles,
  extractImagesFromZip,
  processImageFile,
  type UploadedImage,
} from '../../core/matching/photoExtractor'
import {
  matchPhotosToParticipants,
  applyManualAssignment,
  type MatchResult,
  type ParticipantMatch,
  type MatchStatus,
} from '../../core/matching/photoMatcher'
import { PhotoPickerModal } from '../components/PhotoPickerModal'

const KNOWN_COLUMNS: Record<string, string[]> = {
  name:     ['name', 'full name', 'fullname', 'participant name', 'participant', 'student name', 'candidate name', 'first name', 'full_name', 'username', 'person name', 'attendee name', 'attendee', 'display name', 'member name', 'name of participant'],
  id:       ['id', 'participant id', 'uid', 'student id', 'roll no', 'registration no', 'reg no', 'ticket id', 'badge id', 'barcode', 'emp id', 'code'],
  role:     ['role', 'type', 'category', 'designation', 'position', 'ticket type', 'pass type'],
  email:    ['email', 'e-mail', 'mail', 'email address'],
  team:     ['team', 'team name', 'group', 'organization', 'org', 'college', 'institute', 'department', 'company'],
  photoUrl: ['photo', 'photo url', 'image', 'picture', 'avatar', 'photo_url', 'image url', 'profile', 'photo_filename', 'filename', 'image_name'],
}

export function DataPage() {
  const navigate      = useNavigate()
  const project       = useProjectStore(s => s.project)
  const setPeople     = useProjectStore(s => s.setPeople)
  const people        = useProjectStore(s => s.people)
  const setWizardStep = useProjectStore(s => s.setWizardStep)

  // CSV & Data state
  const [isCsvDragging, setIsCsvDragging] = useState(false)
  const [isPhotoDragging, setIsPhotoDragging] = useState(false)
  const [columnMap, setColumnMap]         = useState<Record<string, string>>({})
  const [identifierCol, setIdentifierCol] = useState<string>('')
  const [filenameCol, setFilenameCol]     = useState<string>('')
  const [rawColumns, setRawColumns]       = useState<string[]>([])
  const [rawRows, setRawRows]             = useState<Record<string, string>[]>([])
  const [rowStatuses, setRowStatuses]     = useState<PersonRowStatus[]>([])
  const [csvError, setCsvError]           = useState('')

  // Uploaded images & matching state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [invalidFiles, setInvalidFiles]     = useState<{ name: string; reason: string }[]>([])
  const [matchingMethod, setMatchingMethod] = useState<'auto' | 'filename' | 'identifier'>('auto')
  const [allowDuplicateImages, setAllowDuplicateImages] = useState(false)
  const [matchResult, setMatchResult]       = useState<MatchResult | null>(null)
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false)
  const [photoError, setPhotoError]         = useState('')

  // UI / Preview state
  const [previewIdx, setPreviewIdx]         = useState(0)
  const [statusFilter, setStatusFilter]     = useState<string>('all')
  const [searchQuery, setSearchQuery]       = useState('')
  const [modalParticipant, setModalParticipant] = useState<{ name: string; id: string; rowIndex: number; currentPhoto?: string } | null>(null)
  const [confirmedSuccess, setConfirmedSuccess] = useState(false)

  const samplePhotoUrl    = useProjectStore(s => s.samplePhotoUrl)
  const setSamplePhotoUrl = useProjectStore(s => s.setSamplePhotoUrl)

  const brandKit = getDefaultBrandKit()
  const roles    = project?.roles ?? DEFAULT_ROLES.slice(0, 3)
  const template = project?.activeTemplate

  // Auto-suggest column mappings based on aliases
  function suggestMapping(columns: string[]): { map: Record<string, string>; idCol: string; fnCol: string } {
    const map: Record<string, string> = {}
    let idCol = ''
    let fnCol = ''

    for (const [field, aliases] of Object.entries(KNOWN_COLUMNS)) {
      const match = columns.find(col =>
        aliases.some(alias => col.toLowerCase().trim() === alias.toLowerCase())
      )
      if (match) {
        map[match] = field
        if (field === 'id') idCol = match
        if (field === 'photoUrl') fnCol = match
      }
    }
    return { map, idCol, fnCol }
  }

  function parseCSV(text: string) {
    const result = Papa.parse<Record<string, string>>(text, {
      header:         true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    })
    if (result.errors.length > 0) {
      setCsvError(`CSV parse error: ${result.errors[0].message}`)
      return
    }
    const cols = result.meta.fields ?? []
    const suggested = suggestMapping(cols)
    setRawColumns(cols)
    setRawRows(result.data)
    setColumnMap(suggested.map)
    setIdentifierCol(suggested.idCol)
    setFilenameCol(suggested.fnCol)
    setCsvError('')
    setMatchResult(null)
    setConfirmedSuccess(false)
  }

  function handleCsvFile(file: File) {
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
            const suggested = suggestMapping(cols)
            setRawColumns(cols)
            setRawRows(arr)
            setColumnMap(suggested.map)
            setIdentifierCol(suggested.idCol)
            setFilenameCol(suggested.fnCol)
            setCsvError('')
            setMatchResult(null)
            setConfirmedSuccess(false)
          }
        } catch {
          setCsvError('Invalid JSON file format')
        }
      }
    }
    reader.readAsText(file)
  }

  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsCsvDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCsvFile(file)
  }, [])

  // ── Bulk Photo Handlers ────────────────────────────────────────────────────
  async function handleBulkPhotoFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return
    setIsProcessingPhotos(true)
    setPhotoError('')
    try {
      const res = await extractImagesFromFiles(files)
      setUploadedImages(prev => {
        // Deduplicate by filename
        const existingNames = new Set(prev.map(i => i.normalizedName))
        const newImages = res.images.filter(i => !existingNames.has(i.normalizedName))
        return [...prev, ...newImages]
      })
      if (res.invalidFiles.length > 0) {
        setInvalidFiles(prev => [...prev, ...res.invalidFiles])
      }
    } catch (err: any) {
      setPhotoError(`Photo processing failed: ${err?.message || 'Unknown error'}`)
    } finally {
      setIsProcessingPhotos(false)
    }
  }

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessingPhotos(true)
    setPhotoError('')
    try {
      const res = await extractImagesFromZip(file, file.name)
      setUploadedImages(prev => {
        const existingNames = new Set(prev.map(i => i.normalizedName))
        const newImages = res.images.filter(i => !existingNames.has(i.normalizedName))
        return [...prev, ...newImages]
      })
      if (res.invalidFiles.length > 0) {
        setInvalidFiles(prev => [...prev, ...res.invalidFiles])
      }
    } catch (err: any) {
      setPhotoError(`Failed to extract ZIP: ${err?.message || 'Corrupt archive'}`)
    } finally {
      setIsProcessingPhotos(false)
      e.target.value = ''
    }
  }

  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsPhotoDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBulkPhotoFiles(e.dataTransfer.files)
    }
  }, [])

  // ── Run / Re-run Photo Matching ──────────────────────────────────────────
  function runPhotoMatching(currentRecords = rawRows, imagesToUse = uploadedImages) {
    if (currentRecords.length === 0) {
      setCsvError('Please import participant data first before matching photos.')
      return
    }

    const res = matchPhotosToParticipants(currentRecords, imagesToUse, {
      identifierColumn: identifierCol || undefined,
      filenameColumn: filenameCol || undefined,
      matchingMethod,
      allowDuplicateImageUsage: allowDuplicateImages,
      fallbackToId: true,
    })

    setMatchResult(res)
    setConfirmedSuccess(false)
  }

  // ── Apply Mappings and Build Base Rows ────────────────────────────────────
  function applyMapping() {
    const inverseMap: Record<string, string> = {}
    for (const [col, field] of Object.entries(columnMap)) {
      inverseMap[field] = col
    }

    const nameCol = inverseMap.name
    if (!nameCol) {
      setCsvError('Please map at least one column to the "name" field.')
      return
    }

    const effectiveIdCol = identifierCol || inverseMap.id || ''

    const statuses: PersonRowStatus[] = rawRows.map((row, idx) => {
      const errors: string[] = []
      const warnings: string[] = []

      const name = (row[nameCol] ?? '').trim()
      const role = (row[inverseMap.role] ?? 'participant').toLowerCase()
      const id   = (effectiveIdCol ? row[effectiveIdCol] : (row[inverseMap.id] ?? '')) || nanoid(8)

      if (!name) errors.push('Missing participant name')
      if (!roles.some(r => r.id === role)) warnings.push(`Unknown role "${role}" — defaulting to participant`)

      const extra: Record<string, string> = {}
      for (const col of rawColumns) {
        if (!Object.values(inverseMap).includes(col) && col !== effectiveIdCol) {
          extra[col] = row[col] ?? ''
        }
      }

      const person: Person = {
        id,
        name:     name || 'Participant Name',
        role:     roles.some(r => r.id === role) ? role : 'participant',
        email:    row[inverseMap.email] ?? undefined,
        team:     row[inverseMap.team] ?? '',
        photoUrl: row[inverseMap.photoUrl] ?? undefined,
        extra,
      }

      return { person, errors, warnings, rowIndex: idx }
    })

    setRowStatuses(statuses)
    setCsvError('')

    // Automatically trigger photo matching if images are already uploaded
    if (uploadedImages.length > 0) {
      runPhotoMatching(rawRows, uploadedImages)
    }
  }

  // ── Manual Assignment Handlers ───────────────────────────────────────────
  function handleManualSelectImage(selectedImage: UploadedImage | null) {
    if (!modalParticipant || !matchResult) return
    const updated = applyManualAssignment(
      matchResult.matches,
      uploadedImages,
      modalParticipant.rowIndex,
      selectedImage
    )
    setMatchResult(updated)
    setConfirmedSuccess(false)
  }

  async function handleUploadCustomPhoto(file: File) {
    if (!modalParticipant) return
    const processed = await processImageFile(file)
    if (!processed.isValid) {
      setPhotoError(processed.validationError || 'Invalid image')
      return
    }
    setUploadedImages(prev => [processed, ...prev])
    handleManualSelectImage(processed)
  }

  // ── Confirm Matches and Save to Store ─────────────────────────────────────
  function handleConfirmAssignments() {
    if (rawRows.length === 0) return

    const inverseMap: Record<string, string> = {}
    for (const [col, field] of Object.entries(columnMap)) {
      inverseMap[field] = col
    }

    const nameCol = inverseMap.name || 'name'
    const effectiveIdCol = identifierCol || inverseMap.id || ''

    const confirmedPeople: Person[] = rawRows.map((row, idx) => {
      const name = (row[nameCol] ?? '').trim()
      const role = (row[inverseMap.role] ?? 'participant').toLowerCase()
      const id   = (effectiveIdCol ? row[effectiveIdCol] : (row[inverseMap.id] ?? '')) || nanoid(8)

      // Look up matched photo from matchResult if available
      const match = matchResult?.matches.find(m => m.rowIndex === idx)
      const matchedPhotoUrl = match?.assignedImage?.dataUrl || row[inverseMap.photoUrl] || undefined

      const extra: Record<string, string> = {}
      for (const col of rawColumns) {
        if (!Object.values(inverseMap).includes(col) && col !== effectiveIdCol) {
          extra[col] = row[col] ?? ''
        }
      }

      return {
        id,
        name:     name || 'Participant Name',
        role:     roles.some(r => r.id === role) ? role : 'participant',
        email:    row[inverseMap.email] ?? undefined,
        team:     row[inverseMap.team] ?? '',
        photoUrl: matchedPhotoUrl,
        extra,
      }
    })

    setPeople(confirmedPeople)
    setConfirmedSuccess(true)
  }

  // ── Filtering & Counts ───────────────────────────────────────────────────
  const filteredMatches = useMemo(() => {
    if (!matchResult) return []
    let list = matchResult.matches

    if (statusFilter === 'matched') {
      list = list.filter(m => m.status === 'matched')
    } else if (statusFilter === 'missing_photo') {
      list = list.filter(m => m.status === 'missing_photo')
    } else if (statusFilter === 'issues') {
      list = list.filter(m => m.status === 'ambiguous_match' || m.status === 'duplicate_id' || m.status === 'missing_id')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(m => {
        const name = (m.record[columnMap[columnMap.name] || 'name'] || Object.values(m.record).join(' ')).toLowerCase()
        const id = m.identifier.toLowerCase()
        return name.includes(q) || id.includes(q)
      })
    }

    return list
  }, [matchResult, statusFilter, searchQuery, columnMap])

  // Current preview person
  const activeMatch = matchResult?.matches[previewIdx]
  const previewPerson: Person = useMemo(() => {
    if (people.length > 0 && people[previewIdx]) {
      return people[previewIdx]
    }
    if (activeMatch) {
      const row = activeMatch.record
      const inverseMap: Record<string, string> = {}
      for (const [col, field] of Object.entries(columnMap)) inverseMap[field] = col

      return {
        id: activeMatch.identifier || 'ID-042',
        name: (row[inverseMap.name] ?? 'Participant Name').trim(),
        role: (row[inverseMap.role] ?? 'participant').toLowerCase(),
        team: row[inverseMap.team] ?? '',
        photoUrl: activeMatch.assignedImage?.dataUrl || samplePhotoUrl || '',
        extra: {},
      }
    }
    return {
      id: 'P001',
      name: 'Participant Name',
      role: 'participant',
      team: 'Team Alpha',
      photoUrl: samplePhotoUrl || '',
      extra: {},
    }
  }, [people, activeMatch, previewIdx, columnMap, samplePhotoUrl])

  return (
    <div className="animate-slide-up pb-12">
      {/* Page Title */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acm-600/20 border border-acm-500/30 text-acm-300 text-xs font-medium mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-acm-400 animate-pulse-slow" />
          Step 5 of 6 — Dynamic Participant Data & Bulk Photo Matching
        </div>
        <h1 className="text-2xl font-display font-bold text-white">Import Data & Match Photographs</h1>
        <p className="text-slate-400 text-sm mt-1">
          Upload any CSV format, drop bulk photos or ZIP archives, and match every participant accurately.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">

          {/* ── SECTION 1: CSV Upload & Dynamic Mapping ───────────────────── */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-display font-semibold text-white flex items-center gap-2">
                <span>📊</span> 1. Import Participant CSV / JSON
              </h2>
              {rawRows.length > 0 && (
                <span className="badge-blue text-xs font-mono">{rawRows.length} records parsed</span>
              )}
            </div>

            {/* CSV Drop Zone */}
            <div
              id="csv-drop-zone"
              onDragOver={e => { e.preventDefault(); setIsCsvDragging(true) }}
              onDragLeave={() => setIsCsvDragging(false)}
              onDrop={handleCsvDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer mb-4
                ${isCsvDragging ? 'border-acm-500 bg-acm-600/10' : 'border-white/[0.1] hover:border-white/[0.2]'}`}
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
              />
              <div className="text-3xl mb-2">📁</div>
              <p className="text-white font-medium text-sm mb-1">Drop any CSV or JSON file here</p>
              <p className="text-slate-500 text-xs">Supports Google Forms, Excel, or custom exports with arbitrary headers</p>
            </div>

            {csvError && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs mb-4">
                ⚠️ {csvError}
              </div>
            )}

            {/* Dynamic Column Mapping Matrix */}
            {rawColumns.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Map Detected Columns to Schema
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const suggested = suggestMapping(rawColumns)
                      setColumnMap(suggested.map)
                      setIdentifierCol(suggested.idCol)
                      setFilenameCol(suggested.fnCol)
                    }}
                    className="text-[11px] text-acm-300 hover:text-white underline"
                  >
                    Reset to Suggestions
                  </button>
                </div>

                {/* Primary Identifiers Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Unique Identifier Column <span className="text-acm-400">*</span>
                    </label>
                    <select
                      className="input text-xs w-full py-1.5"
                      value={identifierCol}
                      onChange={e => setIdentifierCol(e.target.value)}
                    >
                      <option value="">— Select Unique ID Column (e.g. Roll No, ID) —</option>
                      {rawColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Used for matching photos by filename stem (e.g. ID.jpg → ID)</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Photo Filename Column (Optional)
                    </label>
                    <select
                      className="input text-xs w-full py-1.5"
                      value={filenameCol}
                      onChange={e => setFilenameCol(e.target.value)}
                    >
                      <option value="">— None (or match via Unique ID) —</option>
                      {rawColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">If your CSV contains explicit image filenames (e.g. photo.jpg)</p>
                  </div>
                </div>

                {/* All Column Mappings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                  {rawColumns.map(col => (
                    <div key={col} className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/60 border border-white/5">
                      <span className="text-[11px] font-mono text-slate-400 flex-1 truncate" title={col}>
                        {col}
                      </span>
                      <span className="text-slate-600 text-xs">→</span>
                      <select
                        className="input text-xs py-1 px-2 w-32 shrink-0"
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

                <button
                  id="apply-mapping-btn"
                  onClick={applyMapping}
                  className="btn-primary text-xs py-2.5 px-4 w-full shadow-glow-acm font-semibold flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Apply Mapping & Parse ({rawRows.length} Participants)</span>
                </button>
              </div>
            )}
          </div>

          {/* ── SECTION 2: Dynamic Bulk Photo Upload ───────────────────────── */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-display font-semibold text-white flex items-center gap-2">
                <span>🖼️</span> 2. Bulk Photo Upload
              </h2>
              <div className="flex items-center gap-2">
                <span className="badge-blue text-xs font-mono">{uploadedImages.length} images loaded</span>
                {uploadedImages.length > 0 && (
                  <button
                    onClick={() => { setUploadedImages([]); setMatchResult(null); }}
                    className="text-[11px] text-red-400 hover:text-red-300 underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Photo Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsPhotoDragging(true) }}
              onDragLeave={() => setIsPhotoDragging(false)}
              onDrop={handlePhotoDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200
                ${isPhotoDragging ? 'border-acm-500 bg-acm-600/10' : 'border-white/[0.1] hover:border-white/[0.2]'}`}
            >
              <div className="text-2xl mb-2">📸</div>
              <p className="text-white font-medium text-xs mb-1">
                Drag & drop photographs, ZIP archives, or full folders here
              </p>
              <p className="text-slate-500 text-[11px] mb-4">
                Supported: JPG, JPEG, PNG, WEBP, SVG, AVIF, GIF • Automatic archive extraction
              </p>

              {/* Upload Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <label className="btn-primary text-xs py-2 px-3.5 cursor-pointer shadow-glow-acm flex items-center gap-1.5 font-medium">
                  <span>📦</span>
                  <span>Upload ZIP Archive</span>
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    className="hidden"
                    onChange={handleZipUpload}
                    disabled={isProcessingPhotos}
                  />
                </label>

                <label className="btn-secondary text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5 font-medium">
                  <span>🖼️</span>
                  <span>Select Multiple Images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => e.target.files && handleBulkPhotoFiles(e.target.files)}
                    disabled={isProcessingPhotos}
                  />
                </label>

                <label className="btn-ghost text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5 font-medium text-slate-300 hover:text-white border border-white/10 rounded-lg">
                  <span>📁</span>
                  <span>Select Folder</span>
                  <input
                    type="file"
                    // @ts-ignore - webkitdirectory is standard browser feature
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={e => e.target.files && handleBulkPhotoFiles(e.target.files)}
                    disabled={isProcessingPhotos}
                  />
                </label>
              </div>

              {isProcessingPhotos && (
                <div className="mt-3 flex items-center justify-center gap-2 text-acm-300 text-xs">
                  <div className="w-4 h-4 border-2 border-acm-400 border-t-transparent rounded-full animate-spin" />
                  <span>Extracting and processing photographs...</span>
                </div>
              )}
            </div>

            {photoError && (
              <div className="px-4 py-2.5 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                ⚠️ {photoError}
              </div>
            )}

            {/* Invalid or Unsupported Files Notice */}
            {invalidFiles.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <div className="flex items-center justify-between mb-1 font-semibold">
                  <span>⚠️ {invalidFiles.length} file(s) skipped (unsupported or empty):</span>
                  <button onClick={() => setInvalidFiles([])} className="text-[10px] underline">Dismiss</button>
                </div>
                <ul className="max-h-20 overflow-y-auto list-disc pl-4 text-[11px] text-amber-200/80 space-y-0.5">
                  {invalidFiles.slice(0, 10).map((inv, idx) => (
                    <li key={idx}>{inv.name}: {inv.reason}</li>
                  ))}
                  {invalidFiles.length > 10 && <li>...and {invalidFiles.length - 10} more</li>}
                </ul>
              </div>
            )}
          </div>

          {/* ── SECTION 3: Matching Configuration & Trigger ────────────────── */}
          {rawRows.length > 0 && uploadedImages.length > 0 && (
            <div className="glass p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-display font-semibold text-white flex items-center gap-2">
                    <span>⚡</span> 3. Photo-Matching Configuration
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure how images are associated with each participant.
                  </p>
                </div>

                <button
                  id="run-match-btn"
                  onClick={() => runPhotoMatching()}
                  className="btn-primary text-xs py-2 px-4 shadow-glow-acm shrink-0 font-semibold flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>Match Photos ({rawRows.length} × {uploadedImages.length})</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-surface-800/60 border border-white/5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Matching Strategy
                  </label>
                  <select
                    className="input text-xs w-full py-1.5"
                    value={matchingMethod}
                    onChange={e => setMatchingMethod(e.target.value as any)}
                  >
                    <option value="auto">Auto-Match (Filename first, then Unique ID stem)</option>
                    <option value="identifier">Unique Identifier Stem Only (e.g. ID.jpg → ID)</option>
                    <option value="filename">Explicit Filename Column Only</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={allowDuplicateImages}
                      onChange={e => setAllowDuplicateImages(e.target.checked)}
                      className="w-4 h-4 accent-acm-500 rounded"
                    />
                    <span className="text-xs text-slate-300">Allow same photo to be assigned to multiple participants</span>
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1 pl-6.5">
                    Leave unchecked to flag ambiguous duplicates if one image matches multiple records.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SECTION 4: Matching Summary Dashboard ──────────────────────── */}
          {matchResult && (
            <div className="glass p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-display font-semibold text-white flex items-center gap-2">
                  <span>📋</span> 4. Matching Review & Verification
                </h2>
                <div className="flex items-center gap-2">
                  {matchResult.counts.matched === matchResult.counts.totalRecords && matchResult.counts.totalRecords > 0 ? (
                    <span className="badge-green text-xs font-semibold">✓ 100% Matched</span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {matchResult.counts.matched} / {matchResult.counts.totalRecords} matched
                    </span>
                  )}
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-xl bg-surface-800/80 border border-white/5 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Rows</span>
                  <span className="text-lg font-bold text-white font-mono">{matchResult.counts.totalRecords}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-emerald-300 block uppercase tracking-wider">Matched</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">{matchResult.counts.matched}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[10px] text-amber-300 block uppercase tracking-wider">Missing Photo</span>
                  <span className="text-lg font-bold text-amber-400 font-mono">{matchResult.counts.missingPhoto}</span>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <span className="text-[10px] text-red-300 block uppercase tracking-wider">Ambiguous</span>
                  <span className="text-lg font-bold text-red-400 font-mono">{matchResult.counts.ambiguous}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <span className="text-[10px] text-purple-300 block uppercase tracking-wider">Missing/Dup ID</span>
                  <span className="text-lg font-bold text-purple-400 font-mono">
                    {matchResult.counts.missingId + matchResult.counts.duplicateId}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-800/80 border border-white/5 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Extra Images</span>
                  <span className="text-lg font-bold text-slate-300 font-mono">{matchResult.counts.extraImages}</span>
                </div>
              </div>

              {/* Warnings / Errors from Engine */}
              {matchResult.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-1">
                  {matchResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="shrink-0">⚠️</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Filter Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: `All (${matchResult.counts.totalRecords})` },
                    { id: 'matched', label: `Matched (${matchResult.counts.matched})` },
                    { id: 'missing_photo', label: `Missing (${matchResult.counts.missingPhoto})` },
                    { id: 'issues', label: `Issues (${matchResult.counts.ambiguous + matchResult.counts.duplicateId + matchResult.counts.missingId})` },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0
                        ${statusFilter === tab.id
                          ? 'bg-acm-600 text-white shadow-glow-acm'
                          : 'bg-white/5 text-slate-400 hover:text-white'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    placeholder="Search name or ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input text-xs w-full py-1.5 pl-7"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
                </div>
              </div>

              {/* Participant Matching Table */}
              <div className="border border-white/5 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-800 text-slate-400 border-b border-white/10 z-10">
                    <tr>
                      <th className="text-left py-2 px-3 w-12">#</th>
                      <th className="text-left py-2 px-3 w-16">Photo</th>
                      <th className="text-left py-2 px-3">Participant & ID</th>
                      <th className="text-left py-2 px-3">Matched File</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-500">
                          No records match this filter
                        </td>
                      </tr>
                    ) : (
                      filteredMatches.map(m => {
                        const isSelected = previewIdx === m.rowIndex
                        const name = (m.record[columnMap[columnMap.name] || 'name'] || m.record.name || 'Participant Name').trim()
                        const role = (m.record.role || 'participant').toLowerCase()

                        return (
                          <tr
                            key={m.rowIndex}
                            onClick={() => setPreviewIdx(m.rowIndex)}
                            className={`cursor-pointer transition-colors hover:bg-white/[0.03]
                              ${isSelected ? 'bg-acm-600/15' : ''}`}
                          >
                            <td className="py-2.5 px-3 text-slate-500 font-mono">{m.rowIndex + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-900 border border-white/10 flex items-center justify-center shrink-0">
                                {m.assignedImage ? (
                                  <img
                                    src={m.assignedImage.dataUrl}
                                    alt={m.assignedImage.filename}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                                    {name.slice(0, 2) || 'NA'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-white">{name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                ID: <span className="text-slate-300">{m.identifier || '—'}</span>
                                {role ? ` · ${role}` : ''}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {m.assignedImage ? (
                                <span className="text-emerald-300 font-medium truncate block max-w-[140px]" title={m.assignedImage.filename}>
                                  {m.assignedImage.filename}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">None</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {m.status === 'matched' && (
                                <span className="badge-green text-[10px]">✓ Matched</span>
                              )}
                              {m.status === 'missing_photo' && (
                                <span className="badge-amber text-[10px]">📷 No Photo</span>
                              )}
                              {m.status === 'ambiguous_match' && (
                                <span className="badge-red text-[10px]" title={m.statusReason}>⚠️ Ambiguous</span>
                              )}
                              {m.status === 'duplicate_id' && (
                                <span className="badge-red text-[10px]" title={m.statusReason}>⚠️ Duplicate ID</span>
                              )}
                              {m.status === 'missing_id' && (
                                <span className="badge-red text-[10px]" title={m.statusReason}>⚠️ Missing ID</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setModalParticipant({
                                    name,
                                    id: m.identifier,
                                    rowIndex: m.rowIndex,
                                    currentPhoto: m.assignedImage?.dataUrl,
                                  })
                                }}
                                className="btn-secondary text-[11px] py-1 px-2.5"
                              >
                                {m.assignedImage ? 'Change' : 'Assign'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Unmatched / Extra Images Shelf ──────────────────────────── */}
              {matchResult.unmatchedImages.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Unmatched Uploaded Photos ({matchResult.unmatchedImages.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Click any photo to assign it to the currently selected participant
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {matchResult.unmatchedImages.map(img => (
                      <div
                        key={img.id}
                        onClick={() => {
                          if (matchResult && matchResult.matches[previewIdx]) {
                            handleManualSelectImage(img)
                          }
                        }}
                        className="group flex-shrink-0 w-20 p-1 rounded-xl bg-surface-800 border border-white/10 hover:border-acm-500/60 cursor-pointer transition-all text-center"
                        title={`Click to assign "${img.filename}" to participant #${previewIdx + 1}`}
                      >
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/40 mb-1">
                          <img src={img.dataUrl} alt={img.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <span className="text-[9px] font-mono text-slate-300 block truncate">{img.filename}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Action Button */}
              <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  {confirmedSuccess ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <span>✓</span> All photo assignments confirmed and persisted!
                    </span>
                  ) : (
                    <span>Review assignments above, then click confirm to apply photos to participant cards.</span>
                  )}
                </div>

                <button
                  id="confirm-assignments-btn"
                  onClick={handleConfirmAssignments}
                  className="btn-primary text-xs py-2.5 px-6 shadow-glow-acm font-semibold flex items-center gap-2"
                >
                  <span>✓</span>
                  <span>Confirm & Save Assignments ({matchResult.counts.matched} Photos)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT PANEL: Interactive Card Preview & Wizard Navigation ─────── */}
        <div className="space-y-4">
          {template ? (
            <div className="glass p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Live Card Preview</p>
                <span className="badge-blue text-[10px]">
                  Participant #{previewIdx + 1} of {rawRows.length || 1}
                </span>
              </div>

              <div className="card-preview-wrapper shadow-2xl rounded-xl overflow-hidden bg-surface-900 border border-white/10">
                <CardPreview
                  template={template}
                  role={roles.find(r => r.id === previewPerson.role) ?? roles[0]}
                  person={previewPerson}
                  event={{
                    ...project?.eventContext,
                    name: { value: project?.eventContext?.name?.value || 'EVENT PASS', status: project?.eventContext?.name?.status || 'provided' },
                    venue: { value: project?.eventContext?.venue?.value || '', status: project?.eventContext?.venue?.status || 'missing' },
                    dateStart: { value: project?.eventContext?.dateStart?.value || '', status: project?.eventContext?.dateStart?.status || 'missing' },
                    organizer: { value: project?.eventContext?.organizer?.value || '', status: project?.eventContext?.organizer?.status || 'missing' },
                    tagline: { value: project?.eventContext?.tagline?.value || '', status: project?.eventContext?.tagline?.status || 'missing' },
                  } as any}
                  brandKit={brandKit}
                />
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs font-semibold text-white truncate">{previewPerson.name}</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  ID: {previewPerson.id} · <span className="capitalize">{previewPerson.role}</span>
                </p>
              </div>

              {/* Single photo override for this preview person */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Photo:</span>
                <button
                  onClick={() => {
                    setModalParticipant({
                      name: previewPerson.name,
                      id: previewPerson.id,
                      rowIndex: previewIdx,
                      currentPhoto: previewPerson.photoUrl,
                    })
                  }}
                  className="btn-secondary text-[11px] py-1 px-3 flex items-center gap-1.5"
                >
                  <span>📷</span>
                  <span>{previewPerson.photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="glass p-8 text-center">
              <p className="text-slate-500 text-sm">Select a draft template to see a card preview</p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="space-y-2">
            <button
              id="data-next-btn"
              onClick={() => {
                // If user hasn't explicitly clicked confirm but has parsed rows, confirm now
                if (!confirmedSuccess && rawRows.length > 0) {
                  handleConfirmAssignments()
                }
                setWizardStep(5)
                navigate('/studio/export')
              }}
              className="btn-primary w-full py-3 shadow-glow-acm text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Go to Export</span>
              <span>→</span>
            </button>
            <button
              onClick={() => navigate('/studio/editor')}
              className="btn-ghost w-full text-xs text-slate-400 hover:text-white"
            >
              ← Back to Editor
            </button>
          </div>
        </div>
      </div>

      {/* ── Photo Picker Modal ─────────────────────────────────────────────── */}
      <PhotoPickerModal
        isOpen={!!modalParticipant}
        onClose={() => setModalParticipant(null)}
        participant={modalParticipant}
        images={uploadedImages}
        onSelectImage={handleManualSelectImage}
        onUploadCustomPhoto={handleUploadCustomPhoto}
      />
    </div>
  )
}
