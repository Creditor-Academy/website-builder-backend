import { z } from 'zod';
import { UserRole } from '@prisma/client';

const UserRoleValues = Object.values(UserRole);

// Update own profile schema
export const updateOwnProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .optional(),
});

// Change password schema
export const changePasswordSchema = z.object({
  oldPassword: z.string()
    .min(1, 'Old password is required'),

  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(32, 'Password must not exceed 32 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// List users query schema
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),

  search: z.string().optional(),
  role: z.enum(UserRoleValues).optional(),
  institution_id: z.string().optional(),

  isActive: z.enum(['true', 'false'], {
    message: 'isActive filter must be a boolean value',
  })
    .transform(val => val === 'true').optional(),

  isVerified: z.enum(['true', 'false'], {
    message: 'isVerified filter must be a boolean value',
  })
    .transform(val => val === 'true').optional(),

  created_after: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'created_after must be a valid date string',
  })
    .optional(),
});

// Update user role schema
export const updateUserRoleSchema = z.object({
  role: z.enum(UserRoleValues, {
    error: () => ({ message: `Invalid user role` }),
  }),
});

// Update user status schema
export const updateUserStatusSchema = z.object({
  active: z.enum(['true', 'false'], {
    message: 'Active status must be a boolean value',
  })
    .transform(val => val === 'true')
});

// Create user schema
export const createUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(32, 'Password must not exceed 32 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(UserRoleValues).optional().default(UserRole.USER),
  institution_id: z.string().optional(),
});

// User Id params schema
export const userIdParamsSchema = z.object({
  id: z.string().cuid('Invalid user ID format')
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;