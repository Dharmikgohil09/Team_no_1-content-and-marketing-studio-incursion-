import type { UploadedImage } from './photoExtractor'
import { parseFilename } from './photoExtractor'

export type MatchStatus =
  | 'matched'
  | 'missing_photo'
  | 'missing_id'
  | 'duplicate_id'
  | 'ambiguous_match'
  | 'unmatched_image'
  | 'invalid_image'

export interface MatchingOptions {
  identifierColumn?: string            // CSV column holding unique identifier
  filenameColumn?: string              // CSV column holding explicit photo filename
  matchingMethod?: 'auto' | 'filename' | 'identifier' // default 'auto'
  allowDuplicateImageUsage?: boolean   // default false
  fallbackToId?: boolean               // default true (fall back to identifier if filename empty)
}

export interface ParticipantMatch {
  rowIndex: number
  record: Record<string, string>
  identifier: string                   // Value from identifier column or empty
  explicitFilename?: string            // Value from photo filename column if present
  assignedImage?: UploadedImage        // Assigned photo
  status: MatchStatus
  statusReason?: string
  isManualOverride?: boolean
}

export interface MatchSummaryCounts {
  totalRecords: number
  totalImages: number
  matched: number
  missingPhoto: number
  missingId: number
  duplicateId: number
  ambiguous: number
  extraImages: number
  invalidImages: number
}

export interface MatchResult {
  matches: ParticipantMatch[]
  unmatchedImages: UploadedImage[]
  counts: MatchSummaryCounts
  duplicateIdentifiers: string[]
  ambiguousFiles: string[]
  warnings: string[]
  errors: string[]
}

/**
 * Normalizes an identifier or filename for robust, case-insensitive, whitespace-trimmed comparison.
 */
export function normalizeKey(str?: string | null): string {
  if (!str) return ''
  return str.trim().toLowerCase()
}

/**
 * Extracts normalized stem from a filename string.
 */
export function extractStem(filename?: string | null): string {
  if (!filename) return ''
  return parseFilename(filename).stem
}

/**
 * Pure function: Executes the matching engine across records and uploaded images.
 */
