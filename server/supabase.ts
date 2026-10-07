import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
// Service role key bypasses RLS for backend admin operations, fallback to anon key if not set
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Server Supabase: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY missing in environment variables.')
}

// Clean trailing slashes or /rest/v1
const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')

export const supabaseServer = createClient(cleanUrl || supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Server environment shouldn't persist session in local storage
  }
})
