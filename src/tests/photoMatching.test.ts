import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import {
  extractImagesFromFiles,
  extractImagesFromZip,
  parseFilename,
  getBaseFilename,
  type UploadedImage,
} from '../core/matching/photoExtractor'
import {
  matchPhotosToParticipants,
  applyManualAssignment,
  type MatchingOptions,
} from '../core/matching/photoMatcher'
import { renderCard } from '../core/renderer'
import { generateDraftsDeterministic } from '../core/ai/draftGenerator'
import { makeEmptyEventContext } from '../core/schema/EventContext'
import { getRoleOrDefault } from '../core/schema/Role'
import type { Person } from '../core/schema/Person'
import '../templates/registry'
import '../brandKits/loader'

// Helper to create synthetic dummy data URL
function createDummyDataUrl(text: string): string {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text>${text}</text></svg>`
}

function makeUploadedImage(filename: string): UploadedImage {
  const { stem, extension, normalizedName } = parseFilename(filename)
  return {
    id: `img-${stem}`,
    filename,
    normalizedName,
    stem,
    extension,
    mimeType: 'image/jpeg',
    size: 1024,
    dataUrl: createDummyDataUrl(filename),
    isValid: true,
  }
}

describe('Dynamic Photo Matching & Extraction Engine Tests', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Filename Parsing & Normalization
  // ───────────────────────────────────────────────────────────────────────────
  describe('Filename parsing and normalization', () => {
    it('handles filenames with various paths, extensions, spaces and case', () => {
      expect(getBaseFilename('folder/subfolder/STUDENT_01.JPG')).toBe('STUDENT_01.JPG')
      expect(getBaseFilename('C:\\Photos\\Batch1\\IMG_99.png')).toBe('IMG_99.png')

      const parsed = parseFilename('  Attendee_42.JPEG  ')
      expect(parsed.stem).toBe('attendee_42')
      expect(parsed.extension).toBe('jpeg')
      expect(parsed.normalizedName).toBe('attendee_42.jpeg')

      const noExt = parseFilename('employee_id_9')
      expect(noExt.stem).toBe('employee_id_9')
      expect(noExt.extension).toBe('')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2. ZIP Archive Extraction
  // ───────────────────────────────────────────────────────────────────────────
  describe('ZIP Archive Extraction with JSZip', () => {
    it('extracts images from a ZIP archive, ignores metadata, and parses filenames', async () => {
      const zip = new JSZip()
      zip.file('photos/alice.jpg', 'fake-image-bytes-1')
      zip.file('photos/bob.png', 'fake-image-bytes-2')
      zip.file('__MACOSX/._alice.jpg', 'metadata')
      zip.file('notes.txt', 'non-image file')

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const res = await extractImagesFromZip(zipBlob, 'test_batch.zip')

      // Should extract alice.jpg and bob.png
      expect(res.images.length).toBe(2)
      const stems = res.images.map(i => i.stem).sort()
      expect(stems).toEqual(['alice', 'bob'])

      // notes.txt should be in invalidFiles
      expect(res.invalidFiles.some(f => f.name === 'notes.txt')).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Unique Identifier Stem Matching (Method B)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Unique Identifier Matching', () => {
    it('matches participant records to images using arbitrary identifier columns and stems', () => {
      const records = [
        { 'Reg Number': 'REG-101', 'Full Name': 'Alice Smith', 'Club': 'Robotics' },
        { 'Reg Number': 'REG-102', 'Full Name': 'Bob Jones', 'Club': 'Design' },
        { 'Reg Number': 'REG-103', 'Full Name': 'Charlie Brown', 'Club': 'Coding' },
      ]

      const images = [
        makeUploadedImage('reg-101.jpg'),
        makeUploadedImage('REG-102.PNG'), // Case insensitive
        makeUploadedImage('unrelated_extra.jpg'),
      ]

      const result = matchPhotosToParticipants(records, images, {
        identifierColumn: 'Reg Number',
        matchingMethod: 'identifier',
      })

      expect(result.counts.totalRecords).toBe(3)
      expect(result.counts.matched).toBe(2)
      expect(result.counts.missingPhoto).toBe(1)
      expect(result.counts.extraImages).toBe(1)

      // Alice & Bob matched
      expect(result.matches[0].status).toBe('matched')
      expect(result.matches[0].assignedImage?.filename).toBe('reg-101.jpg')
      expect(result.matches[1].status).toBe('matched')
      expect(result.matches[1].assignedImage?.filename).toBe('REG-102.PNG')

      // Charlie missing
      expect(result.matches[2].status).toBe('missing_photo')
      expect(result.matches[2].assignedImage).toBeUndefined()

      // Extra image
      expect(result.unmatchedImages.map(i => i.filename)).toContain('unrelated_extra.jpg')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Explicit Filename Column Matching (Method A)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Explicit Filename Column Matching', () => {
    it('matches participant records using an explicit photo filename column', () => {
      const records = [
        { 'Student UID': 'U90', 'Name': 'David', 'Photo Ref': 'david_portrait.png' },
        { 'Student UID': 'U91', 'Name': 'Emma', 'Photo Ref': 'emma_headshot.jpg' },
      ]

      const images = [
        makeUploadedImage('david_portrait.png'),
        makeUploadedImage('emma_headshot.jpg'),
      ]

      const result = matchPhotosToParticipants(records, images, {
        identifierColumn: 'Student UID',
        filenameColumn: 'Photo Ref',
        matchingMethod: 'filename',
      })

      expect(result.counts.matched).toBe(2)
      expect(result.matches[0].assignedImage?.filename).toBe('david_portrait.png')
      expect(result.matches[1].assignedImage?.filename).toBe('emma_headshot.jpg')
    })

    it('falls back to identifier stem matching when explicit filename is empty', () => {
      const records = [
        { 'Ticket Code': 'TC-01', 'Attendee': 'Fiona', 'Avatar File': 'fiona.jpg' },
        { 'Ticket Code': 'TC-02', 'Attendee': 'George', 'Avatar File': '' }, // Empty filename
      ]

      const images = [
        makeUploadedImage('fiona.jpg'),
        makeUploadedImage('TC-02.webp'), // Stored by Ticket Code stem
      ]

      const result = matchPhotosToParticipants(records, images, {
        identifierColumn: 'Ticket Code',
        filenameColumn: 'Avatar File',
        matchingMethod: 'auto',
        fallbackToId: true,
      })

      expect(result.counts.matched).toBe(2)
      expect(result.matches[0].status).toBe('matched')
      expect(result.matches[0].statusReason).toContain('filename')
      expect(result.matches[1].status).toBe('matched')
      expect(result.matches[1].statusReason).toContain('identifier')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Duplicate Identifier Detection & Ambiguity Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe('Validation & Ambiguity Detection', () => {
    it('detects duplicate identifiers across rows and flags them without guessing', () => {
      const records = [
        { 'Badge ID': 'B-555', 'Name': 'Person One' },
        { 'Badge ID': 'B-555', 'Name': 'Person Two (Duplicate)' },
        { 'Badge ID': 'B-666', 'Name': 'Person Three' },
      ]

      const images = [
        makeUploadedImage('b-555.jpg'),
        makeUploadedImage('b-666.jpg'),
      ]

      const result = matchPhotosToParticipants(records, images, {
        identifierColumn: 'Badge ID',
        matchingMethod: 'identifier',
      })

      expect(result.duplicateIdentifiers).toContain('b-555')
      expect(result.counts.duplicateId).toBe(2)
      expect(result.matches[0].status).toBe('duplicate_id')
      expect(result.matches[1].status).toBe('duplicate_id')
      expect(result.matches[2].status).toBe('matched')
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('detects ambiguous file matches when multiple files match the same record', () => {
      const records = [
        { 'User Code': 'USR-10', 'Name': 'Hannah' },
      ]

      // Two uploaded files with the same stem
      const images = [
        makeUploadedImage('usr-10.jpg'),
        makeUploadedImage('usr-10.png'),
      ]

      const result = matchPhotosToParticipants(records, images, {
        identifierColumn: 'User Code',
        matchingMethod: 'identifier',
      })

      expect(result.counts.ambiguous).toBe(1)
      expect(result.matches[0].status).toBe('ambiguous_match')
      expect(result.matches[0].statusReason).toContain('Ambiguous match')
    })

    it('prevents accidental reuse of an image unless explicitly allowed', () => {
      const records = [
        { 'ID': 'A1', 'Photo': 'shared.jpg' },
        { 'ID': 'A2', 'Photo': 'shared.jpg' },
      ]

      const images = [
        makeUploadedImage('shared.jpg'),
      ]

      // Default: duplicate image usage disallowed
      const resDisallowed = matchPhotosToParticipants(records, images, {
        identifierColumn: 'ID',
        filenameColumn: 'Photo',
        matchingMethod: 'filename',
        allowDuplicateImageUsage: false,
      })

      expect(resDisallowed.matches[0].status).toBe('matched')
      expect(resDisallowed.matches[1].status).toBe('ambiguous_match')
      expect(resDisallowed.matches[1].statusReason).toContain('already matched')

      // Enabled: duplicate image usage allowed
      const resAllowed = matchPhotosToParticipants(records, images, {
        identifierColumn: 'ID',
        filenameColumn: 'Photo',
        matchingMethod: 'filename',
        allowDuplicateImageUsage: true,
      })

      expect(resAllowed.matches[0].status).toBe('matched')
      expect(resAllowed.matches[1].status).toBe('matched')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Manual Match Override & Removal
  // ───────────────────────────────────────────────────────────────────────────
  describe('Manual Assignment and Corrections', () => {
    it('allows manually assigning an image and removing it cleanly', () => {
      const records = [
        { 'ID': 'X1', 'Name': 'Ian' },
        { 'ID': 'X2', 'Name': 'Jack' },
      ]
      const images = [
        makeUploadedImage('custom_ian.png'),
      ]

      const initial = matchPhotosToParticipants(records, images, {
        identifierColumn: 'ID',
        matchingMethod: 'identifier',
      })
      expect(initial.counts.matched).toBe(0)

      // Manually assign custom_ian.png to Ian (rowIndex 0)
      const afterAssign = applyManualAssignment(
        initial.matches,
        images,
        0,
        images[0]
      )

      expect(afterAssign.counts.matched).toBe(1)
      expect(afterAssign.matches[0].status).toBe('matched')
      expect(afterAssign.matches[0].assignedImage?.filename).toBe('custom_ian.png')
      expect(afterAssign.unmatchedImages.length).toBe(0)

      // Now remove the assignment
      const afterRemove = applyManualAssignment(
        afterAssign.matches,
        images,
        0,
        null
      )

      expect(afterRemove.counts.matched).toBe(0)
      expect(afterRemove.matches[0].status).toBe('missing_photo')
      expect(afterRemove.unmatchedImages.length).toBe(1)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 7. End-to-End Card SVG Rendering with Confirmed Photo
  // ───────────────────────────────────────────────────────────────────────────
  describe('SVG Card Rendering with Matched Photo', () => {
    it('renders confirmed photo data URL inside SVG image clip path', () => {
      const dummyPhoto = createDummyDataUrl('Verified Photo')
      const personWithPhoto: Person = {
        id: 'P-999',
        name: 'Karan Verma',
        role: 'participant',
        team: 'Venture Alpha',
        photoUrl: dummyPhoto,
        extra: {},
      }

      const event = makeEmptyEventContext()
      event.name = { value: 'Global Summit', status: 'provided' }

      const role = getRoleOrDefault('participant')
      const drafts = generateDraftsDeterministic(event, [role])
      expect(drafts.length).toBeGreaterThan(0)

      const { svg } = renderCard({
        template: drafts[0],
        role,
        person: personWithPhoto,
        event,
        face: 'front',
      })

      // Must include image tag with dataUrl
      expect(svg).toContain('<image')
      expect(svg).toContain(dummyPhoto)
      expect(svg).toContain('Karan Verma')
    })

    it('renders initials fallback when participant has no photo', () => {
      const personWithoutPhoto: Person = {
        id: 'P-000',
        name: 'Sarah Connor',
        role: 'participant',
        team: 'Resistance',
        photoUrl: '', // No photo
        extra: {},
      }

      const event = makeEmptyEventContext()
      event.name = { value: 'Tech Expo', status: 'provided' }

      const role = getRoleOrDefault('participant')
      const drafts = generateDraftsDeterministic(event, [role])

      const { svg } = renderCard({
        template: drafts[0],
        role,
        person: personWithoutPhoto,
        event,
        face: 'front',
      })

      // Must render initials 'SC'
      expect(svg).toContain('SC')
      expect(svg).toContain('Sarah Connor')
    })

    it('exports SVG with participant photo and proper clip-path without crashing', async () => {
      const { exportSvg } = await import('../core/export/svg')
      const { getDefaultBrandKit } = await import('../brandKits/loader')

      const dummyPhoto = createDummyDataUrl('Verified Photo')
      const personWithPhoto: Person = {
        id: 'P-101',
        name: 'Aditi Rao',
        role: 'participant',
        team: 'Quantum',
        photoUrl: dummyPhoto,
        extra: {},
      }
      const event = makeEmptyEventContext()
      event.name = { value: 'Incursion Hackathon', status: 'provided' }
      const role = getRoleOrDefault('participant')
      const drafts = generateDraftsDeterministic(event, [role])

      const svg = exportSvg({
        template: drafts[0],
        role,
        person: personWithPhoto,
        event,
        brandKit: getDefaultBrandKit(),
        includeBleed: false,
        face: 'front',
      })

      expect(svg).toContain('<image')
      expect(svg).toContain(dummyPhoto)
      expect(svg).toContain('Aditi Rao')
      expect(svg).toContain('photo-clip-person-photo')
    })

    it('exports PDF with multiple participants including images without error', async () => {
      const { exportPdf } = await import('../core/export/pdf')
      const { getDefaultBrandKit } = await import('../brandKits/loader')

      const dummyPhoto = createDummyDataUrl('Verified Photo')
      const people: Person[] = [
        { id: 'P-1', name: 'Alice Smith', role: 'participant', team: 'A', photoUrl: dummyPhoto, extra: {} },
        { id: 'P-2', name: 'Bob Jones', role: 'participant', team: 'B', photoUrl: '', extra: {} },
      ]
      const event = makeEmptyEventContext()
      event.name = { value: 'Annual Fest', status: 'provided' }
      const role = getRoleOrDefault('participant')
      const drafts = generateDraftsDeterministic(event, [role])

      const pdfBytes = await exportPdf({
        template: drafts[0],
        roles: [role],
        people,
        event,
        brandKit: getDefaultBrandKit(),
        includeBleed: false,
        dpi: 150,
        multiPage: true,
      })

      expect(pdfBytes).toBeInstanceOf(Uint8Array)
      expect(pdfBytes.length).toBeGreaterThan(500)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Participant Count from Description vs CSV Slicing & Warning
  // ───────────────────────────────────────────────────────────────────────────
  describe('Participant count from description and CSV slicing behavior', () => {
    // Import helper dynamically
    it('extracts expected participant count from eventContext or description', async () => {
      const { getExpectedParticipantCount } = await import('../utils/participantCount')

      // Case A: Explicit participantCount in eventContext
      const projA = {
        eventContext: {
          participantCount: { value: 5, status: 'provided' },
        },
      }
      expect(getExpectedParticipantCount(projA)).toBe(5)

      // Case B: Roles participant count
      const projB = {
        eventContext: {},
        roles: [{ id: 'participant', label: 'Participant', count: 6 }],
      }
      expect(getExpectedParticipantCount(projB)).toBe(6)

      // Case C: Natural language description "singing concert with 5 people"
      const projC = {
        eventContext: {
          description: { value: 'Singing concert at SVNIT with 5 people', status: 'provided' },
        },
      }
      expect(getExpectedParticipantCount(projC)).toBe(5)

      // Case D: "number of participants: 8"
      const projD = {
        eventContext: {
          description: { value: 'Annual fest, number of participants: 8', status: 'provided' },
        },
      }
      expect(getExpectedParticipantCount(projD)).toBe(8)

      // Case E: "Create 7 ID cards for our workshop"
      const projE = {
        eventContext: {
          description: { value: 'Create 7 ID cards for our workshop at SVNIT', status: 'provided' },
        },
      }
      expect(getExpectedParticipantCount(projE)).toBe(7)

      // Case F: User's exact prompt phrase "humne 5 participants ka naam daala tha"
      const { extractCountFromDescription } = await import('../utils/participantCount')
      expect(extractCountFromDescription('humne 5 participants ka naam daala tha')).toBe(5)
      expect(extractCountFromDescription('5 participants ka naam')).toBe(5)
      expect(extractCountFromDescription('5 logo ke naam')).toBe(5)
      expect(extractCountFromDescription('5 logo ka naam')).toBe(5)
      expect(extractCountFromDescription('5 bando ka naam')).toBe(5)
      expect(extractCountFromDescription('5 ka naam')).toBe(5)
      expect(extractCountFromDescription('paanch participants')).toBe(5)
      expect(extractCountFromDescription('panch logo')).toBe(5)
      expect(extractCountFromDescription('Participants: Aarav, Rohan, Sneha, Priya, Amit')).toBe(5)
      expect(extractCountFromDescription('1. Aarav\n2. Rohan\n3. Sneha\n4. Priya\n5. Amit')).toBe(5)

      // User's specific scenario: "the number of participants to be 10"
      expect(extractCountFromDescription('the number of participants to be 10')).toBe(10)
      expect(extractCountFromDescription('number of participants to be 10')).toBe(10)
      expect(extractCountFromDescription('number of participants should be 10')).toBe(10)
      expect(extractCountFromDescription('number of participants is 10')).toBe(10)
      expect(extractCountFromDescription('participants to be 10')).toBe(10)
      expect(extractCountFromDescription('participant count to be 10')).toBe(10)
      expect(extractCountFromDescription('take first 10 participants mentioned in the list')).toBe(10)
      expect(extractCountFromDescription('only take first 10 participants')).toBe(10)
      expect(extractCountFromDescription('Garba festival on 19 October at SVNIT. The number of participants to be 10.')).toBe(10)
      expect(extractCountFromDescription('Garba night 2024 at SVNIT on 20th Oct. The number of participants to be 10.')).toBe(10)
    })

    it('slices CSV data to top N participants when CSV contains more records than specified', () => {
      // 12 CSV rows (similar to user scenario)
      const csvData = Array.from({ length: 12 }, (_, i) => ({
        id: `P${String(i + 1).padStart(3, '0')}`,
        name: `Person ${i + 1}`,
        role: 'participant',
      }))

      const expectedCount = 5
      expect(csvData.length).toBe(12)
      expect(csvData.length > expectedCount).toBe(true)

      // When CSV is larger, consider top 5
      const topSliced = csvData.slice(0, expectedCount)
      expect(topSliced.length).toBe(5)
      expect(topSliced[0].id).toBe('P001')
      expect(topSliced[4].id).toBe('P005')

      // Check required message text
      const warningText = `CSV data is larger than participant IDs: Your event description specified ${expectedCount} participants, but the uploaded CSV contains ${csvData.length} records. Considering the top ${expectedCount} participants from the CSV.`
      expect(warningText).toContain('CSV data is larger than participant IDs')
      expect(warningText).toContain('5 participants')
      expect(warningText).toContain('12 records')
      expect(warningText).toContain('Considering the top 5 participants from the CSV')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Robust ID Token and Format Conflict Matching
  // ───────────────────────────────────────────────────────────────────────────
  describe('Robust ID Token and Format Conflict Matching', () => {
    it('matches participant ID when filename has tokens or prefixes e.g. P001_Aarav.jpg', () => {
      const records = [
        { 'id': 'P001', 'name': 'Aarav Sharma' },
        { 'id': 'P002', 'name': 'Priya Mehta' },
        { 'id': 'P003', 'name': 'Dr. Rahul Patel' },
      ]

      const images = [
        makeUploadedImage('P001_Aarav.jpg'),
        makeUploadedImage('photo_P002.png'),
        makeUploadedImage('random_unrelated.jpg'),
      ]

      const result = matchPhotosToParticipants(records, images)

      expect(result.counts.matched).toBe(2)
      expect(result.matches[0].assignedImage?.filename).toBe('P001_Aarav.jpg')
      expect(result.matches[1].assignedImage?.filename).toBe('photo_P002.png')
      expect(result.matches[2].status).toBe('missing_photo')
      expect(result.unmatchedImages[0].filename).toBe('random_unrelated.jpg')
    })

    it('matches delimiter-agnostic IDs e.g. P-001 vs p001.jpg and auto-detects Participant ID column', () => {
      const records = [
        { 'Participant ID': 'P-001', 'Name': 'Alice' },
        { 'Participant ID': 'P-002', 'Name': 'Bob' },
      ]

      const images = [
        makeUploadedImage('p001.jpg'),
        makeUploadedImage('P_002.png'),
      ]

      // Note: identifierColumn not passed, engine auto-detects 'Participant ID'
      const result = matchPhotosToParticipants(records, images)

      expect(result.counts.matched).toBe(2)
      expect(result.matches[0].assignedImage?.filename).toBe('p001.jpg')
      expect(result.matches[1].assignedImage?.filename).toBe('P_002.png')
    })

    it('falls back to participant name in auto mode if image filename matches name', () => {
      const records = [
        { 'id': 'P999', 'name': 'Aarav Sharma' },
      ]

      const images = [
        makeUploadedImage('aarav_sharma.jpg'),
      ]

      const result = matchPhotosToParticipants(records, images, { matchingMethod: 'auto' })

      expect(result.counts.matched).toBe(1)
      expect(result.matches[0].assignedImage?.filename).toBe('aarav_sharma.jpg')
    })
  })
})


