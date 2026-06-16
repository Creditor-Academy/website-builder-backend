import { Router } from 'express';
import StatsController from './stats.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Stats require authentication but roles are handled in the controller
router.get('/dashboard', authenticate, StatsController.getDashboardStats);

export default router;
