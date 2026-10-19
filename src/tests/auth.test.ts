import { describe, it, expect } from 'vitest'
import { RegisterSchema, LoginSchema, VerifyOtpSchema } from '../core/schema/AuthSchemas'
import { AUTH_CONFIG } from '../config/auth'

describe('Authentication & Profile Schemas', () => {
  describe('RegisterSchema', () => {
    it('validates correct registration data', () => {
      const valid = { fullName: 'Aarav Sharma', email: 'aarav@svnit.ac.in' }
      const res = RegisterSchema.safeParse(valid)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.fullName).toBe('Aarav Sharma')
        expect(res.data.email).toBe('aarav@svnit.ac.in')
      }
    })

    it('rejects short names', () => {
      const invalid = { fullName: 'A', email: 'valid@example.com' }
      const res = RegisterSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error.issues[0].message).toBe(AUTH_CONFIG.messages.nameRequired)
      }
    })

    it('rejects invalid emails', () => {
      const invalid = { fullName: 'John Doe', email: 'invalid-email-string' }
      const res = RegisterSchema.safeParse(invalid)
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error.issues[0].message).toBe(AUTH_CONFIG.messages.invalidEmail)
      }
    })
  })

  describe('LoginSchema', () => {
    it('validates correct login email', () => {
      const valid = { email: 'user@domain.com' }
      const res = LoginSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('rejects malformed email', () => {
      const invalid = { email: 'not-an-email' }
      const res = LoginSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })
  })

  describe('VerifyOtpSchema', () => {
    it('validates exact OTP code length based on config', () => {
      const correctCode = '123456'.slice(0, AUTH_CONFIG.otpLength).padEnd(AUTH_CONFIG.otpLength, '0')
      const valid = { email: 'user@domain.com', otp: correctCode }
      const res = VerifyOtpSchema.safeParse(valid)
      expect(res.success).toBe(true)
    })

    it('rejects non-numeric characters in OTP code', () => {
      const invalid = { email: 'user@domain.com', otp: '12AB56'.slice(0, AUTH_CONFIG.otpLength) }
      const res = VerifyOtpSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })

    it('rejects incomplete OTP code', () => {
      const invalid = { email: 'user@domain.com', otp: '123' }
      const res = VerifyOtpSchema.safeParse(invalid)
      expect(res.success).toBe(false)
    })
  })

  describe('AUTH_CONFIG', () => {
    it('has non-hardcoded sensible defaults', () => {
      expect(AUTH_CONFIG.otpLength).toBeGreaterThanOrEqual(4)
      expect(AUTH_CONFIG.resendCooldownSeconds).toBeGreaterThan(0)
      expect(AUTH_CONFIG.maxOtpAttempts).toBeGreaterThan(0)
      expect(AUTH_CONFIG.routes.login).toBe('/login')
      expect(AUTH_CONFIG.routes.register).toBe('/register')
      expect(AUTH_CONFIG.routes.verifyOtp).toBe('/verify-otp')
      expect(AUTH_CONFIG.routes.defaultRedirect).toBeDefined()
    })
  })
})
