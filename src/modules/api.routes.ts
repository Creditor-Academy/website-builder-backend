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
import auditRoutes from './audit/audit.routes.js';
import { doubleCsrfProtection, generateToken, invalidCsrfTokenError } from '../middlewares/csrf.middleware.js';

const router = Router();

// Apply a baseline global rate limit to all API routes
import { rateLimiting } from '../middlewares/rate-limiting.middleware.js';
router.use(rateLimiting('GLOBAL', { LIMIT: 150, WINDOW_SEC: 60 }));

// Provide CSRF token to frontend
router.get('/csrf-token', (req, res) => {
    return res.json({ token: generateToken(req, res) });
});

// Conditionally apply CSRF protection
router.use((req, res, next) => {
    // Endpoints called by published websites and auth endpoints bypass CSRF
    const bypassPaths = ['/analytics/track', '/forms/submit', '/contact/submit', '/auth/login', '/auth/register', '/auth/google', '/auth/forgot-password', '/auth/reset-password'];
    if (bypassPaths.some(p => req.path.startsWith(p))) {
        return next();
    }
    
    // Apply CSRF protection for all other API paths
    doubleCsrfProtection(req, res, (err) => {
        if (err) {
            if (err === invalidCsrfTokenError) {
                console.error('[CSRF Error] Path:', req.path);
                console.error('[CSRF Error] Headers x-csrf-token:', req.headers['x-csrf-token']);
                console.error('[CSRF Error] Cookies:', req.cookies);
                return res.status(403).json({ error: 'invalid csrf token' });
            }
            return next(err);
        }
        next();
    });
});

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
router.use('/audit', auditRoutes);

export default router;