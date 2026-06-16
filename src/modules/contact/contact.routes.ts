import express from 'express';
import contactController from './contact.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import {
    createContactSubmissionSchema,
    updateContactSubmissionSchema,
    contactSubmissionIdParamsSchema,
    getContactSubmissionsQuerySchema,
} from './contact.validation.js';

const router = express.Router();

// ─── Public Routes ────────────────────────────────────────────────────────────────

// POST /contact/submit - Public endpoint for submitting contact forms
router.post(
    '/submit',
    validateRequest(createContactSubmissionSchema),
    contactController.submitContactForm
);

// ─── Authenticated Routes ────────────────────────────────────────────────────────────

// GET /contact/submissions - Get all contact submissions for the logged-in user
router.get(
    '/submissions',
    authenticate,
    validateRequest(getContactSubmissionsQuerySchema, 'query'),
    contactController.getContactSubmissions
);

// GET /contact/submissions/:id - Get a single contact submission
router.get(
    '/submissions/:id',
    authenticate,
    validateRequest(contactSubmissionIdParamsSchema, 'params'),
    contactController.getContactSubmissionById
);

// PATCH /contact/submissions/:id - Update contact submission status
router.patch(
    '/submissions/:id',
    authenticate,
    validateRequest(contactSubmissionIdParamsSchema, 'params'),
    validateRequest(updateContactSubmissionSchema),
    contactController.updateContactSubmission
);

// DELETE /contact/submissions/:id - Delete a contact submission
router.delete(
    '/submissions/:id',
    authenticate,
    validateRequest(contactSubmissionIdParamsSchema, 'params'),
    contactController.deleteContactSubmission
);

// GET /contact/stats - Get contact submission stats for the user
router.get(
    '/stats',
    authenticate,
    contactController.getContactStats
);

export default router;
