import { z } from 'zod';

// Register schema
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),

  email: z.string()
    .pipe(z.email('Invalid email address')),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(32, 'Password must not exceed 32 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Login schema
export const loginSchema = z.object({
  email: z.string()
    .pipe(z.email('Invalid email address')),

  password: z.string()
    .min(1, 'Password is required'),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string()
    .pipe(z.email('Invalid email address')),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string()
    .min(1, 'Token is required'),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(32, 'Password must not exceed 32 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Email verification schema (query params)
export const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Google auth schema
export const googleAuthSchema = z.object({
  token: z.string().min(1, 'Google access token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;