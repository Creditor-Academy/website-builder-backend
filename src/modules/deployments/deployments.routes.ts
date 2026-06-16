import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { getAllDeployments, getDeploymentStats } from './deployments.controller.js';

const router = Router();

// All endpoints require admin auth
router.use(authenticate);
router.use(authorize(['ADMIN', 'SUPER_ADMIN', 'INSTITUTION_ADMIN']));

router.get('/', getAllDeployments);
router.get('/stats', getDeploymentStats);

export default router;
