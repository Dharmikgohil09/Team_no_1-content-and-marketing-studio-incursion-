import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { AUTH_CONFIG } from '../config/auth'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  created_at?: string
  updated_at?: string
}

export class AuthService {
  /**
   * Check if an email is already registered using the secure backend endpoint.
   */
  static async checkEmailExists(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase()
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      })

      if (res.ok) {
        const data = await res.json()
        return Boolean(data.exists)
      }
    } catch (err) {
      console.warn('Backend email check error, falling back to direct query:', err)
    }

    // Client fallback check against public profiles
    try {
      const { data, error } = await supabase
        .from(AUTH_CONFIG.tables.profiles)
        .select('email')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (!error && data) return true
    } catch {}

    return false
  }

  /**
   * Send OTP for registration.
   * Enforces:
   * 1. Rejects if email is already registered.
   * 2. Calls signInWithOtp with shouldCreateUser: true.
   */
  static async sendRegistrationOtp(email: string, fullName: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = fullName.trim()

    // 1. Refuse if email already registered
    const exists = await this.checkEmailExists(cleanEmail)
    if (exists) {
      const error: any = new Error(AUTH_CONFIG.messages.emailAlreadyRegistered)
      error.code = 'EMAIL_EXISTS'
      throw error
    }

    // 2. Request OTP code with user metadata
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: cleanName,
        },
      },
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('rate') || error.status === 429) {
        throw new Error(AUTH_CONFIG.messages.otpRateLimited)
      }
      throw new Error(error.message || AUTH_CONFIG.messages.genericError)
    }
  }

  /**
   * Send OTP for login.
   * Enforces:
   * 1. shouldCreateUser: false (unregistered emails will NOT be created).
   * 2. Clear error if email not registered.
   */
  static async sendLoginOtp(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase()

    // 1. Check user existence
    const exists = await this.checkEmailExists(cleanEmail)
    if (!exists) {
      const error: any = new Error(AUTH_CONFIG.messages.emailNotRegistered)
      error.code = 'USER_NOT_FOUND'
      throw error
    }

    // 2. Send login OTP strictly without creating user
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('signups not allowed') || msg.includes('user not found') || msg.includes('not found')) {
        const err: any = new Error(AUTH_CONFIG.messages.emailNotRegistered)
        err.code = 'USER_NOT_FOUND'
        throw err
      }
      if (msg.includes('rate') || error.status === 429) {
        throw new Error(AUTH_CONFIG.messages.otpRateLimited)
      }
      throw new Error(error.message || AUTH_CONFIG.messages.genericError)
    }
  }

  /**
   * Verify entered numeric OTP code.
   */
  static async verifyOtp(
    email: string,
    token: string,
    fallbackName?: string
  ): Promise<{ user: User | null; session: Session | null }> {
    const cleanEmail = email.trim().toLowerCase()
    const cleanToken = token.trim()

    // Try verifying with type 'email' (standard for signInWithOtp in Supabase v2)
    let { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    })

    // Fallback attempt with 'signup' if 'email' fails on new registration
    if (error && (error.message.toLowerCase().includes('type') || error.status === 400)) {
      const secondTry = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'signup',
      })
      if (!secondTry.error) {
        data = secondTry.data
        error = null
      }
    }

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('expired') || msg.includes('timeout')) {
        throw new Error(AUTH_CONFIG.messages.otpExpired)
      }
      if (msg.includes('rate') || error.status === 429) {
        throw new Error(AUTH_CONFIG.messages.otpRateLimited)
      }
      throw new Error(AUTH_CONFIG.messages.otpInvalid)
    }

    // Ensure profile is idempotently saved/synchronized after verification
    if (data.user) {
      await this.upsertProfile(data.user, fallbackName).catch(err => {
        console.warn('Profile sync notice:', err)
      })
    }

    return { user: data.user, session: data.session }
  }

  /**
   * Fetch user profile from public.profiles table.
   */
  static async fetchProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from(AUTH_CONFIG.tables.profiles)
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching profile:', error.message)
        return null
      }
      return data as UserProfile
    } catch {
      return null
    }
  }

  /**
   * Idempotent profile upsert to guarantee persistence even if DB trigger is delayed.
   */
  static async upsertProfile(user: User, fallbackName?: string): Promise<UserProfile | null> {
    const fullName =
      (user.user_metadata?.full_name as string) ||
      fallbackName ||
      user.email?.split('@')[0] ||
      'User'

    const profileData = {
      id: user.id,
      email: user.email?.toLowerCase() || '',
      full_name: fullName.trim(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { data, error } = await supabase
        .from(AUTH_CONFIG.tables.profiles)
        .upsert(profileData, { onConflict: 'id' })
        .select('*')
        .maybeSingle()

      if (!error && data) return data as UserProfile
    } catch (err) {
      console.warn('Upsert profile notice:', err)
    }

    return {
      id: user.id,
      email: user.email || '',
      full_name: fullName,
    }
  }

  /**
   * Log out and invalidate active session.
   */
  static async signOut(): Promise<void> {
    await supabase.auth.signOut().catch(err => console.warn('Sign out notice:', err))
  }
}
