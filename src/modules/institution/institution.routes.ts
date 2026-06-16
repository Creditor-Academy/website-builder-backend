import { Router } from 'express';
import InstitutionController from './institution.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// All organization management routes are restricted to SUPER_ADMIN
router.use(authenticate);

// Restricted access by role in each route
router.post('/', authorize(['SUPER_ADMIN']), InstitutionController.create);
router.get('/', authorize(['SUPER_ADMIN']), InstitutionController.list);
router.get('/detailed', authorize(['SUPER_ADMIN', 'INSTITUTION_ADMIN']), InstitutionController.listDetailed);
router.get('/:id', authorize(['SUPER_ADMIN']), InstitutionController.getById);
router.put('/:id', authorize(['SUPER_ADMIN', 'INSTITUTION_ADMIN']), InstitutionController.update);
router.delete('/:id', authorize(['SUPER_ADMIN']), InstitutionController.delete);

export default router;
