import { useMemo } from 'react'
import { renderCard, type RenderOptions } from '../../core/renderer'
import type { CardTemplate } from '../../core/schema/CardTemplate'
import type { Role } from '../../core/schema/Role'
import type { Person } from '../../core/schema/Person'
import type { EventContext } from '../../core/schema/EventContext'
import type { BrandKit } from '../../core/schema/BrandKit'
import { makeEmptyEventContext } from '../../core/schema/EventContext'

interface CardPreviewProps {
  template:     CardTemplate
  role:         Role
  person:       Person
  event?:       EventContext
  brandKit:     BrandKit
  face?:        'front' | 'back'
  includeBleed?: boolean
  scale?:       number   // display scale (1 = actual mm size at 96dpi)
  className?:   string
  onClick?:     () => void
  selected?:    boolean
}

/**
 * Renders a card template to SVG and displays it inline.
 * Uses mm viewBox so the SVG is print-accurate.
 */
export function CardPreview({
  template,
  role,
  person,
  event,
  brandKit,
  face = 'front',
  includeBleed = false,
  scale = 1,
  className = '',
  onClick,
  selected,
}: CardPreviewProps) {
  const eventCtx = useMemo(() => {
    const base = event ?? makeEmptyEventContext()
    const evtName = base.name?.value || ''
    return {
      ...base,
      name: { value: evtName || 'EVENT PASS', status: base.name?.status || (evtName ? 'provided' : 'missing') },
      venue: { value: base.venue?.value || (evtName ? `${evtName} Arena` : 'Main Venue'), status: base.venue?.status || (base.venue?.value ? 'provided' : 'missing') },
      dateStart: { value: base.dateStart?.value || '2026', status: base.dateStart?.status || (base.dateStart?.value ? 'provided' : 'missing') },
      organizer: { value: base.organizer?.value || (evtName ? `${evtName} Team` : 'Organizing Committee'), status: base.organizer?.status || (base.organizer?.value ? 'provided' : 'missing') },
      tagline: { value: base.tagline?.value || 'Official Pass', status: base.tagline?.status || (base.tagline?.value ? 'provided' : 'missing') },
    }
  }, [event])

  const effectivePerson = useMemo(() => ({
    ...person,
    name: person?.name && person.name !== '[No Name]' ? person.name : 'Participant Name',
    team: person?.team || 'Team Alpha',
    id: person?.id || 'ID-042',
  }), [person])

  const { svg, warnings } = useMemo(() => {
    try {
      return renderCard({
        template,
        role,
        person: effectivePerson,
        event:    eventCtx,
        brandKit,
        face,
        includeBleed,
      })
    } catch (err) {
      console.error('CardPreview render error:', err)
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 85.6 54"><rect width="85.6" height="54" fill="#1e2235"/><text x="42.8" y="27" text-anchor="middle" fill="#ef4444" font-size="6">Render error</text></svg>`,
        warnings: [String(err)]
      }
    }
  }, [template, role, person, eventCtx, brandKit, face, includeBleed])

  return (
    <div
      className={`relative ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* SVG embed */}
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{
          // Scale the SVG for display
          fontSize: 0,
          lineHeight: 0,
        }}
      />

      {/* Warning badge */}
      {warnings.length > 0 && (
        <div
          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center cursor-help"
          title={warnings.join('\n')}
        >
          <span className="text-[8px] font-bold text-white">!</span>
        </div>
      )}

      {/* Selection ring */}
      {selected && (
        <div className="absolute inset-0 rounded-lg ring-2 ring-acm-500 ring-offset-1 ring-offset-surface-900 pointer-events-none" />
      )}
    </div>
  )
}
