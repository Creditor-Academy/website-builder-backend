import express from 'express';
import AuthController from './auth.controller.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { rateLimiting } from '../../middlewares/rate-limiting.middleware.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailVerificationSchema,
  googleAuthSchema,
} from './auth.validation.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { FORGOT_PW_LIMIT, LOGIN_LIMIT, REFRESH_LIMIT } from '../../constants/auth.constants.js';

const router = express.Router();
const authController = new AuthController();

// POST /auth/register - Register a new user
router.post(
  '/register',
  validateRequest(registerSchema),
  rateLimiting('REGISTER', { LIMIT: 5, WINDOW_SEC: 900 }),
  authController.register
);

// POST /auth/login - Login user
router.post(
  '/login',
  validateRequest(loginSchema),
  rateLimiting('LOGIN', LOGIN_LIMIT),
  authController.login
);

// GET /auth/logout - Logout user
router.get(
  '/logout',
  authenticate,
  authController.logout
);

// POST /auth/forgot-password - Request password reset
router.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  rateLimiting('FORGOT-PW', FORGOT_PW_LIMIT),
  authController.forgotPassword
);

// POST /auth/reset-password - Reset password with token
router.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

// GET /auth/email-verification - Verify email with token
router.get(
  '/email-verification',
  validateRequest(emailVerificationSchema, 'query'),
  authController.verifyEmail
);

// POST /auth/refresh-token - Refresh access token
router.post(
  '/refresh-token',
  rateLimiting('REFRESH', REFRESH_LIMIT),
  authController.refreshToken
);

// POST /auth/google - Google OAuth login
router.post(
  '/google',
  validateRequest(googleAuthSchema),
  rateLimiting('GOOGLE-AUTH', { LIMIT: 10, WINDOW_SEC: 900 }),
  authController.googleAuth
);

export default router;
