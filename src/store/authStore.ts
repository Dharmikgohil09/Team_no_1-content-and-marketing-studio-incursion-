import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { AuthService, UserProfile } from '../services/authService'
import { AUTH_CONFIG } from '../config/auth'

interface PendingAuthState {
  email: string
  flow: 'register' | 'login'
  fullName?: string
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  isInitialized: boolean
  pendingAuth: PendingAuthState | null

  // Actions
  initialize: () => Promise<void>
  setPendingAuth: (email: string, flow: 'register' | 'login', fullName?: string) => void
  clearPendingAuth: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

// Helper to safely load cached pending auth from sessionStorage
function loadStoredPendingAuth(): PendingAuthState | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CONFIG.storageKeys.pendingAuth)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  pendingAuth: loadStoredPendingAuth(),

  initialize: async () => {
    if (get().isInitialized) return

    try {
      // 1. Restore current session from Supabase local storage
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user, session, isLoading: true })
        const profile = await AuthService.fetchProfile(session.user.id)
        set({ profile, isLoading: false, isInitialized: true })
      } else {
        set({ user: null, session: null, profile: null, isLoading: false, isInitialized: true })
      }

      // 2. Listen to future auth state events
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        const currentUser = newSession?.user ?? null
        set({ session: newSession, user: currentUser })

        if (currentUser) {
          // If a pending registration had a full name, ensure profile is upserted
          const pending = get().pendingAuth
          const fallbackName = pending?.fullName || (currentUser.user_metadata?.full_name as string)
          if (fallbackName) {
            await AuthService.upsertProfile(currentUser, fallbackName).catch(() => {})
          }
          const profile = await AuthService.fetchProfile(currentUser.id)
          set({ profile, isLoading: false })
        } else {
          set({ profile: null, isLoading: false })
        }
      })
    } catch (err) {
      console.warn('Auth initialization notice:', err)
      set({ isLoading: false, isInitialized: true })
    }
  },

  setPendingAuth: (email: string, flow: 'register' | 'login', fullName?: string) => {
    const pending: PendingAuthState = { email: email.trim().toLowerCase(), flow, fullName: fullName?.trim() }
    set({ pendingAuth: pending })
    try {
      sessionStorage.setItem(AUTH_CONFIG.storageKeys.pendingAuth, JSON.stringify(pending))
    } catch {}
  },

  clearPendingAuth: () => {
    set({ pendingAuth: null })
    try {
      sessionStorage.removeItem(AUTH_CONFIG.storageKeys.pendingAuth)
    } catch {}
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) return
    const profile = await AuthService.fetchProfile(user.id)
    if (profile) set({ profile })
  },

  signOut: async () => {
    set({ isLoading: true })
    await AuthService.signOut()
    get().clearPendingAuth()
    set({ user: null, session: null, profile: null, isLoading: false })
  },
}))
