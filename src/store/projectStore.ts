import { create } from 'zustand'
import { nanoid } from '../utils/nanoid'
import type { DesignProject } from '../core/schema/DesignProject'
import type { EventContext } from '../core/schema/EventContext'
import type { Role } from '../core/schema/Role'
import type { CardTemplate } from '../core/schema/CardTemplate'
import type { Person } from '../core/schema/Person'
import { makeEmptyEventContext } from '../core/schema/EventContext'
import { DEFAULT_ROLES } from '../core/schema/Role'
import { DEFAULT_SVNIT_LOGO, DEFAULT_ACM_LOGO } from '../brandKits/defaultLogos'
import { updateBrandKitLogo } from '../brandKits/loader'
import { saveProject, loadProject } from '../db/dexie'

interface ProjectState {
  // Current project
  project: DesignProject | null
  people:  Person[]

  // Brand / Event Logos
  instituteLogo: string
  clubLogo:      string

  // Actions
  newProject: (name?: string) => DesignProject
  loadProject: (id: string) => Promise<void>
  saveProject: () => Promise<void>

  setEventContext: (ctx: Partial<EventContext>) => void
  setRoles: (roles: Role[]) => void
  setDrafts: (drafts: CardTemplate[]) => void
  setActiveTemplate: (tpl: CardTemplate) => void
  updateActiveTemplate: (patch: Partial<CardTemplate>) => void
  setWizardStep: (step: number) => void
  addNlMessage: (role: 'user' | 'assistant', content: string) => void
  setPeople: (people: Person[]) => void

  setInstituteLogo: (dataUrl: string) => void
  setClubLogo: (dataUrl: string) => void
  resetInstituteLogo: () => void
  resetClubLogo: () => void

  saveVersion: (label: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  people:  [],
  instituteLogo: DEFAULT_SVNIT_LOGO,
  clubLogo:      DEFAULT_ACM_LOGO,

  newProject(name = 'Untitled Project') {
    const project: DesignProject = {
      id:          nanoid(),
      name,
      designType:  'idCard',
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      eventContext: makeEmptyEventContext(),
      roles:       DEFAULT_ROLES,
      drafts:      [],
      brandKitId:  'acm-nit-surat',
      wizardStep:  0,
      nlHistory:   [],
      versions:    [],
    }
    set({ project, people: [] })
    return project
  },

  async loadProject(id) {
    const stored = await loadProject(id)
    if (stored) set({ project: stored })
  },

  async saveProject() {
    const { project } = get()
    if (!project) return
    const updated = { ...project, updatedAt: new Date().toISOString() }
    set({ project: updated })
    await saveProject(updated)
  },

  setEventContext(ctx) {
    set(s => ({
      project: s.project
        ? { ...s.project, eventContext: { ...s.project.eventContext, ...ctx } }
        : s.project
    }))
  },

  setRoles(roles) {
    set(s => ({ project: s.project ? { ...s.project, roles } : s.project }))
  },

  setDrafts(drafts) {
    set(s => ({ project: s.project ? { ...s.project, drafts } : s.project }))
  },

  setActiveTemplate(tpl) {
    set(s => ({ project: s.project ? { ...s.project, activeTemplate: tpl } : s.project }))
  },

  updateActiveTemplate(patch) {
    set(s => ({
      project: s.project && s.project.activeTemplate
        ? { ...s.project, activeTemplate: { ...s.project.activeTemplate, ...patch } }
        : s.project
    }))
  },

  setWizardStep(step) {
    set(s => ({ project: s.project ? { ...s.project, wizardStep: step } : s.project }))
  },

  addNlMessage(role, content) {
    set(s => ({
      project: s.project ? {
        ...s.project,
        nlHistory: [...s.project.nlHistory, { role, content, ts: new Date().toISOString() }]
      } : s.project
    }))
  },

  setPeople(people) {
    set({ people })
  },

  setInstituteLogo(dataUrl: string) {
    updateBrandKitLogo('acm-nit-surat', 'svnit', dataUrl)
    set(s => {
      const updateTemplateElements = (elements: any[]) =>
        elements.map(el =>
          el.type === 'image' && (el.id === 'svnit-logo' || el.id.includes('svnit') || el.id.includes('institute'))
            ? { ...el, src: dataUrl }
            : el
        )

      const activeTemplate = s.project?.activeTemplate
        ? {
            ...s.project.activeTemplate,
            elements: updateTemplateElements(s.project.activeTemplate.elements)
          }
        : undefined

      const drafts = s.project?.drafts?.map(draft => ({
        ...draft,
        elements: updateTemplateElements(draft.elements)
      }))

      return {
        instituteLogo: dataUrl,
        project: s.project
          ? {
              ...s.project,
              activeTemplate: activeTemplate ?? s.project.activeTemplate,
              drafts: drafts ?? s.project.drafts
            }
          : null
      }
    })
  },

  setClubLogo(dataUrl: string) {
    updateBrandKitLogo('acm-nit-surat', 'acm', dataUrl)
    set(s => {
      const updateTemplateElements = (elements: any[]) =>
        elements.map(el =>
          el.type === 'image' && (el.id === 'acm-logo' || el.id.includes('acm') || el.id.includes('club') || el.id.includes('event'))
            ? { ...el, src: dataUrl }
            : el
        )

      const activeTemplate = s.project?.activeTemplate
        ? {
            ...s.project.activeTemplate,
            elements: updateTemplateElements(s.project.activeTemplate.elements)
          }
        : undefined

      const drafts = s.project?.drafts?.map(draft => ({
        ...draft,
        elements: updateTemplateElements(draft.elements)
      }))

      return {
        clubLogo: dataUrl,
        project: s.project
          ? {
              ...s.project,
              activeTemplate: activeTemplate ?? s.project.activeTemplate,
              drafts: drafts ?? s.project.drafts
            }
          : null
      }
    })
  },

  resetInstituteLogo() {
    get().setInstituteLogo(DEFAULT_SVNIT_LOGO)
  },

  resetClubLogo() {
    get().setClubLogo(DEFAULT_ACM_LOGO)
  },

  saveVersion(label) {
    set(s => {
      if (!s.project?.activeTemplate) return s
      const version = {
        id:               nanoid(),
        savedAt:          new Date().toISOString(),
        label,
        templateSnapshot: s.project.activeTemplate,
      }
      return {
        project: {
          ...s.project,
          versions: [...s.project.versions, version]
        }
      }
    })
  },
}))
