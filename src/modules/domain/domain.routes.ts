import { Router } from 'express';
import DomainController from './domain.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import {
    websiteIdParamsSchema,
    domainIdParamsSchema,
    addSubdomainSchema,
    addCustomDomainSchema,
} from './domain.validation.js';

const router = Router();
const controller = new DomainController();

// All domain routes require authentication
router.use(authenticate);

// ─── Website-scoped routes ──────────────────────────────────────────────────

// GET /domains/website/:websiteId — List domains for a website
router.get(
    '/website/:websiteId',
    validateRequest(websiteIdParamsSchema, 'params'),
    controller.listDomains,
);

// POST /domains/website/:websiteId/subdomain — Register a platform subdomain
router.post(
    '/website/:websiteId/subdomain',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(addSubdomainSchema),
    controller.addSubdomain,
);

// POST /domains/website/:websiteId/custom — Start custom domain flow (ACM + DNS)
router.post(
    '/website/:websiteId/custom',
    validateRequest(websiteIdParamsSchema, 'params'),
    validateRequest(addCustomDomainSchema),
    controller.addCustomDomain,
);

// ─── Domain-scoped routes ───────────────────────────────────────────────────

// POST /domains/:domainId/verify — Check cert status & provision CloudFront
router.post(
    '/:domainId/verify',
    validateRequest(domainIdParamsSchema, 'params'),
    controller.verifyDomain,
);

// DELETE /domains/:domainId — Remove a domain (requires ?websiteId= query param)
router.delete(
    '/:domainId',
    validateRequest(domainIdParamsSchema, 'params'),
    controller.removeDomain,
);

export default router;
