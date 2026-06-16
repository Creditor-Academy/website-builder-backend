import express from 'express';
import UserController from './user.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import {
  updateOwnProfileSchema,
  changePasswordSchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
  createUserSchema,
} from './user.validation.js';
import { UserRole } from '@prisma/client';

const router = express.Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// GET /users/me - Get own profile (all authenticated users)
router.get('/me', userController.getProfile);

// PUT /users/me - Update own profile (all authenticated users)
router.put(
  '/me',
  validateRequest(updateOwnProfileSchema),
  userController.updateOwnProfile
);

// PATCH /users/me/change-password - Change own password (all authenticated users)
router.post(
  '/me/change-password',
  validateRequest(changePasswordSchema),
  userController.changePassword
);

// DELETE /users/me - own Account Deactivation
router.delete(
  '/me',
  userController.deactivateAccount
);

// POST / - Create new user (Admin/Institution Admin only)
router.post(
  '/',
  authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
  validateRequest(createUserSchema),
  userController.createUser
);

// GET /users - List users (Admin/Institution Admin only)
router.get(
  '/',
  authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
  validateRequest(listUsersQuerySchema, 'query'),
  userController.listUsers
);

// GET /users/:id - Get user by ID (Admin/Institution Admin only)
router.get(
  '/:id',
  authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
  validateRequest(userIdParamsSchema, 'params'),
  userController.getUserById
);

// PATCH /users/:id/role - Update user role (Admin only - Platform level)
router.patch(
  '/:id/role',
  authorize([UserRole.ADMIN]),
  validateRequest(userIdParamsSchema, 'params'),
  validateRequest(updateUserRoleSchema),
  userController.updateUserRole
);

// PATCH /users/:id/status - Suspend/Reactivate user (Admin/Institution Admin only)
router.patch(
  '/:id/status',
  authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
  validateRequest(userIdParamsSchema, 'params'),
  validateRequest(updateUserStatusSchema),
  userController.updateUserStatus
);

// DELETE /users/:id - Restore User (Admin/Institution Admin only)
router.post(
  '/:id/restore',
  authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
  validateRequest(userIdParamsSchema, 'params'),
  userController.restoreUser
);

export default router;
