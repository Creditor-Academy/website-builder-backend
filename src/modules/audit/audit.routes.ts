import express from 'express';
import AuditController from './audit.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { getAuditLogsQuerySchema } from './audit.validation.js';
import { UserRole } from '@prisma/client';

const router = express.Router();
const controller = new AuditController();

// Audit logs are highly sensitive; require authentication
router.use(authenticate);

// Only ADMIN and SUPER_ADMIN can fetch audit logs
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  validateRequest(getAuditLogsQuerySchema, 'query'),
  controller.getLogs
);

export default router;
