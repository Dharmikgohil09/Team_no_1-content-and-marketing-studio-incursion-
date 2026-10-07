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
  { value: 'speaker',     label: 'Speaker' },
]

/**
 * Generate adaptive questions for fields still marked 'missing'.
 * Questions are ordered by importance.
 */
export function generateQuestions(event: EventContext, roles: Role[]): Question[] {
  const questions: Question[] = []

  if (event.name.status === 'missing') {
    questions.push({
      id: 'q-event-name',
      label: 'What is the name of your event?',
      hint: 'e.g. "InCursion 2024", "HackNIT", "ACM TechFest"',
      type: 'text',
      field: 'name',
      required: true,
    })
  }

  if (event.dateStart.status === 'missing') {
    questions.push({
      id: 'q-date-start',
      label: 'When does the event start?',
      hint: 'Date will appear on the ID card',
      type: 'date',
      field: 'dateStart',
      required: true,
    })
  }

  if (event.venue.status === 'missing') {
    questions.push({
      id: 'q-venue',
      label: 'Where is the event held?',
      hint: 'e.g. "SVNIT, Surat", "NIT Campus"',
      type: 'text',
      field: 'venue',
      required: true,
    })
  }

  if (event.tagline.status === 'missing') {
    questions.push({
      id: 'q-tagline',
      label: 'Event tagline or subtitle?',
      hint: 'Short motto shown below the event name (optional)',
      type: 'text',
      field: 'tagline',
      required: false,
    })
  }

  if (roles.length === 0) {
    questions.push({
      id: 'q-roles',
      label: 'Which roles need ID cards?',
      hint: 'Select all that apply — each role gets a distinct color',
      type: 'multiselect',
      options: ROLE_OPTIONS,
      field: 'roles',
      required: true,
    })
  }

  if (event.contact.status === 'missing') {
    questions.push({
      id: 'q-contact',
      label: 'Contact email or phone for the event?',
      hint: 'Optional — shown on card footer',
      type: 'text',
      field: 'contact',
      required: false,
    })
  }

  if (event.website.status === 'missing') {
    questions.push({
      id: 'q-website',
      label: 'Event website URL?',
      hint: 'Used for QR code target (optional)',
      type: 'text',
      field: 'website',
      required: false,
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
