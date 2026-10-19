import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LoginSchema } from '../../../core/schema/AuthSchemas'
import { AuthService } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'
import { AUTH_CONFIG } from '../../../config/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setPendingAuth = useAuthStore(s => s.setPendingAuth)

  // Retrieve any email passed from state (e.g. redirect from registration)
  const initialEmail = (location.state as any)?.email || ''
  const [email, setEmail] = useState(initialEmail)
  const [emailError, setEmailError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [isNotRegistered, setIsNotRegistered] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function handleGoogleSignIn() {
    setGeneralError('')
    setIsGoogleLoading(true)
    try {
      await AuthService.signInWithGoogle()
    } catch (err: any) {
      setGeneralError(err.message || 'Google sign-in failed. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')
    setEmailError('')
    setIsNotRegistered(false)

    // 1. Validate email input with Zod
    const result = LoginSchema.safeParse({ email })
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message || AUTH_CONFIG.messages.invalidEmail)
      return
    }

    setIsSubmitting(true)
    try {
      // 2. Request Login OTP with shouldCreateUser: false
      await AuthService.sendLoginOtp(result.data.email)

      // 3. Cache pending login in store & sessionStorage
      setPendingAuth(result.data.email, 'login')

      // 4. Redirect to OTP verification screen
      navigate(AUTH_CONFIG.routes.verifyOtp, {
        state: {
          email: result.data.email,
          flow: 'login',
          from: (location.state as any)?.from,
        },
      })
    } catch (err: any) {
      if (err.code === 'USER_NOT_FOUND' || err.message === AUTH_CONFIG.messages.emailNotRegistered) {
        setIsNotRegistered(true)
        setGeneralError(AUTH_CONFIG.messages.emailNotRegistered)
      } else {
        setGeneralError(err.message || AUTH_CONFIG.messages.genericError)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Header */}
        <Link to="/" className="inline-flex items-center gap-3 group mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-semibold text-sm leading-none">EC</span>
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="font-semibold text-lg text-ink">Event</span>
            <span className="font-semibold text-lg text-ink">Canvas</span>
          </div>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in to your account</h1>
        <p className="mt-2 text-xs text-muted">
          New to EventCanvas?{' '}
          <Link to={AUTH_CONFIG.routes.register} className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass p-6 sm:p-8">
          {/* General Error Banner */}
          {generalError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="text-red-500 font-bold shrink-0">⚠</span>
                <span>{generalError}</span>
              </div>
              {isNotRegistered && (
                <Link
                  to={AUTH_CONFIG.routes.register}
                  state={{ email }}
                  className="btn-primary text-xs py-1.5 px-3 self-start mt-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
                >
                  Register Now →
                </Link>
              )}
            </div>
          )}

          {/* Direct Google Sign In */}
          <button
            type="button"
            id="google-login-btn"
            disabled={isGoogleLoading || isSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg border border-line hover:border-line-strong bg-white/50 hover:bg-white text-ink shadow-sm flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            {isGoogleLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
              <span className="bg-bg px-2.5 text-muted rounded">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email Address */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                placeholder="you@domain.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                  if (generalError) setGeneralError('')
                }}
                className={`input text-sm w-full py-2.5 px-3 rounded-lg border ${
                  emailError ? 'border-red-400 bg-red-50/20' : 'border-line'
                } focus:outline-none focus:border-accent`}
              />
              {emailError && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{emailError}</p>
              )}
              <p className="mt-1.5 text-[11px] text-muted">
                Enter your registered email. We will send a secure login link and code to sign in.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 px-4 text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Sending email...</span>
                  </>
                ) : (
                  <span>Send Login Link & Code →</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security badge / note */}
        <p className="text-center text-[11px] text-muted mt-6">
          Passwordless login via Email OTP. No passwords to remember or compromise.
        </p>
      </div>
    </div>
  )
}
