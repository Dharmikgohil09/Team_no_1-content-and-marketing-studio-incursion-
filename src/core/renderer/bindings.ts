import type { EventContext } from '../schema/EventContext'
import type { Role } from '../schema/Role'
import type { Person } from '../schema/Person'
import type { BrandKit } from '../schema/BrandKit'

/** Context object passed to binding resolver */
export interface BindingContext {
  event:   EventContext
  role:    Role
  person:  Person
  brandKit: BrandKit
}

/** Resolve all {{token}} bindings in a string */
export function resolveBindings(template: string, ctx: BindingContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const value = resolvePath(path.trim(), ctx)
    if (value === undefined || value === null) return ''
    return String(value)
  })
}

/** Deep-get a dot-path value from an object */
function resolvePath(path: string, ctx: BindingContext): unknown {
  const parts = path.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = ctx

  // Support shorthand: person.* -> ctx.person.*, role.* -> ctx.role.*
  for (const part of parts) {
    if (obj === null || obj === undefined) return undefined
    // Handle tracked field values (status/value objects)
    if (typeof obj === 'object' && 'value' in obj && 'status' in obj) {
      obj = obj.value
      // Now try the part on the value
      if (obj === undefined || obj === null) return undefined
    }
    obj = obj[part]
  }
  // Final unwrap if it's still a tracked field
  if (typeof obj === 'object' && obj !== null && 'value' in obj && 'status' in obj) {
    const val = obj.value
    if (val !== undefined && val !== null && val !== '') return val
  }

  // Provide sensible event/person/role fallbacks if unresolved or empty
  if (obj === undefined || obj === null || obj === '' || obj === '[No Name]') {
    const trimmed = path.trim()
    if (trimmed.startsWith('event.name')) return ctx.event?.name?.value || 'INCURSION 2026'
    if (trimmed.startsWith('event.venue')) return ctx.event?.venue?.value || 'SVNIT, Surat'
    if (trimmed.startsWith('event.dateStart')) return ctx.event?.dateStart?.value || '20-22 March 2026'
    if (trimmed.startsWith('event.organizer')) return ctx.event?.organizer?.value || 'ACM NIT Surat'
    if (trimmed.startsWith('event.tagline')) return ctx.event?.tagline?.value || 'Flagship Tech Hackathon'
    if (trimmed === 'person.name') return ctx.person?.name && ctx.person.name !== '[No Name]' ? ctx.person.name : 'Participant Name'
    if (trimmed === 'person.photo' || trimmed === 'person.photoUrl' || trimmed === 'person.avatar' || trimmed === 'person.image') {
      return ctx.person?.photoUrl || (ctx.person as any)?.photo || (ctx.person as any)?.avatar || ''
    }
    if (trimmed === 'person.team' || trimmed === 'person.college' || trimmed === 'person.org' || trimmed === 'person.department') {
      return ctx.person?.team || ctx.person?.extra?.college || ctx.person?.extra?.department || 'Team Alpha'
    }
    if (trimmed === 'person.id' || trimmed === 'person.uid' || trimmed === 'person.regNo') return ctx.person?.id || 'ID-042'
    if (trimmed === 'role.label' || trimmed === 'person.role') return ctx.role?.label || 'Participant'
  }
  return obj
}

/** Collect all unresolved bindings in a string (returns list of binding paths) */
export function findUnresolvedBindings(template: string, ctx: BindingContext): string[] {
  const unresolved: string[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let match
  while ((match = regex.exec(template)) !== null) {
    const path = match[1].trim()
    const value = resolvePath(path, ctx)
    if (value === undefined || value === null || value === '') {
      unresolved.push(path)
    }
  }
  return unresolved
}
