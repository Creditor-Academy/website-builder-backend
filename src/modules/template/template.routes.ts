import express from 'express';
import templateController from './template.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import {
    createWebsiteTemplateSchema,
    updateWebsiteTemplateSchema,
    templateIdParamsSchema,
} from './template.validation.js';
import { UserRole } from '@prisma/client';

const router = express.Router();

// ─── Website Template Routes ──────────────────────────────────────────────────

// GET /templates/websites — auth required
router.get('/websites', authenticate, templateController.getAllWebsiteTemplates);

// GET /templates/websites/:id — admin only
router.get(
    '/websites/:id',
    authenticate,
    authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(templateIdParamsSchema, 'params'),
    templateController.getWebsiteTemplateById
);

// POST /templates/websites — admin only
router.post(
    '/websites',
    authenticate,
    authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(createWebsiteTemplateSchema),
    templateController.createWebsiteTemplate
);

// PATCH /templates/websites/:id — admin only
router.patch(
    '/websites/:id',
    authenticate,
    authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(templateIdParamsSchema, 'params'),
    validateRequest(updateWebsiteTemplateSchema),
    templateController.updateWebsiteTemplate
);

// DELETE /templates/websites/:id — admin only (soft delete)
router.delete(
    '/websites/:id',
    authenticate,
    authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(templateIdParamsSchema, 'params'),
    templateController.deleteWebsiteTemplate
);

// POST /templates/websites/:id/restore — admin only
router.post(
    '/websites/:id/restore',
    authenticate,
    authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(templateIdParamsSchema, 'params'),
    templateController.restoreWebsiteTemplate
);

export default router;