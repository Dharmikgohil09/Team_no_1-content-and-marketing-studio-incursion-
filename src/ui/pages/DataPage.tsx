import { useState, useEffect, useCallback, useMemo } from 'react'
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
import {
  extractCountFromDescription,
  getExpectedParticipantCount,
} from '../../utils/participantCount'

const KNOWN_COLUMNS: Record<string, string[]> = {
  name:     ['name', 'full name', 'fullname', 'participant name', 'participant', 'student name', 'candidate name', 'first name', 'full_name', 'username', 'person name', 'attendee name', 'attendee', 'display name', 'member name', 'name of participant'],
  id:       ['id', 'participant id', 'uid', 'student id', 'roll no', 'registration no', 'reg no', 'ticket id', 'badge id', 'barcode', 'emp id', 'code'],
  role:     ['role', 'type', 'category', 'designation', 'position', 'ticket type', 'pass type'],
  email:    ['email', 'e-mail', 'mail', 'email address'],
  team:     ['team', 'team name', 'group', 'organization', 'org', 'college', 'institute', 'department', 'company'],
  photoUrl: ['photo', 'photo url', 'image', 'picture', 'avatar', 'photo_url', 'image url', 'profile', 'photo_filename', 'filename', 'image_name'],
  website:  ['website', 'website link', 'url', 'link', 'web', 'site', 'portfolio', 'linkedin', 'github', 'profile link', 'qr link', 'qr', 'qr url'],
}

