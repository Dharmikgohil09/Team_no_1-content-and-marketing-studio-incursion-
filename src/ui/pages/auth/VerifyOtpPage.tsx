import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AuthService } from '../../../services/authService'
import { useAuthStore } from '../../../store/authStore'
import { AUTH_CONFIG } from '../../../config/auth'

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, pendingAuth, clearPendingAuth } = useAuthStore()

  // Retrieve auth context from route state or pending store
  const stateData = location.state as { email?: string; flow?: 'register' | 'login'; fullName?: string; from?: any } | null
  const email = stateData?.email || pendingAuth?.email || ''
  const flow = stateData?.flow || pendingAuth?.flow || 'login'
  const fullName = stateData?.fullName || pendingAuth?.fullName || ''
  const destination = stateData?.from?.pathname || AUTH_CONFIG.routes.defaultRedirect

  const otpLength = AUTH_CONFIG.otpLength
  const [digits, setDigits] = useState<string[]>(() => Array(otpLength).fill(''))
  const [errorMsg, setErrorMsg] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(AUTH_CONFIG.resendCooldownSeconds)
  const [attempts, setAttempts] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // If user gets authenticated via email confirmation link, auto-redirect immediately!
  useEffect(() => {
    if (user) {
      clearPendingAuth()
      navigate(destination, { replace: true })
    }
  }, [user, navigate, destination, clearPendingAuth])

  // If no email is available, redirect to Login
  useEffect(() => {
    if (!email && !user) {
      navigate(AUTH_CONFIG.routes.login, { replace: true })
    }
  }, [email, user, navigate])

  // Focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Handle single digit input
  function handleDigitChange(index: number, value: string) {
    setErrorMsg('')
    const cleanChar = value.replace(/\D/g, '')

    // If multi-char string pasted into single box
    if (cleanChar.length > 1) {
      handlePasteString(cleanChar)
      return
    }

    const updated = [...digits]
    updated[index] = cleanChar ? cleanChar.slice(-1) : ''
    setDigits(updated)

    // Auto-advance to next input if filled
    if (cleanChar && index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit if all digits are filled
    const fullCode = updated.join('')
    if (fullCode.length === otpLength && !updated.includes('')) {
      submitOtpCode(fullCode)
    }
  }

  // Handle backspace navigation
  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Handle clipboard paste
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    handlePasteString(pasted)
  }

  function handlePasteString(str: string) {
    const numericOnly = str.replace(/\D/g, '').slice(0, otpLength)
    if (!numericOnly) return

    const updated = Array(otpLength).fill('')
    for (let i = 0; i < numericOnly.length; i++) {
      updated[i] = numericOnly[i]
    }
    setDigits(updated)

    const nextFocusIndex = Math.min(numericOnly.length, otpLength - 1)
    inputRefs.current[nextFocusIndex]?.focus()

    if (numericOnly.length === otpLength) {
      submitOtpCode(numericOnly)
    }
  }

  // Verify OTP submission
  async function submitOtpCode(codeToVerify: string) {
    if (attempts >= AUTH_CONFIG.maxOtpAttempts) {
      setErrorMsg(AUTH_CONFIG.messages.otpMaxAttempts)
      return
    }

    if (codeToVerify.length !== otpLength) {
      setErrorMsg(`Please enter the complete ${otpLength}-digit code.`)
      return
    }

    setIsVerifying(true)
    setErrorMsg('')

    try {
      // Verify OTP via AuthService
      const { user } = await AuthService.verifyOtp(email, codeToVerify, fullName)

      if (!user) {
        throw new Error(AUTH_CONFIG.messages.otpInvalid)
      }

      // Successful verification
      clearPendingAuth()
      navigate(destination, { replace: true })
    } catch (err: any) {
      setAttempts(prev => prev + 1)
      const currentAttempts = attempts + 1
      if (currentAttempts >= AUTH_CONFIG.maxOtpAttempts) {
        setErrorMsg(AUTH_CONFIG.messages.otpMaxAttempts)
      } else {
        setErrorMsg(err.message || AUTH_CONFIG.messages.otpInvalid)
      }
    } finally {
      setIsVerifying(false)
    }
  }

  // Resend OTP code
  async function handleResendCode() {
    if (cooldown > 0 || isResending) return

    setIsResending(true)
    setErrorMsg('')
    setSuccessNotice('')

    try {
      if (flow === 'register') {
        await AuthService.sendRegistrationOtp(email, fullName)
      } else {
        await AuthService.sendLoginOtp(email)
      }

      setCooldown(AUTH_CONFIG.resendCooldownSeconds)
      setAttempts(0)
      setDigits(Array(otpLength).fill(''))
      inputRefs.current[0]?.focus()
      setSuccessNotice(AUTH_CONFIG.messages.otpSent)
      setTimeout(() => setSuccessNotice(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || AUTH_CONFIG.messages.genericError)
    } finally {
      setIsResending(false)
    }
  }

  const currentCode = digits.join('')
  const isCodeComplete = currentCode.length === otpLength && !digits.includes('')

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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Check your email</h1>
        <p className="mt-2 text-xs text-muted max-w-sm mx-auto">
          We sent a verification link and code to{' '}
          <span className="font-semibold text-ink break-all">{email}</span>.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass p-6 sm:p-8">
          {/* Primary Action: Confirmation link callout banner */}
          <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20 text-center flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ✉
            </div>
            <h2 className="text-sm font-bold text-ink">Confirmation link sent!</h2>
            <p className="text-xs text-muted leading-relaxed">
              Open your email and click <strong className="text-ink">"Confirm your mail"</strong> to complete registration and log in instantly.
            </p>
          </div>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
              <span className="bg-bg px-2.5 text-muted rounded">Or enter code manually</span>
            </div>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Notice */}
          {successNotice && (
            <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{successNotice}</span>
            </div>
          )}

          <form
            onSubmit={e => {
              e.preventDefault()
              submitOtpCode(currentCode)
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-xs font-semibold text-ink text-center mb-3">
                {otpLength}-Digit Verification Code (if provided in email)
              </label>

              {/* Segmented Digit Inputs */}
              <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (inputRefs.current[idx] = el)}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    disabled={isVerifying}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold font-mono text-ink rounded-lg border bg-surface-900/10 transition-all ${
                      digit ? 'border-accent bg-accent/5' : 'border-line'
                    } focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20`}
                  />
                ))}
              </div>
            </div>

            {/* Verify Button */}
            <div>
              <button
                id="verify-submit-btn"
                type="submit"
                disabled={isVerifying || !isCodeComplete || attempts >= AUTH_CONFIG.maxOtpAttempts}
                className="btn-primary w-full py-2.5 px-4 text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Verifying code...</span>
                  </>
                ) : (
                  <span>Verify & Continue →</span>
                )}
              </button>
            </div>
          </form>

          {/* Resend & Cooldown Section */}
          <div className="mt-6 pt-5 border-t border-line text-center flex flex-col items-center gap-2">
            <span className="text-xs text-muted">Didn't receive the email code?</span>
            <button
              id="resend-otp-btn"
              type="button"
              disabled={cooldown > 0 || isResending}
              onClick={handleResendCode}
              className={`text-xs font-semibold transition-colors ${
                cooldown > 0
                  ? 'text-muted cursor-not-allowed'
                  : 'text-accent hover:text-accent-hover hover:underline'
              }`}
            >
              {isResending
                ? 'Sending new code...'
                : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : 'Resend verification code'}
            </button>
            {attempts > 0 && attempts < AUTH_CONFIG.maxOtpAttempts && (
              <span className="text-[11px] text-slate-400">
                Attempts remaining: {AUTH_CONFIG.maxOtpAttempts - attempts}
              </span>
            )}
          </div>
        </div>

        {/* Change email link */}
        <p className="text-center text-xs text-muted mt-5">
          Wrong email?{' '}
          <Link
            to={flow === 'register' ? AUTH_CONFIG.routes.register : AUTH_CONFIG.routes.login}
            className="text-accent hover:underline font-medium"
          >
            Change email address
          </Link>
        </p>
      </div>
    </div>
  )
}
