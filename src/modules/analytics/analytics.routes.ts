import { Router } from 'express';
import { trackPageView, getWebsiteAnalytics } from './analytics.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Public — called by the tracking pixel in published sites
router.post('/track', trackPageView);

// Private — dashboard analytics for a website
router.get('/websites/:websiteId', authenticate, getWebsiteAnalytics);

export default router;
