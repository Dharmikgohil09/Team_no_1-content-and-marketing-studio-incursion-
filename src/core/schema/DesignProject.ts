import { z } from 'zod'
import { EventContextSchema } from './EventContext'
import { RoleSchema } from './Role'
import { CardTemplateSchema } from './CardTemplate'

export const DesignProjectSchema = z.object({
  id:           z.string(),
  name:         z.string(),
  designType:   z.string().default('idCard'),
  createdAt:    z.string(),         // ISO
  updatedAt:    z.string(),         // ISO
  
  eventContext: EventContextSchema,
  roles:        z.array(RoleSchema),
  
  /** The template being edited (after draft selection) */
  activeTemplate: CardTemplateSchema.optional(),
  /** All generated draft templates */
  drafts:        z.array(CardTemplateSchema).default([]),
  
  brandKitId:   z.string().default('acm-nit-surat'),
  
  /** CSV/JSON import data */
  dataSource: z.object({
    raw:         z.string().optional(),    // raw CSV text
    columnMap:   z.record(z.string(), z.string()).optional(), // csvCol -> personField
    personCount: z.number().default(0),
  }).optional(),
  
  /** Version history (save snapshots) */
  versions: z.array(z.object({
    id:          z.string(),
    savedAt:     z.string(),
    label:       z.string(),
    templateSnapshot: CardTemplateSchema,
  })).default([]),
  
  wizardStep: z.number().min(0).max(5).default(0),
  nlHistory:  z.array(z.object({
    role:    z.enum(['user','assistant']),
    content: z.string(),
    ts:      z.string(),
  })).default([]),
})
export type DesignProject = z.infer<typeof DesignProjectSchema>