export function DataPage() {
  const navigate      = useNavigate()
  const project       = useProjectStore(s => s.project)
  const setPeople     = useProjectStore(s => s.setPeople)
  const people        = useProjectStore(s => s.people)
  const setWizardStep = useProjectStore(s => s.setWizardStep)

  const expectedParticipantCount = useMemo(() => getExpectedParticipantCount(project), [project])
  const [targetCount, setTargetCount] = useState<number>(() => expectedParticipantCount || 5)

  // CSV & Data state
  const [isCsvDragging, setIsCsvDragging] = useState(false)
  const [isPhotoDragging, setIsPhotoDragging] = useState(false)
  const [columnMap, setColumnMap]         = useState<Record<string, string>>({})
  const [identifierCol, setIdentifierCol] = useState<string>('')
  const [filenameCol, setFilenameCol]     = useState<string>('')
  const [rawColumns, setRawColumns]       = useState<string[]>([])
  const [allParsedRows, setAllParsedRows] = useState<Record<string, string>[]>([])
  const [rawRows, setRawRows]             = useState<Record<string, string>[]>([])
  const [rowStatuses, setRowStatuses]     = useState<PersonRowStatus[]>([])
  const [csvError, setCsvError]           = useState('')
  const [batchWebsiteInput, setBatchWebsiteInput] = useState<string>(() => project?.eventContext?.website?.value || '')
  // Redirect to Describe if project or input is missing
  useEffect(() => {
    const hasInput = Boolean(project?.eventContext?.description?.value?.trim() || project?.eventContext?.name?.value?.trim())
    if (!project || !hasInput) {
      navigate('/studio/describe', { replace: true })
    }
  }, [project])

  // Sync targetCount when expectedParticipantCount is detected
  useEffect(() => {
    if (expectedParticipantCount && expectedParticipantCount > 0) {
      setTargetCount(expectedParticipantCount)
      if (allParsedRows.length > expectedParticipantCount) {
        setRawRows(allParsedRows.slice(0, expectedParticipantCount))
      } else if (rawRows.length > expectedParticipantCount) {
        setRawRows(rawRows.slice(0, expectedParticipantCount))
      }
    }
  }, [expectedParticipantCount, allParsedRows.length, rawRows.length])

  // If people already exist in store and no CSV parsed yet in current view, load and adapt to expectedParticipantCount
  useEffect(() => {
    if (people.length > 0 && allParsedRows.length === 0 && rawRows.length === 0) {
      const rows = people.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        email: p.email || '',
        team: p.team || '',
        photoUrl: p.photoUrl || '',
        website: p.website || '',
        ...(p.extra || {}),
      }))
      const cols = ['name', 'id', 'role', 'team', 'email', 'website']
      processImportedRows(rows, cols)
    }
  }, [people.length])

  // Uploaded images & matching state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [invalidFiles, setInvalidFiles]     = useState<{ name: string; reason: string }[]>([])
  const [matchingMethod, setMatchingMethod] = useState<'auto' | 'filename' | 'identifier'>('auto')
  const [allowDuplicateImages, setAllowDuplicateImages] = useState(false)
  const [matchResult, setMatchResult]       = useState<MatchResult | null>(null)
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false)
  const [photoError, setPhotoError]         = useState('')

  // Ensure photo matching result is always initialized for the participant table
  useEffect(() => {
    const records = rawRows.length > 0 ? rawRows : allParsedRows
    if (records.length > 0 && !matchResult) {
      runPhotoMatching(records, uploadedImages)
    }
  }, [rawRows.length, allParsedRows.length, uploadedImages.length])

  // UI / Preview state
  const [previewIdx, setPreviewIdx]         = useState(0)
  const [statusFilter, setStatusFilter]     = useState<string>('all')
  const [searchQuery, setSearchQuery]       = useState('')
  const [modalParticipant, setModalParticipant] = useState<{ name: string; id: string; rowIndex: number; currentPhoto?: string } | null>(null)
  const [confirmedSuccess, setConfirmedSuccess] = useState(false)

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

  function processImportedRows(data: Record<string, string>[], cols: string[]) {
    const suggested = suggestMapping(cols)
    setRawColumns(cols)
    setColumnMap(suggested.map)
    setIdentifierCol(suggested.idCol)
    setFilenameCol(suggested.fnCol)
    setCsvError('')
    setMatchResult(null)
    setConfirmedSuccess(false)
    setAllParsedRows(data)

    const countToUse = expectedParticipantCount || targetCount || 5
    if (data.length > countToUse) {
      setTargetCount(countToUse)
      setRawRows(data.slice(0, countToUse))
    } else {
      setTargetCount(data.length)
      setRawRows(data)
    }
  }

  function handleTargetCountChange(newCount: number) {
    const valid = Math.max(1, Math.min(newCount, allParsedRows.length || 1000))
    setTargetCount(valid)
    if (allParsedRows.length > 0) {
      const sliced = allParsedRows.slice(0, valid)
      setRawRows(sliced)
      setPreviewIdx(0)
      setConfirmedSuccess(false)
      if (uploadedImages.length > 0) {
        runPhotoMatching(sliced, uploadedImages)
      }
    }
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
    processImportedRows(result.data, cols)
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
            processImportedRows(arr, cols)
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
      let combinedImages: UploadedImage[] = []
      setUploadedImages(prev => {
        // Deduplicate by filename
        const existingNames = new Set(prev.map(i => i.normalizedName))
        const newImages = res.images.filter(i => !existingNames.has(i.normalizedName))
        combinedImages = [...prev, ...newImages]
        return combinedImages
      })
      if (res.invalidFiles.length > 0) {
        setInvalidFiles(prev => [...prev, ...res.invalidFiles])
      }

      // Automatically trigger photo matching immediately
      const recordsToMatch = rawRows.length > 0 ? rawRows : allParsedRows
      if (recordsToMatch.length > 0) {
        runPhotoMatching(recordsToMatch, combinedImages)
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
      let combinedImages: UploadedImage[] = []
      setUploadedImages(prev => {
        const existingNames = new Set(prev.map(i => i.normalizedName))
        const newImages = res.images.filter(i => !existingNames.has(i.normalizedName))
        combinedImages = [...prev, ...newImages]
        return combinedImages
      })
      if (res.invalidFiles.length > 0) {
        setInvalidFiles(prev => [...prev, ...res.invalidFiles])
      }

      // Automatically trigger photo matching immediately
      const recordsToMatch = rawRows.length > 0 ? rawRows : allParsedRows
      if (recordsToMatch.length > 0) {
        runPhotoMatching(recordsToMatch, combinedImages)
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
    const recordsToMatch = currentRecords.length > 0 ? currentRecords : (allParsedRows.length > 0 ? allParsedRows : rawRows)
    if (recordsToMatch.length === 0) {
      setCsvError('Please import participant data first before matching photos.')
      return
    }

    const inverseMap: Record<string, string> = {}
    for (const [col, field] of Object.entries(columnMap)) {
      inverseMap[field] = col
    }
    const resolvedIdCol = identifierCol || inverseMap.id || rawColumns.find(c => /^(?:id|participant\s*id|roll\s*no|uid|student\s*id)$/i.test(c.trim()))

    const res = matchPhotosToParticipants(recordsToMatch, imagesToUse, {
      identifierColumn: resolvedIdCol || undefined,
      filenameColumn: filenameCol || undefined,
      matchingMethod,
      allowDuplicateImageUsage: allowDuplicateImages,
      fallbackToId: true,
    })

    setMatchResult(res)
    setConfirmedSuccess(false)

    // Sync matched photos to people state
    if (people.length > 0 && res.matches) {
      const matchMap = new Map<number, string>()
      for (const m of res.matches) {
        if (m.assignedImage?.dataUrl) {
          matchMap.set(m.rowIndex, m.assignedImage.dataUrl)
        }
      }
      const updatedPeople = people.map((p, idx) => ({
        ...p,
        photoUrl: matchMap.get(idx) ?? p.photoUrl ?? '',
      }))
      setPeople(updatedPeople)
    }
  }

  // ── Apply Mappings and Build Base Rows ────────────────────────────────────
  function applyMapping(andNavigateToExport = false) {
    try {
      const inverseMap: Record<string, string> = {}
      for (const [col, field] of Object.entries(columnMap)) {
        inverseMap[field] = col
      }

      // Robust column resolution with fallbacks
      const nameCol =
        inverseMap.name ||
        rawColumns.find(c => /^name$/i.test(c.trim())) ||
        rawColumns.find(c => /name/i.test(c.trim())) ||
        identifierCol ||
        rawColumns[0] ||
        'name'

      const effectiveIdCol =
        identifierCol ||
        inverseMap.id ||
        rawColumns.find(c => /^(?:id|roll\s*no|uid|student\s*id)$/i.test(c.trim())) ||
        nameCol ||
        'id'

      const effectiveCount = expectedParticipantCount || (targetCount > 0 ? targetCount : null)
      const baseRows = rawRows.length > 0 ? rawRows : allParsedRows
      const targetRows = (effectiveCount && effectiveCount > 0 && baseRows.length > effectiveCount)
        ? baseRows.slice(0, effectiveCount)
        : baseRows

      // Pre-compute photo match map if images were uploaded
      let currentMatchMap = new Map<number, UploadedImage>()
      if (matchResult?.matches && Array.isArray(matchResult.matches)) {
        for (const m of matchResult.matches) {
          if (m.assignedImage?.dataUrl) {
            currentMatchMap.set(m.rowIndex, m.assignedImage)
          }
        }
      }

      // If no CSV rows but participants exist in store, preserve them and update assigned photos
      if (targetRows.length === 0 && people.length > 0) {
        const updatedPeople = people.map((p, idx) => {
          const matchedImage = currentMatchMap.get(idx)
          const photoUrl = matchedImage?.dataUrl || p.photoUrl || ''
          return { ...p, photoUrl }
        })
        setPeople(updatedPeople)
        setWizardStep(5)
        setConfirmedSuccess(true)
        try {
          useProjectStore.getState().saveProject().catch(console.error)
        } catch {}
        if (andNavigateToExport) {
          try {
            navigate('/studio/export')
          } catch {
            window.location.href = '/studio/export'
          }
        }
        return
      }

      // If matches haven't been run yet but images are uploaded, run photo matcher now
      if (currentMatchMap.size === 0 && uploadedImages.length > 0 && targetRows.length > 0) {
        try {
          const freshRes = matchPhotosToParticipants(targetRows, uploadedImages, {
            identifierColumn: identifierCol || effectiveIdCol || undefined,
            filenameColumn: filenameCol || undefined,
            matchingMethod,
            allowDuplicateImageUsage: allowDuplicateImages,
            fallbackToId: true,
          })
          setMatchResult(freshRes)
          if (freshRes.matches) {
            for (const m of freshRes.matches) {
              if (m.assignedImage?.dataUrl) {
                currentMatchMap.set(m.rowIndex, m.assignedImage)
              }
            }
          }
        } catch (matchErr) {
          console.warn('Auto match execution notice:', matchErr)
        }
      }

      const statuses: PersonRowStatus[] = targetRows.map((row, idx) => {
        const errors: string[] = []
        const warnings: string[] = []

        const name = String(row[nameCol] ?? row['name'] ?? row['Name'] ?? `Participant ${idx + 1}`).trim()
        const rawRole = String(row[inverseMap.role] ?? row['role'] ?? row['Role'] ?? 'participant').trim().toLowerCase()
        const role = roles.some(r => r.id === rawRole) ? rawRole : 'participant'
        const id = String((effectiveIdCol ? row[effectiveIdCol] : (row[inverseMap.id] ?? row['id'] ?? '')) || nanoid(8)).trim()

        if (!name) errors.push('Missing participant name')

        const extra: Record<string, string> = {}
        for (const col of rawColumns) {
          if (!Object.values(inverseMap).includes(col) && col !== effectiveIdCol) {
            extra[col] = String(row[col] ?? '')
          }
        }

        // Matched photo from matching engine, or existing person photoUrl, or explicit photoUrl column in CSV
        const matchedImage = currentMatchMap.get(idx)
        const matchedPhotoUrl = matchedImage?.dataUrl || people[idx]?.photoUrl || (inverseMap.photoUrl ? String(row[inverseMap.photoUrl] ?? '') : undefined)

        const website = inverseMap.website && row[inverseMap.website]
          ? String(row[inverseMap.website]).trim()
          : (row['website'] || row['url'] || row['link'] || people[idx]?.website || batchWebsiteInput || undefined)

        const person: Person = {
          id: id || `P-${idx + 1}`,
          name: name || `Participant ${idx + 1}`,
          role,
          email: inverseMap.email && row[inverseMap.email] ? String(row[inverseMap.email]) : undefined,
          team: inverseMap.team ? String(row[inverseMap.team] ?? '') : String(row['college'] ?? row['team'] ?? ''),
          photoUrl: matchedPhotoUrl,
          website: website ? String(website).trim() : undefined,
          extra,
        }

        return { person, errors, warnings, rowIndex: idx }
      })

      const confirmedPeople = statuses.map(s => s.person)
      setRowStatuses(statuses)
      setPeople(confirmedPeople)
      setWizardStep(5)
      setCsvError('')
      setConfirmedSuccess(true)

      try {
        useProjectStore.getState().saveProject().catch(console.error)
      } catch {}

      if (andNavigateToExport) {
        setWizardStep(5)
        try {
          navigate('/studio/export')
        } catch {
          window.location.href = '/studio/export'
        }
      }
    } catch (err: any) {
      console.error('applyMapping error:', err)
      if (andNavigateToExport) {
        setWizardStep(5)
        try {
          navigate('/studio/export')
        } catch {
          window.location.href = '/studio/export'
        }
      }
    }
  }

  // ── Manual Assignment Handlers ───────────────────────────────────────────
  function handleManualSelectImage(selectedImage: UploadedImage | null) {
    if (!modalParticipant) return
    const targetIdx = modalParticipant.rowIndex

    if (!matchResult) {
      if (people.length > 0) {
        const updated = people.map((p, idx) =>
          idx === targetIdx
            ? { ...p, photoUrl: selectedImage?.dataUrl || '' }
            : p
        )
        setPeople(updated)
      } else {
        setPeople([{
          id: modalParticipant.id || 'P001',
          name: modalParticipant.name || 'Participant Name',
          role: 'participant',
          team: 'Team Alpha',
          photoUrl: selectedImage?.dataUrl || '',
          extra: {},
        }])
      }
      return
    }

    const updated = applyManualAssignment(
      matchResult.matches,
      uploadedImages,
      targetIdx,
      selectedImage
    )
    setMatchResult(updated)

    if (people.length > targetIdx) {
      const updatedPeople = people.map((p, idx) =>
        idx === targetIdx
          ? { ...p, photoUrl: selectedImage?.dataUrl || '' }
          : p
      )
      setPeople(updatedPeople)
    }
    setConfirmedSuccess(false)
  }

  function handleAssignUnmatchedImage(img: UploadedImage, targetRowIndex = previewIdx) {
    if (matchResult && matchResult.matches[targetRowIndex]) {
      const updated = applyManualAssignment(
        matchResult.matches,
        uploadedImages,
        targetRowIndex,
        img
      )
      setMatchResult(updated)
    }
    if (people.length > targetRowIndex) {
      const updatedPeople = people.map((p, idx) =>
        idx === targetRowIndex ? { ...p, photoUrl: img.dataUrl } : p
      )
      setPeople(updatedPeople)
    }
    setConfirmedSuccess(false)
  }

  function handleRemovePhoto(idx: number) {
    if (people.length > 0) {
      const updated = people.map((p, i) => i === idx ? { ...p, photoUrl: '' } : p)
      setPeople(updated)
    }
    if (matchResult && matchResult.matches[idx]) {
      const updatedMatches = matchResult.matches.map((m, i) =>
        i === idx ? { ...m, assignedImage: undefined, status: 'missing_photo' as MatchStatus } : m
      )
      setMatchResult({
        ...matchResult,
        matches: updatedMatches,
        counts: {
          ...matchResult.counts,
          matched: Math.max(0, matchResult.counts.matched - 1),
          missingPhoto: matchResult.counts.missingPhoto + 1,
        },
      })
    }
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
    applyMapping(false)
    return people
  }

  function handleGoToExport() {
    applyMapping(true)
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

      const website = (row[inverseMap.website] || row['website'] || row['url'] || row['link'] || batchWebsiteInput || '').trim()

      return {
        id: activeMatch.identifier || 'ID-042',
        name: (row[inverseMap.name] ?? 'Participant Name').trim(),
        role: (row[inverseMap.role] ?? 'participant').toLowerCase(),
        team: row[inverseMap.team] ?? '',
        photoUrl: activeMatch.assignedImage?.dataUrl || '',
        website: website || undefined,
        extra: {},
      }
    }
    return {
      id: 'P001',
      name: 'Participant Name',
      role: 'participant',
      team: 'Team Alpha',
      photoUrl: '',
      website: batchWebsiteInput.trim() || undefined,
      extra: {},
    }
  }, [people, activeMatch, previewIdx, columnMap, batchWebsiteInput])

  function handleUpdatePersonWebsite(idx: number, url: string) {
    const trimmed = url.trim()
    if (people.length > idx) {
      const updated = people.map((p, i) =>
        i === idx ? { ...p, website: trimmed || undefined } : p
      )
      setPeople(updated)
    } else {
      const base = people[idx] || previewPerson
      const updatedPerson: Person = { ...base, website: trimmed || undefined }
      const newPeople = [...people]
      newPeople[idx] = updatedPerson
      setPeople(newPeople)
    }

    if (rawRows.length > idx) {
      const updatedRows = [...rawRows]
      updatedRows[idx] = { ...updatedRows[idx], website: url }
      setRawRows(updatedRows)
    }
    if (allParsedRows.length > idx) {
      const updatedAll = [...allParsedRows]
      updatedAll[idx] = { ...updatedAll[idx], website: url }
      setAllParsedRows(updatedAll)
    }
    if (matchResult && matchResult.matches && matchResult.matches[idx]) {
      const updatedMatches = [...matchResult.matches]
      updatedMatches[idx] = {
        ...updatedMatches[idx],
        record: { ...updatedMatches[idx].record, website: url },
      }
      setMatchResult({
        ...matchResult,
        matches: updatedMatches,
      })
    }
  }

  function handleBatchApplyWebsite(url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    if (people.length > 0) {
      const updated = people.map(p => ({ ...p, website: trimmed }))
      setPeople(updated)
    }
    if (rawRows.length > 0) {
      const updated = rawRows.map(r => ({ ...r, website: trimmed }))
      setRawRows(updated)
    }
    if (allParsedRows.length > 0) {
      const updated = allParsedRows.map(r => ({ ...r, website: trimmed }))
      setAllParsedRows(updated)
    }
    if (matchResult && matchResult.matches) {
      const updatedMatches = matchResult.matches.map(m => ({
        ...m,
        record: { ...m.record, website: trimmed },
      }))
      setMatchResult({
        ...matchResult,
        matches: updatedMatches,
      })
    }
  }

  return (
    <div className="animate-slide-up pb-12">
      {/* Page Title */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          Step 5 of 6 — Dynamic Participant Data & Bulk Photo Matching
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-normal text-ink">Import Data & Match Photographs</h1>
        <p className="text-text text-sm mt-1">
          Upload any CSV format, drop bulk photos or ZIP archives, and match every participant accurately.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">

          {/* ── SECTION 1: Website Link / QR Code Destination ───────────────── */}
          <div style={{ background: 'linear-gradient(135deg,#0f4c35 0%,#0d3d2c 100%)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🌐</div>
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>1. Event Website / QR Code Link</h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>Paste your event URL — it will be converted to a QR code on every ID card.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                id="batch-website-input"
                type="url"
                placeholder="e.g. https://my-event.com"
                value={batchWebsiteInput}
                onChange={e => setBatchWebsiteInput(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => handleBatchApplyWebsite(batchWebsiteInput)}
                disabled={!batchWebsiteInput.trim()}
                style={{ padding: '10px 18px', borderRadius: '10px', background: batchWebsiteInput.trim() ? '#fff' : 'rgba(255,255,255,0.15)', color: batchWebsiteInput.trim() ? '#0f4c35' : 'rgba(255,255,255,0.4)', border: 'none', fontWeight: 700, fontSize: '13px', cursor: batchWebsiteInput.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}
                title="Apply this website link to all participants"
              >
                🔗 Apply to All
              </button>
            </div>
            {batchWebsiteInput.trim() && (
              <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>✓</span> QR will be generated for: <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{batchWebsiteInput.trim()}</span>
              </p>
            )}
          </div>

          {/* ── SECTION 2: CSV Upload & Dynamic Mapping ───────────────────── */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-display font-semibold text-white flex items-center gap-2">
                <span>📊</span> 2. Import Participant CSV / JSON
              </h2>
              {rawRows.length > 0 && (
                <div className="flex items-center gap-2">
                  {allParsedRows.length > rawRows.length ? (
                    <span className="badge-blue text-xs font-mono">
                      {rawRows.length} of {allParsedRows.length} records selected (Top {targetCount})
                    </span>
                  ) : (
                    <span className="badge-blue text-xs font-mono">{rawRows.length} records parsed</span>
                  )}
                </div>
              )}
            </div>

            {/* Target Participants Control Bar */}
            {allParsedRows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-800/80 border border-white/5 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">👥</span>
                  <div>
                    <span className="text-xs font-semibold text-white">Participants to Import:</span>
                    <span className="text-[11px] text-slate-400 block">
                      {expectedParticipantCount
                        ? `Based on description (${expectedParticipantCount} participants specified)`
                        : `Target count (${targetCount} participants)`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-medium">Count:</span>
                  <input
                    id="target-participant-count-input"
                    type="number"
                    min={1}
                    max={allParsedRows.length || 1000}
                    value={targetCount}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val) && val > 0) {
                        handleTargetCountChange(val)
                      }
                    }}
                    className="input text-xs w-16 py-1 px-2 font-mono text-center font-bold text-white bg-surface-900 border border-acm-500/40 rounded-lg"
                  />
                  <span className="text-xs text-slate-400">of {allParsedRows.length}</span>
                  {allParsedRows.length > targetCount && (
                    <button
                      type="button"
                      onClick={() => handleTargetCountChange(allParsedRows.length)}
                      className="btn-secondary text-[11px] py-1 px-2.5 text-slate-300 hover:text-white"
                    >
                      Use All ({allParsedRows.length})
                    </button>
                  )}
                  {targetCount !== (expectedParticipantCount || 5) && (
                    <button
                      type="button"
                      onClick={() => handleTargetCountChange(expectedParticipantCount || 5)}
                      className="btn-secondary text-[11px] py-1 px-2.5 text-acm-300 hover:text-white"
                    >
                      Reset ({expectedParticipantCount || 5})
                    </button>
                  )}
                </div>
              </div>
            )}

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

            {/* CSV Data Larger Than Participant IDs Notice Banner */}
            {allParsedRows.length > targetCount && (
              <div
                id="csv-size-warning-banner"
                className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs mb-4 space-y-2.5 animate-fade-in"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-100 text-sm">
                      CSV data is larger than participant IDs
                    </p>
                    <p className="text-amber-200/90 leading-relaxed text-xs">
                      Your event description specified <strong className="text-white font-semibold">{targetCount}</strong> participants, but the uploaded CSV contains <strong className="text-white font-semibold">{allParsedRows.length}</strong> records. Considering the top <strong className="text-white font-semibold">{targetCount}</strong> participants from the CSV.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                  <button
                    type="button"
                    id="slice-top-btn"
                    onClick={() => handleTargetCountChange(expectedParticipantCount || 5)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 text-slate-950 shadow-sm"
                  >
                    ✓ Top {targetCount} Only (Active)
                  </button>

                  <button
                    type="button"
                    id="slice-all-btn"
                    onClick={() => handleTargetCountChange(allParsedRows.length)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-amber-200 hover:bg-white/10"
                  >
                    Import All {allParsedRows.length} Records
                  </button>
                </div>
              </div>
            )}

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

                {allParsedRows.length > rawRows.length && (
                  <div className="text-[11px] text-acm-300 flex items-center gap-1.5 pt-1">
                    <span>ℹ</span>
                    <span>Taking first {rawRows.length} of {allParsedRows.length} participants from file as specified in description.</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                  <button
                    id="apply-mapping-btn"
                    type="button"
                    onClick={() => applyMapping(true)}
                    className="btn-primary text-xs py-2.5 px-5 w-full sm:w-auto flex-1 shadow-glow-acm font-semibold flex items-center justify-center gap-2"
                    title="Apply mapping and proceed directly to Export page"
                  >
                    <span>✓ Apply Mapping & Go to Export ({rawRows.length} Participants)</span>
                    <span>→</span>
                  </button>
                  <button
                    id="apply-only-btn"
                    type="button"
                    onClick={() => applyMapping(false)}
                    className="btn-secondary text-xs py-2.5 px-4 w-full sm:w-auto font-medium text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
                    title="Apply mapping and stay on this page to match photos"
                  >
                    <span>Apply Mapping Only</span>
                  </button>
                </div>

                {confirmedSuccess && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{rawRows.length} participants mapped and saved! Ready for export.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleGoToExport}
                      className="btn-primary text-xs py-1.5 px-3.5 shadow-glow-acm font-semibold shrink-0 flex items-center gap-1"
                    >
                      <span>Proceed to Export Page</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
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
                      <th className="text-left py-2 px-3">Website / QR Link</th>
                      <th className="text-left py-2 px-3">Matched File</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-right py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500">
                          No records match this filter
                        </td>
                      </tr>
                    ) : (
                      filteredMatches.map(m => {
                        const isSelected = previewIdx === m.rowIndex
                        const name = (m.record[columnMap[columnMap.name] || 'name'] || m.record.name || 'Participant Name').trim()
                        const role = (m.record.role || 'participant').toLowerCase()
                        const personWebsite = people[m.rowIndex]?.website || m.record.website || m.record.url || m.record.link || ''

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
                            <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="url"
                                placeholder="https://... (QR code link)"
                                value={personWebsite}
                                onChange={e => handleUpdatePersonWebsite(m.rowIndex, e.target.value)}
                                className="input text-[11px] py-1 px-2 w-full min-w-[140px] max-w-[200px] bg-surface-900 border border-white/10 rounded font-mono text-slate-300 placeholder:text-slate-600 focus:border-acm-500"
                                title="Website link for QR Code"
                              />
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
                        onClick={() => handleAssignUnmatchedImage(img, previewIdx)}
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
                    <span>Review assignments above, then save or proceed directly to export.</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    id="confirm-assignments-btn"
                    type="button"
                    onClick={() => handleConfirmAssignments()}
                    className="btn-secondary text-xs py-2 px-3.5 font-medium text-slate-300 hover:text-white flex items-center gap-1.5"
                  >
                    <span>✓</span>
                    <span>Save Assignments Only</span>
                  </button>
                  <button
                    id="confirm-and-export-btn"
                    type="button"
                    onClick={handleGoToExport}
                    className="btn-primary text-xs py-2.5 px-6 shadow-glow-acm font-semibold flex items-center gap-2"
                  >
                    <span>Save & Proceed to Export</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT PANEL: Interactive Card Preview & Wizard Navigation ─────── */}
        <div className="space-y-4">
          {/* Top Quick Navigation to Export */}
          <div className="glass p-3.5 border border-acm-500/30 bg-acm-600/10 rounded-2xl shadow-glow-acm">
            <button
              id="data-next-btn-top"
              type="button"
              onClick={handleGoToExport}
              className="btn-primary w-full py-2.5 shadow-glow-acm text-xs font-semibold flex items-center justify-center gap-2"
            >
              <span>Proceed to Export Page ({rawRows.length || people.length || 1} Cards)</span>
              <span>→</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Instant batch export of all participant ID cards to PDF, SVG, or PNG
            </p>
          </div>

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
                <div className="flex items-center gap-2">
                  {previewPerson.photoUrl && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(previewIdx)}
                      className="btn-ghost text-[11px] py-1 px-2.5 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-500/10"
                    >
                      ✕ Remove
                    </button>
                  )}
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

              {/* Individual Website / QR Code Link Editor for the previewed participant */}
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="participant-website-input" className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>🔗</span> Website Link (QR Code)
                  </label>
                  {previewPerson.website ? (
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Unique QR
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Default QR</span>
                  )}
                </div>
                <input
                  id="participant-website-input"
                  type="url"
                  placeholder="e.g. https://linkedin.com/in/... or https://portfolio.com"
                  value={previewPerson.website || ''}
                  onChange={e => handleUpdatePersonWebsite(previewIdx, e.target.value)}
                  className="input text-xs w-full py-1.5 px-2.5 bg-surface-900 border border-white/10 rounded-lg text-white font-mono placeholder:text-slate-600 focus:border-acm-500"
                />
                <p className="text-[10px] text-slate-400">
                  Unique QR code is automatically generated on the ID card for this link.
                </p>
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
              type="button"
              onClick={handleGoToExport}
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