export function matchPhotosToParticipants(
  records: Record<string, string>[],
  images: UploadedImage[],
  options: MatchingOptions = {}
): MatchResult {
  const {
    identifierColumn,
    filenameColumn,
    matchingMethod = 'auto',
    allowDuplicateImageUsage = false,
    fallbackToId = true,
  } = options

  const warnings: string[] = []
  const errors: string[] = []

  const validImages = images.filter(img => img.isValid)
  const invalidImages = images.filter(img => !img.isValid)

  if (invalidImages.length > 0) {
    warnings.push(`${invalidImages.length} uploaded image(s) are invalid or unsupported.`)
  }

  // 1. Resolve effective identifier and name columns if not explicitly provided
  let effectiveIdColumn = identifierColumn
  if (!effectiveIdColumn && records.length > 0) {
    const firstRow = records[0]
    effectiveIdColumn = Object.keys(firstRow).find(col =>
      /^(?:id|participant\s*id|roll\s*no|roll\s*number|uid|student\s*id|reg(?:istration)?\s*(?:no|number|id)?|ticket\s*id|code)$/i.test(col.trim())
    )
  }

  let effectiveNameColumn: string | undefined
  if (records.length > 0) {
    const firstRow = records[0]
    effectiveNameColumn = Object.keys(firstRow).find(col =>
      /^(?:name|full\s*name|participant\s*name|student\s*name)$/i.test(col.trim())
    )
  }

  // 2. Build indexes of uploaded images
  // Index by full normalized filename (e.g. "john.png") -> UploadedImage[]
  const filenameIndex = new Map<string, UploadedImage[]>()
  // Index by stem without extension (e.g. "john") -> UploadedImage[]
  const stemIndex = new Map<string, UploadedImage[]>()
  // Index by clean alphanumeric stem (e.g. "p001" for "p-001.jpg") -> UploadedImage[]
  const cleanStemIndex = new Map<string, UploadedImage[]>()
  // Index by tokens in stem separated by delimiter (e.g. "p001" and "aarav" for "p001_aarav.jpg")
  const tokenIndex = new Map<string, UploadedImage[]>()

  for (const img of validImages) {
    // Exact normalized filename
    const fnKey = normalizeKey(img.normalizedName)
    if (!filenameIndex.has(fnKey)) filenameIndex.set(fnKey, [])
    filenameIndex.get(fnKey)!.push(img)

    // Stem
    const stemKey = normalizeKey(img.stem)
    if (!stemIndex.has(stemKey)) stemIndex.set(stemKey, [])
    stemIndex.get(stemKey)!.push(img)

    // Clean alphanumeric stem
    const cleanStem = stemKey.replace(/[^a-z0-9]/g, '')
    if (cleanStem) {
      if (!cleanStemIndex.has(cleanStem)) cleanStemIndex.set(cleanStem, [])
      cleanStemIndex.get(cleanStem)!.push(img)
    }

    // Delimited tokens in stem (e.g., "p001_aarav" -> ["p001", "aarav"])
    const tokens = stemKey.split(/[-_\s.]+/)
    for (const tok of tokens) {
      const cleanTok = tok.replace(/[^a-z0-9]/g, '')
      if (cleanTok.length >= 1) {
        if (!tokenIndex.has(cleanTok)) tokenIndex.set(cleanTok, [])
        if (!tokenIndex.get(cleanTok)!.some(i => i.id === img.id)) {
          tokenIndex.get(cleanTok)!.push(img)
        }
      }
    }
  }

  // Detect ambiguous files among uploaded images (same filename uploaded multiple times or duplicate stems)
  const ambiguousFiles: string[] = []
  for (const [stem, list] of stemIndex.entries()) {
    if (list.length > 1) {
      ambiguousFiles.push(stem)
    }
  }

  // 3. Analyze CSV records for duplicate identifiers
  const idCounts = new Map<string, number>()
  const duplicateIdentifiers: string[] = []

  if (effectiveIdColumn) {
    for (const row of records) {
      const rawId = row[effectiveIdColumn]
      const normId = normalizeKey(rawId)
      if (normId) {
        idCounts.set(normId, (idCounts.get(normId) || 0) + 1)
      }
    }

    for (const [id, count] of idCounts.entries()) {
      if (count > 1) {
        duplicateIdentifiers.push(id)
      }
    }

    if (duplicateIdentifiers.length > 0) {
      warnings.push(`Detected ${duplicateIdentifiers.length} duplicate identifier(s) in CSV column "${effectiveIdColumn}". Duplicate records will be flagged.`)
    }
  }

  // 4. Match records
  const matches: ParticipantMatch[] = []
  const assignedImageIds = new Set<string>()
  const imageAssignmentCounts = new Map<string, number>()

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx]
    const rawId = effectiveIdColumn ? (row[effectiveIdColumn] ?? '').trim() : ''
    const normId = normalizeKey(rawId)
    const cleanId = normId.replace(/[^a-z0-9]/g, '')
    const rawFilename = filenameColumn ? (row[filenameColumn] ?? '').trim() : ''
    const rawName = effectiveNameColumn ? (row[effectiveNameColumn] ?? '').trim() : (row['name'] ?? row['Name'] ?? '').trim()

    // Check duplicate ID
    if (effectiveIdColumn && normId && (idCounts.get(normId) ?? 0) > 1) {
      matches.push({
        rowIndex: idx,
        record: row,
        identifier: rawId,
        explicitFilename: rawFilename || undefined,
        status: 'duplicate_id',
        statusReason: `Duplicate identifier "${rawId}" found in multiple rows`,
      })
      continue
    }

    // Check missing ID if identifier matching is strictly required and no filename is provided
    if (effectiveIdColumn && !normId && (matchingMethod === 'identifier' || (!rawFilename && matchingMethod === 'auto'))) {
      matches.push({
        rowIndex: idx,
        record: row,
        identifier: '',
        explicitFilename: rawFilename || undefined,
        status: 'missing_id',
        statusReason: `Row ${idx + 1} is missing a unique identifier in column "${effectiveIdColumn}"`,
      })
      continue
    }

    let candidateImages: UploadedImage[] = []
    let matchStrategyUsed: 'filename' | 'identifier' | 'name' | null = null

    // Strategy A: Explicit Filename Matching
    if ((matchingMethod === 'filename' || matchingMethod === 'auto') && rawFilename) {
      const parsed = parseFilename(rawFilename)
      const normFilename = parsed.normalizedName
      const fnStem = parsed.stem

      // Try exact filename match first
      if (filenameIndex.has(normFilename)) {
        candidateImages = filenameIndex.get(normFilename)!
        matchStrategyUsed = 'filename'
      } else if (parsed.extension === '' && stemIndex.has(fnStem)) {
        candidateImages = stemIndex.get(fnStem)!
        matchStrategyUsed = 'filename'
      } else {
        // Explicit filename specified in CSV was NOT found among uploaded images
        if (matchingMethod === 'filename' || !fallbackToId || !effectiveIdColumn || !normId) {
          matches.push({
            rowIndex: idx,
            record: row,
            identifier: rawId,
            explicitFilename: rawFilename,
            status: 'missing_photo',
            statusReason: `Specified image file "${rawFilename}" was not found in uploaded images`,
          })
          continue
        }
      }
    }

    // Strategy B: Unique Identifier Matching (Stem, Sanitized Alphanumeric, and Token Matching)
    if (
      candidateImages.length === 0 &&
      (matchingMethod === 'identifier' || (matchingMethod === 'auto' && fallbackToId)) &&
      normId
    ) {
      // 1. Exact stem or filename match (e.g. "p001" === "p001")
      if (stemIndex.has(normId)) {
        candidateImages = stemIndex.get(normId)!
        matchStrategyUsed = 'identifier'
      } else if (filenameIndex.has(normId)) {
        candidateImages = filenameIndex.get(normId)!
        matchStrategyUsed = 'identifier'
      }

      // 2. Clean alphanumeric match (e.g. ID "P-001" matches "p001.jpg" or "P_001.png")
      if (candidateImages.length === 0 && cleanId.length >= 2 && cleanStemIndex.has(cleanId)) {
        candidateImages = cleanStemIndex.get(cleanId)!
        matchStrategyUsed = 'identifier'
      }

      // 3. Delimited token match (e.g. ID "P001" matches "P001_Aarav.jpg" or "student-P001.png")
      if (candidateImages.length === 0 && cleanId.length >= 2 && tokenIndex.has(cleanId)) {
        candidateImages = tokenIndex.get(cleanId)!
        matchStrategyUsed = 'identifier'
      }

      // 4. Numeric token match with leading zeroes removed (e.g. ID "1" or "001" matches "1.jpg" or "001.jpg")
      if (candidateImages.length === 0 && /^\d+$/.test(cleanId)) {
        const numVal = parseInt(cleanId, 10).toString()
        for (const [tok, imgs] of tokenIndex.entries()) {
          if (/^\d+$/.test(tok) && parseInt(tok, 10).toString() === numVal) {
            candidateImages = imgs
            matchStrategyUsed = 'identifier'
            break
          }
        }
      }
    }

    // Strategy C: Participant Name Matching (Fallback in auto mode if ID did not match)
    if (
      candidateImages.length === 0 &&
      matchingMethod === 'auto' &&
      rawName
    ) {
      const normName = normalizeKey(rawName)
      const cleanName = normName.replace(/[^a-z0-9]/g, '')
      if (cleanName.length >= 3) {
        if (cleanStemIndex.has(cleanName)) {
          candidateImages = cleanStemIndex.get(cleanName)!
          matchStrategyUsed = 'name'
        } else if (stemIndex.has(normName)) {
          candidateImages = stemIndex.get(normName)!
          matchStrategyUsed = 'name'
        }
      }
    }

    // Evaluate Candidate Matches
    if (candidateImages.length === 0) {
      matches.push({
        rowIndex: idx,
        record: row,
        identifier: rawId,
        explicitFilename: rawFilename || undefined,
        status: 'missing_photo',
        statusReason: rawFilename
          ? `Image "${rawFilename}" not found`
          : (rawId ? `No image matching identifier "${rawId}"` : 'No matching photograph'),
      })
      continue
    }

    if (candidateImages.length > 1) {
      // Ambiguous: multiple uploaded files matched this single record
      matches.push({
        rowIndex: idx,
        record: row,
        identifier: rawId,
        explicitFilename: rawFilename || undefined,
        status: 'ambiguous_match',
        statusReason: `Ambiguous match: ${candidateImages.length} images match this record (${candidateImages.map(i => i.filename).join(', ')})`,
      })
      continue
    }

    // Exactly one candidate image found
    const selectedImage = candidateImages[0]

    // Check if image is already claimed by another participant
    const currentAssignments = imageAssignmentCounts.get(selectedImage.id) || 0
    if (currentAssignments > 0 && !allowDuplicateImageUsage) {
      matches.push({
        rowIndex: idx,
        record: row,
        identifier: rawId,
        explicitFilename: rawFilename || undefined,
        status: 'ambiguous_match',
        statusReason: `Image "${selectedImage.filename}" is already matched to another participant`,
      })
      continue
    }

    // Successfully matched
    assignedImageIds.add(selectedImage.id)
    imageAssignmentCounts.set(selectedImage.id, currentAssignments + 1)

    matches.push({
      rowIndex: idx,
      record: row,
      identifier: rawId,
      explicitFilename: rawFilename || undefined,
      assignedImage: selectedImage,
      status: 'matched',
      statusReason: matchStrategyUsed === 'filename'
        ? `Matched via filename "${rawFilename}"`
        : (matchStrategyUsed === 'name'
          ? `Matched via participant name "${rawName}"`
          : `Matched via identifier "${rawId}"`),
    })
  }

  // 4. Calculate unmatched (extra) images
  const unmatchedImages = validImages.filter(img => !assignedImageIds.has(img.id))

  // 5. Compute summary statistics
  const counts: MatchSummaryCounts = {
    totalRecords: records.length,
    totalImages: images.length,
    matched: matches.filter(m => m.status === 'matched').length,
    missingPhoto: matches.filter(m => m.status === 'missing_photo').length,
    missingId: matches.filter(m => m.status === 'missing_id').length,
    duplicateId: matches.filter(m => m.status === 'duplicate_id').length,
    ambiguous: matches.filter(m => m.status === 'ambiguous_match').length,
    extraImages: unmatchedImages.length,
    invalidImages: invalidImages.length,
  }

  if (counts.ambiguous > 0) {
    warnings.push(`${counts.ambiguous} record(s) have ambiguous or conflicting image matches. Please review them before continuing.`)
  }
  if (counts.duplicateId > 0) {
    errors.push(`${counts.duplicateId} record(s) share duplicate identifiers. Identifiers must be unique for automated matching.`)
  }

  return {
    matches,
    unmatchedImages,
    counts,
    duplicateIdentifiers,
    ambiguousFiles,
    warnings,
    errors,
  }
}

