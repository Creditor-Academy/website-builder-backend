import express from 'express';
import WebsiteController from './website.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { requireWebsiteOwnership } from '../../middlewares/resource-access.middleware.js';
import {
    createWebsiteSchema,
    domainSchema,
    listWebsitesQuerySchema,
    publishWebsiteSchema,
    rollbackDeploymentSchema,
    updateWebsiteSchema,
    websiteIdParamsSchema,
    updateWebsiteSettingsSchema,
} from './website.validation.js';
import { UserRole } from '@prisma/client';
import { rateLimiting } from '../../middlewares/rate-limiting.middleware.js';
import { CREATE_WEB_LIMIT, DUPLICATE_WEB_LIMIT } from '../../constants/website.constants.js';

const router = express.Router();
const websiteController = new WebsiteController();

// All routes require authentication
router.use(authenticate);

// POST /websites - Create a new website
router.post(
    '/',
    validateRequest(createWebsiteSchema),
    rateLimiting('CREATE-WEB', CREATE_WEB_LIMIT),
    websiteController.createWebsite
);

// GET /websites - List my websites
router.get(
    '/',
    validateRequest(listWebsitesQuerySchema, 'query'),
    websiteController.listWebsites
);

// GET /websites/all - List all websites (Admin / Institution Admin)
router.get(
    '/all',
    authorize([UserRole.ADMIN, UserRole.INSTITUTION_ADMIN]),
    validateRequest(listWebsitesQuerySchema, 'query'),
    websiteController.listAllWebsites
);

// GET /websites/:id - Get single website by ID
router.get(
    '/:id',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.getWebsiteById
);

// PATCH /websites/:id - Update website
router.patch(
    '/:id',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(updateWebsiteSchema),
    requireWebsiteOwnership,
    websiteController.updateWebsite
);

// DELETE /websites/:id - Delete website (Soft)
router.delete(
    '/:id',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.deleteWebsite
);

// POST /websites/:id/restore - Restore website
router.post(
    '/:id/restore',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.restoreWebsite
);

// POST /websites/:id/duplicate - Duplicate website
router.post(
    '/:id/duplicate',
    validateRequest(websiteIdParamsSchema, 'params'),
    rateLimiting('DUPLICATE-WEB', DUPLICATE_WEB_LIMIT),
    requireWebsiteOwnership,
    websiteController.duplicateWebsite
);

// PATCH /websites/:id/settings - Update website settings
router.patch(
    '/:id/settings',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(updateWebsiteSettingsSchema),
    requireWebsiteOwnership,
    websiteController.updateWebsiteSettings
);

router.get(
    '/:id/versions',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.getWebsiteVersions
);

router.post(
    '/:id/publish',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(publishWebsiteSchema),
    requireWebsiteOwnership,
    websiteController.publishWebsite
);

router.get(
    '/:id/deployments',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.getDeployments
);

router.post(
    '/:id/deployments/rollback',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(rollbackDeploymentSchema),
    requireWebsiteOwnership,
    websiteController.rollbackDeployment
);



router.get(
    '/:id/export',
    validateRequest(websiteIdParamsSchema, 'params'),
    requireWebsiteOwnership,
    websiteController.exportWebsite
);

export default router;
