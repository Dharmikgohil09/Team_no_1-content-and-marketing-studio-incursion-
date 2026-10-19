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
