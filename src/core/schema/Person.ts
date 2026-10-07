import { z } from 'zod'

export const PersonSchema = z.object({
  id:        z.string(),
  name:      z.string(),
  role:      z.string(),          // must match a Role.id
  email:     z.string().optional(),
  team:      z.string().optional(),
  photoUrl:  z.string().optional(),
  photoFile: z.any().optional(),  // File object (not serializable)
  /** Dynamic extra columns from CSV (preserved as-is) */
  extra:     z.record(z.string(), z.string()).default({}),
})
export type Person = z.infer<typeof PersonSchema>

export const PersonRowStatusSchema = z.object({
  person:   PersonSchema,
  errors:   z.array(z.string()),
  warnings: z.array(z.string()),
  rowIndex: z.number(),
})
export type PersonRowStatus = z.infer<typeof PersonRowStatusSchema>
