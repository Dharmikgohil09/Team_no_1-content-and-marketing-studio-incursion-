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
  name:             tracked(z.string()),
  category:         tracked(z.string()).optional(),
  description:      tracked(z.string()).optional(),
  tagline:          tracked(z.string()),
  dateStart:        tracked(z.string()),   // ISO date string or formatted date
  dateEnd:          tracked(z.string()),
  duration:         tracked(z.string()),   // e.g. "24-hour"
  venue:            tracked(z.string()),
  organizer:        tracked(z.string()),   // e.g. "ACM NIT Surat"
  participantCount: tracked(z.number()).optional(),
  requestedFields:  tracked(z.array(z.string())).optional(),
  hasPhotos:        tracked(z.boolean()).optional(),
  hasQrCode:        tracked(z.boolean()).optional(),
  themeHint:        tracked(z.string()).optional(),
  website:          tracked(z.string().optional()),
  contact:          tracked(z.string()),
})

export type EventContext = z.infer<typeof EventContextSchema>

export function makeEmptyEventContext(): EventContext {
  return EventContextSchema.parse({
    name:             {},
    category:         { value: 'hackathon', status: 'missing' },
    description:      {},
    tagline:          {},
    dateStart:        {},
    dateEnd:          {},
    duration:         {},
    venue:            {},
    organizer:        {},
    participantCount: {},
    requestedFields:  {},
    hasPhotos:        {},
    hasQrCode:        {},
    themeHint:        {},
    website:          {},
    contact:          {},
  })
}
