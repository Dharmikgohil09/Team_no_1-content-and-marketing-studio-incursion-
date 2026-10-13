import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'

export interface Question {
  id:       string
  label:    string
  hint?:    string
  type:     'text' | 'date' | 'number' | 'select' | 'multiselect' | 'boolean'
  options?: Array<{ value: string; label: string }>
  field:    string  // maps to EventContext or role field
  required: boolean
}

const ROLE_OPTIONS = [
  { value: 'participant', label: 'Participant' },
  { value: 'organizer',   label: 'Organizer' },
  { value: 'mentor',      label: 'Mentor' },
  { value: 'volunteer',   label: 'Volunteer' },
  { value: 'judge',       label: 'Judge' },
]

const CATEGORY_OPTIONS = [
  { value: 'hackathon',   label: 'Hackathon / Coding Competition' },
  { value: 'sports',      label: 'Sports Tournament / Athletic Event' },
  { value: 'conference',  label: 'Conference / Summit / Seminar' },
  { value: 'robotics',    label: 'Robotics / Engineering Competition' },
  { value: 'cultural',    label: 'Cultural / Arts / Music Festival' },
  { value: 'workshop',    label: 'Technical Workshop / Bootcamp' },
]

/**
 * Generate adaptive questions ONLY for fields that are genuinely missing and necessary.
 * Never repeats questions whose answers already exist or are provided.
 */
export function generateQuestions(event: EventContext, roles: Role[]): Question[] {
  const questions: Question[] = []

  // 1. Event Name (Required if not provided)
  const hasName = event.name?.status !== 'missing' && event.name?.value && event.name.value.trim() !== ''
  if (!hasName) {
    questions.push({
      id: 'q-event-name',
      label: 'What is the name of your event?',
      hint: 'e.g. "CodeStorm 2026", "SVNIT Champions League"',
      type: 'text',
      field: 'name',
      required: true,
    })
  }

  // 2. Event Category (Only if completely unknown or vague)
  const hasCategory = (event as any).category?.status !== 'missing' && (event as any).category?.value
  if (!hasCategory && !hasName) {
    questions.push({
      id: 'q-category',
      label: 'What type of event is this?',
      hint: 'Helps us generate category-specific visual themes',
      type: 'select',
      options: CATEGORY_OPTIONS,
      field: 'category',
      required: true,
    })
  }

  // 3. Date (Required if not provided)
  const hasDate = event.dateStart?.status !== 'missing' && event.dateStart?.value && event.dateStart.value.trim() !== ''
  if (!hasDate) {
    questions.push({
      id: 'q-date-start',
      label: 'What date should appear on the card?',
      hint: 'e.g. "18 October 2026" or "20-22 March 2026"',
      type: 'text',
      field: 'dateStart',
      required: true,
    })
  }

  // 4. Venue (Required if not provided)
  const hasVenue = event.venue?.status !== 'missing' && event.venue?.value && event.venue.value.trim() !== ''
  if (!hasVenue) {
    questions.push({
      id: 'q-venue',
      label: 'Where is the event taking place (venue)?',
      hint: 'e.g. "SVNIT Surat", "Main Auditorium"',
      type: 'text',
      field: 'venue',
      required: true,
    })
  }

  // 5. Roles (Only if no roles were detected)
  if (!roles || roles.length === 0) {
    questions.push({
      id: 'q-roles',
      label: 'Which roles need ID cards?',
      hint: 'Select all that apply — each role gets a distinctive visual badge',
      type: 'multiselect',
      options: ROLE_OPTIONS,
      field: 'roles',
      required: true,
    })
  }

  return questions
}

/** Ask questions via LLM proxy (with deterministic fallback) */
export async function generateQuestionsFromLLM(
  event: EventContext,
  roles: Role[]
): Promise<Question[]> {
  // Deterministic for now — no need for LLM to generate questions
  return generateQuestions(event, roles)
}
