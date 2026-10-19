/**
 * Centralized, non-hardcoded authentication configuration.
 * All properties read from environment variables with safe defaults.
 */
export const AUTH_CONFIG = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL || '').trim(),
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
  otpLength: Math.max(4, Math.min(8, Number(import.meta.env.VITE_OTP_LENGTH) || 6)),
  resendCooldownSeconds: Math.max(10, Number(import.meta.env.VITE_OTP_RESEND_COOLDOWN_SECONDS) || 60),
  maxOtpAttempts: Math.max(1, Number(import.meta.env.VITE_OTP_MAX_ATTEMPTS) || 5),
  routes: {
    login: '/login',
    register: '/register',
    verifyOtp: '/verify-otp',
    defaultRedirect: (import.meta.env.VITE_AUTH_REDIRECT_PATH || '/studio/describe').trim(),
    home: '/',
  },
  tables: {
    profiles: 'profiles',
  },
  storageKeys: {
    pendingAuth: 'eventcanvas_pending_auth',
  },
  messages: {
    emailAlreadyRegistered: 'This email is already registered. Please log in instead.',
    emailNotRegistered: 'No account found with this email. Please register first.',
    invalidEmail: 'Please enter a valid email address.',
    nameRequired: 'Full name must be at least 2 characters.',
    otpSent: 'A verification code has been sent to your email.',
    otpInvalid: 'Invalid verification code. Please check and try again.',
    otpExpired: 'Verification code has expired. Please request a new code.',
    otpMaxAttempts: 'Too many incorrect attempts. Please request a new code.',
    otpRateLimited: 'Too many requests. Please wait a moment before trying again.',
    missingSupabaseConfig: 'Supabase URL or Anon Key is missing in environment variables.',
    genericError: 'An unexpected error occurred. Please try again.',
  },
} as const
