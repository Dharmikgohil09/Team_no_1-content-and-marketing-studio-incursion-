import { createClient } from '@supabase/supabase-js'
import { AUTH_CONFIG } from '../config/auth'

const cleanUrl = AUTH_CONFIG.supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')

if (!cleanUrl || !AUTH_CONFIG.supabaseAnonKey) {
  console.warn('⚠️ Supabase client: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in environment variables.')
}

export const supabase = createClient(cleanUrl || 'https://placeholder.supabase.co', AUTH_CONFIG.supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
