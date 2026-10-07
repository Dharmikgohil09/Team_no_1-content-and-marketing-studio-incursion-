import Dexie, { type Table } from 'dexie'
import type { DesignProject } from '../core/schema/DesignProject'

export interface StoredProject extends DesignProject {
  _updatedAt: number  // timestamp for sorting
}

class StudioDB extends Dexie {
  projects!: Table<StoredProject, string>

  constructor() {
    super('ContentMarketingStudio')
    this.version(1).stores({
      projects: 'id, _updatedAt, name, designType',
    })
  }
}

export const db = new StudioDB()

export async function saveProject(project: DesignProject): Promise<void> {
  await db.projects.put({
    ...project,
    _updatedAt: Date.now(),
  })
}

export async function loadProject(id: string): Promise<DesignProject | undefined> {
  return db.projects.get(id)
}

export async function listProjects(): Promise<StoredProject[]> {
  return db.projects.orderBy('_updatedAt').reverse().toArray()
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id)
}
