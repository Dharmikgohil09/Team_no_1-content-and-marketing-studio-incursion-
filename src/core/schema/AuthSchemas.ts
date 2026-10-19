import { z } from 'zod'
import { AUTH_CONFIG } from '../../config/auth'

export const RegisterSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: AUTH_CONFIG.messages.nameRequired })
    .max(100, { message: 'Full name cannot exceed 100 characters.' }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: AUTH_CONFIG.messages.invalidEmail }),
})

export type RegisterFormData = z.infer<typeof RegisterSchema>

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: AUTH_CONFIG.messages.invalidEmail }),
})

export type LoginFormData = z.infer<typeof LoginSchema>

export const VerifyOtpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${AUTH_CONFIG.otpLength}}$`), {
      message: `Verification code must be exactly ${AUTH_CONFIG.otpLength} digits.`,
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: AUTH_CONFIG.messages.invalidEmail }),
})

export type VerifyOtpFormData = z.infer<typeof VerifyOtpSchema>
