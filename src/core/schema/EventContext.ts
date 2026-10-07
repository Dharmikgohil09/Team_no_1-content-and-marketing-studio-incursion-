import { z } from 'zod'

/** Status of each field in the EventContext */
export const FieldStatusSchema = z.enum(['provided', 'missing', 'confirmed', 'skipped'])
export type FieldStatus = z.infer<typeof FieldStatusSchema>

export function tracked<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    value: schema.optional(),
    status: FieldStatusSchema.default('missing'),
  })
}

/** Full event context, each field tracked */
export const EventContextSchema = z.object({
  name:       tracked(z.string()),
  tagline:    tracked(z.string()),
  dateStart:  tracked(z.string()),   // ISO date string
  dateEnd:    tracked(z.string()),
  duration:   tracked(z.string()),   // e.g. "24-hour"
  venue:      tracked(z.string()),
  organizer:  tracked(z.string()),   // e.g. "ACM NIT Surat"
  website:    tracked(z.string().url().optional()),
  contact:    tracked(z.string()),
})

export type EventContext = z.infer<typeof EventContextSchema>

export function makeEmptyEventContext(): EventContext {
  return EventContextSchema.parse({
    name:      {},
    tagline:   {},
    dateStart: {},
    dateEnd:   {},
    duration:  {},
    venue:     {},
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website:   {},
    contact:   {},
  })
}
