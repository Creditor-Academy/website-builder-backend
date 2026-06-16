import type { Request, Response, NextFunction } from 'express';
import WebsiteDao from '../modules/website/website.dao.js';
import { UserRole } from '@prisma/client';

const websiteDao = new WebsiteDao();

/**
 * User Resource Access Middleware
 * Verifies user resource and access to it
 */
export const requireWebsiteOwnership = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.context.user;
        const websiteId = req.validated.params.id;

        const website = await websiteDao.findWebsiteById(websiteId);
        if (!website) return res.status(404).json({ error: "Website not found" });

        const isAuthorized = user.role === UserRole.SUPER_ADMIN || 
                             user.role === UserRole.ADMIN ||
                             (user.role === UserRole.INSTITUTION_ADMIN && website.institution_id === user.institution_id) ||
                             website.owner_id === user.id;

        if (!isAuthorized) {
            // User is neither ADMIN/SUPER_ADMIN nor owner of the resource
            return res.status(403).json({ error: "Access Denied" });
        }

        req.context.website = website;
        next();
    } catch (error: any) {
        console.error("Website Access Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}