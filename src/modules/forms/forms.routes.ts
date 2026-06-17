import { Router } from 'express';
import { FormsController } from './forms.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireWebsiteOwnership } from '../../middlewares/resource-access.middleware.js';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { 
  submitFormSchema, 
  getSubmissionsQuerySchema, 
  formIdParamsSchema, 
  websiteIdParamsSchema 
} from './forms.validation.js';

const router = Router();
const controller = new FormsController();

// POST /forms/submit — Public endpoint for published site form submissions
// Does not require authentication or CSRF
router.post('/submit', 
  validateRequest(submitFormSchema),
  controller.submitForm
);

// GET /forms/submissions — List all submissions for a user (can filter by websiteId)
router.get('/submissions',
  authenticate,
  validateRequest(getSubmissionsQuerySchema, 'query'),
  controller.getUserSubmissions
);

// GET /forms/stats — Get submission stats
router.get('/stats',
  authenticate,
  controller.getUserStats
);

// PATCH /forms/:id/read — Mark submission as read
router.patch('/:id/read',
  authenticate,
  validateRequest(formIdParamsSchema, 'params'),
  controller.markAsRead
);

// DELETE /forms/:id — Delete a submission
router.delete('/:id',
  authenticate,
  validateRequest(formIdParamsSchema, 'params'),
  controller.deleteSubmission
);

export default router;
