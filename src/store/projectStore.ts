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
import { saveProject, loadProject, savePersonPhotos, getPersonPhotos } from '../db/dexie'

interface ProjectState {
  // Current project
  project: DesignProject | null
  people:  Person[]

  // Brand / Event Logos
  instituteLogo: string
  clubLogo:      string
  samplePhotoUrl?: string

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
  setSamplePhotoUrl: (url: string) => void

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
      people:      [],
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
    if (stored) {
      const storedPeople = stored.people || []
      const photoMap = await getPersonPhotos(id)
      const peopleWithPhotos = storedPeople.map(p => ({
        ...p,
        photoUrl: p.photoUrl || photoMap[p.id] || '',
      }))
      set({ project: stored, people: peopleWithPhotos })
    }
  },

  async saveProject() {
    const { project, people } = get()
    if (!project) return
    const updated = { ...project, people, updatedAt: new Date().toISOString() }
    set({ project: updated })
    await saveProject(updated)
    const photosToSave = people
      .filter(p => p.photoUrl && p.photoUrl.startsWith('data:'))
      .map(p => ({
        personId: p.id,
        dataUrl: p.photoUrl!,
        filename: `${p.id}.jpg`,
      }))
    if (photosToSave.length > 0) {
      await savePersonPhotos(project.id, photosToSave)
    }
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
    set(s => ({
      people,
      project: s.project ? { ...s.project, people } : s.project,
    }))
    const { project } = get()
    if (project) {
      const photosToSave = people
        .filter(p => p.photoUrl && p.photoUrl.startsWith('data:'))
        .map(p => ({
          personId: p.id,
          dataUrl: p.photoUrl!,
          filename: `${p.id}.jpg`,
        }))
      if (photosToSave.length > 0) {
        savePersonPhotos(project.id, photosToSave).catch(() => {})
      }
      saveProject({ ...project, people, updatedAt: new Date().toISOString() }).catch(() => {})
    }
  },

  setSamplePhotoUrl(url: string) {
    set({ samplePhotoUrl: url })
  },

  setInstituteLogo(dataUrl: string) {
    updateBrandKitLogo('acm-nit-surat', 'svnit', dataUrl)
    set(s => {
      const updateList = (elements: any[]) =>
        (elements || []).map(el =>
          el.type === 'image' && (el.id === 'svnit-logo' || el.id?.includes('svnit') || el.id?.includes('institute'))
            ? { ...el, src: dataUrl }
            : el
        )
      const updateRoleMap = (roleMap?: Record<string, any[]>) => {
        if (!roleMap) return undefined
        const res: Record<string, any[]> = {}
        for (const [k, v] of Object.entries(roleMap)) res[k] = updateList(v)
        return res
      }

      const patchTpl = (tpl: any) => ({
        ...tpl,
        elements: updateList(tpl.elements),
        backElements: tpl.backElements ? updateList(tpl.backElements) : undefined,
        roleElements: updateRoleMap(tpl.roleElements),
        roleBackElements: updateRoleMap(tpl.roleBackElements),
      })

      const activeTemplate = s.project?.activeTemplate
        ? patchTpl(s.project.activeTemplate)
        : undefined

      const drafts = s.project?.drafts?.map(patchTpl)

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
      const updateList = (elements: any[]) =>
        (elements || []).map(el =>
          el.type === 'image' && (el.id === 'acm-logo' || el.id?.includes('acm') || el.id?.includes('club') || el.id?.includes('event'))
            ? { ...el, src: dataUrl }
            : el
        )
      const updateRoleMap = (roleMap?: Record<string, any[]>) => {
        if (!roleMap) return undefined
        const res: Record<string, any[]> = {}
        for (const [k, v] of Object.entries(roleMap)) res[k] = updateList(v)
        return res
      }

      const patchTpl = (tpl: any) => ({
        ...tpl,
        elements: updateList(tpl.elements),
        backElements: tpl.backElements ? updateList(tpl.backElements) : undefined,
        roleElements: updateRoleMap(tpl.roleElements),
        roleBackElements: updateRoleMap(tpl.roleBackElements),
      })

      const activeTemplate = s.project?.activeTemplate
        ? patchTpl(s.project.activeTemplate)
        : undefined

      const drafts = s.project?.drafts?.map(patchTpl)

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
