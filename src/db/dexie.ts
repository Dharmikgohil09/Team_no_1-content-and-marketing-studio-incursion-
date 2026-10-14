import Dexie, { type Table } from 'dexie'
import type { DesignProject } from '../core/schema/DesignProject'
import { supabase } from '../lib/supabase'

export interface StoredProject extends DesignProject {
  _updatedAt: number  // timestamp for sorting
}

export interface StoredAsset {
  id: string          // composite `${projectId}:${personId}`
  projectId: string
  personId?: string
  filename: string
  mimeType: string
  dataUrl: string
  updatedAt: number
}

class StudioDB extends Dexie {
  projects!: Table<StoredProject, string>
  assets!: Table<StoredAsset, string>

  constructor() {
    super('ContentMarketingStudio')
    this.version(1).stores({
      projects: 'id, _updatedAt, name, designType',
    })
    this.version(2).stores({
      projects: 'id, _updatedAt, name, designType',
      assets: 'id, projectId, personId, filename, updatedAt',
    })
  }
}

export const db = new StudioDB()

export async function savePersonPhotos(
  projectId: string,
  photos: { personId: string; dataUrl: string; filename: string; mimeType?: string }[]
): Promise<void> {
  const timestamp = Date.now()
  const stored: StoredAsset[] = photos.map(p => ({
    id: `${projectId}:${p.personId}`,
    projectId,
    personId: p.personId,
    filename: p.filename,
    mimeType: p.mimeType || 'image/jpeg',
    dataUrl: p.dataUrl,
    updatedAt: timestamp,
  }))
  if (stored.length > 0) {
    await db.assets.bulkPut(stored)
  }
}

export async function getPersonPhotos(projectId: string): Promise<Record<string, string>> {
  try {
    const records = await db.assets.where('projectId').equals(projectId).toArray()
    const map: Record<string, string> = {}
    for (const r of records) {
      if (r.personId && r.dataUrl) {
        map[r.personId] = r.dataUrl
      }
    }
    return map
  } catch {
    return {}
  }
}

export async function clearProjectPhotos(projectId: string): Promise<void> {
  try {
    await db.assets.where('projectId').equals(projectId).delete()
  } catch {}
}

export async function saveProject(project: DesignProject): Promise<void> {
  const timestamp = Date.now()
  
  // 1. Always save locally to IndexedDB
  await db.projects.put({
    ...project,
    _updatedAt: timestamp,
  })

  // 2. Asynchronously sync to Supabase if configured
  try {
    const { error } = await supabase
      .from('projects')
      .upsert({
        id: project.id,
        name: project.name,
        design_type: project.designType,
        data: project,
        updated_at: new Date(timestamp).toISOString(),
      }, { onConflict: 'id' })

    if (error) {
      console.warn('Supabase project sync notice:', error.message)
    }
  } catch (err) {
    // Non-blocking catch to ensure offline work is uninterrupted
    console.warn('Supabase sync skipped or offline:', err)
  }
}

export async function loadProject(id: string): Promise<DesignProject | undefined> {
  // 1. Try local IndexedDB first for fast response
  const local = await db.projects.get(id)
  if (local) return local

  // 2. Fallback to Supabase if not found locally
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .maybeSingle()

    if (!error && data?.data) {
      const project = data.data as DesignProject
      // Cache locally
      await db.projects.put({
        ...project,
        _updatedAt: Date.now(),
      })
      return project
    }
  } catch (err) {
    console.warn('Supabase load fallback skipped:', err)
  }

  return undefined
}

export async function listProjects(): Promise<StoredProject[]> {
  const localProjects = await db.projects.orderBy('_updatedAt').reverse().toArray()

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, design_type, data, updated_at')
      .order('updated_at', { ascending: false })

    if (!error && data && data.length > 0) {
      const remoteProjects: StoredProject[] = data.map(item => ({
        ...(item.data as DesignProject),
        id: item.id,
        name: item.name,
        designType: item.design_type,
        _updatedAt: new Date(item.updated_at).getTime(),
      }))

      // Merge remote and local projects (prefer local if newer)
      const projectMap = new Map<string, StoredProject>()
      for (const p of remoteProjects) projectMap.set(p.id, p)
      for (const p of localProjects) projectMap.set(p.id, p) // local overrides if duplicate

      return Array.from(projectMap.values()).sort((a, b) => b._updatedAt - a._updatedAt)
    }
  } catch (err) {
    console.warn('Supabase list projects skipped:', err)
  }

  return localProjects
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id)

  try {
    await supabase.from('projects').delete().eq('id', id)
  } catch (err) {
    console.warn('Supabase delete project skipped:', err)
  }
}
