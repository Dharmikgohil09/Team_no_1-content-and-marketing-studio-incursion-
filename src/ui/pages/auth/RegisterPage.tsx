import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RegisterSchema } from '../../../core/schema/AuthSchemas'
import { AuthService } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'
import { AUTH_CONFIG } from '../../../config/auth'

export function RegisterPage() {
  const navigate = useNavigate()
  const setPendingAuth = useAuthStore(s => s.setPendingAuth)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({})
  const [generalError, setGeneralError] = useState('')
  const [isEmailExisting, setIsEmailExisting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')
    setFieldErrors({})
    setIsEmailExisting(false)

    // 1. Zod client-side validation
    const result = RegisterSchema.safeParse({ fullName, email })
    if (!result.success) {
      const errMap: { fullName?: string; email?: string } = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as 'fullName' | 'email'
        if (!errMap[key]) errMap[key] = issue.message
      }
      setFieldErrors(errMap)
      return
    }

    setIsSubmitting(true)
    try {
      // 2. Request OTP code via AuthService (also checks email duplication)
      await AuthService.sendRegistrationOtp(result.data.email, result.data.fullName)

      // 3. Cache pending registration in store & sessionStorage
      setPendingAuth(result.data.email, 'register', result.data.fullName)

      // 4. Navigate to OTP entry screen
      navigate(AUTH_CONFIG.routes.verifyOtp, {
        state: { email: result.data.email, flow: 'register', fullName: result.data.fullName },
      })
    } catch (err: any) {
      if (err.code === 'EMAIL_EXISTS' || err.message === AUTH_CONFIG.messages.emailAlreadyRegistered) {
        setIsEmailExisting(true)
        setGeneralError(AUTH_CONFIG.messages.emailAlreadyRegistered)
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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
        <p className="mt-2 text-xs text-muted">
          Already have an account?{' '}
          <Link to={AUTH_CONFIG.routes.login} className="font-medium text-accent hover:underline">
            Sign in
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
              {isEmailExisting && (
                <Link
                  to={AUTH_CONFIG.routes.login}
                  state={{ email }}
                  className="btn-primary text-xs py-1.5 px-3 self-start mt-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
                >
                  Go to Login →
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="register-fullName" className="block text-xs font-semibold text-ink mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="register-fullName"
                type="text"
                autoComplete="name"
                disabled={isSubmitting}
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value)
                  if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: undefined }))
                }}
                className={`input text-sm w-full py-2.5 px-3 rounded-lg border ${
                  fieldErrors.fullName ? 'border-red-400 bg-red-50/20' : 'border-line'
                } focus:outline-none focus:border-accent`}
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="register-email" className="block text-xs font-semibold text-ink mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                placeholder="you@domain.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }))
                  if (generalError) setGeneralError('')
                }}
                className={`input text-sm w-full py-2.5 px-3 rounded-lg border ${
                  fieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-line'
                } focus:outline-none focus:border-accent`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.email}</p>
              )}
              <p className="mt-1.5 text-[11px] text-muted">
                We will email a one-time verification code to this address.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="register-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 px-4 text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <span>Continue with Email Code →</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Security badge / note */}
        <p className="text-center text-[11px] text-muted mt-6">
          Passwordless & secure. Powered by Supabase Auth with Row Level Security.
        </p>
      </div>
    </div>
  )
}
