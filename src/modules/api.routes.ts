import { Router } from "express";
import authRoutes from "./auth/auth.routes.js";
import userRoutes from "./user/user.routes.js";
import websiteRoutes from "./website/website.routes.js";
import institutionRoutes from "./institution/institution.routes.js";
import statsRoutes from "./stats/stats.routes.js";
import templateRoutes from "./template/template.routes.js";
import contactRoutes from "./contact/contact.routes.js";  
import assetsRoutes from './assets/assets.routes.js';
import formsRoutes from './forms/forms.routes.js';
import analyticsRoutes from './analytics/analytics.routes.js';
import deploymentsRoutes from './deployments/deployments.routes.js';
import domainRoutes from './domain/domain.routes.js';

const router = Router();

// Register all module routes here
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/websites', websiteRoutes);
router.use('/organizations', institutionRoutes);
router.use('/stats', statsRoutes);
router.use('/templates', templateRoutes);  
router.use('/contact', contactRoutes);
router.use('/assets', assetsRoutes);
router.use('/forms', formsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/deployments', deploymentsRoutes);
router.use('/domains', domainRoutes);

export default router;