/**
 * Pure function: Manually assigns an uploaded image to a participant row.
 */
export function applyManualAssignment(
  currentMatches: ParticipantMatch[],
  allImages: UploadedImage[],
  rowIndex: number,
  selectedImage: UploadedImage | null
): MatchResult {
  const updatedMatches = currentMatches.map(m => {
    if (m.rowIndex !== rowIndex) return m

    if (!selectedImage) {
      return {
        ...m,
        assignedImage: undefined,
        status: 'missing_photo' as MatchStatus,
        statusReason: 'Photo removed manually',
        isManualOverride: true,
      }
    }

    return {
      ...m,
      assignedImage: selectedImage,
      status: 'matched' as MatchStatus,
      statusReason: `Manually assigned to "${selectedImage.filename}"`,
      isManualOverride: true,
    }
  })

  // Recompute assigned IDs and unmatched images
  const assignedIds = new Set<string>()
  for (const m of updatedMatches) {
    if (m.assignedImage) assignedIds.add(m.assignedImage.id)
  }

  const validImages = allImages.filter(i => i.isValid)
  const invalidImages = allImages.filter(i => !i.isValid)
  const unmatchedImages = validImages.filter(i => !assignedIds.has(i.id))

  const counts: MatchSummaryCounts = {
    totalRecords: updatedMatches.length,
    totalImages: allImages.length,
    matched: updatedMatches.filter(m => m.status === 'matched').length,
    missingPhoto: updatedMatches.filter(m => m.status === 'missing_photo').length,
    missingId: updatedMatches.filter(m => m.status === 'missing_id').length,
    duplicateId: updatedMatches.filter(m => m.status === 'duplicate_id').length,
    ambiguous: updatedMatches.filter(m => m.status === 'ambiguous_match').length,
    extraImages: unmatchedImages.length,
    invalidImages: invalidImages.length,
  }

  return {
    matches: updatedMatches,
    unmatchedImages,
    counts,
    duplicateIdentifiers: [],
    ambiguousFiles: [],
    warnings: [],
    errors: [],
  }
}
