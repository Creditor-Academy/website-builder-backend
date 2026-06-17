import type { Request, Response } from 'express';
import { TemplateScope, UserRole } from '@prisma/client';
import templateDao from './template.dao.js';
import cacheService from '../../services/cache.service.js';

const canManageWebsiteTemplate = (template: any, user: Request['context']['user']) => {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        return true;
    }

    if (user.role === UserRole.INSTITUTION_ADMIN) {
        return template.scope === TemplateScope.INSTITUTION
            && !!template.institution_id
            && template.institution_id === user.institution_id;
    }

    return false;
};

const getTemplatePayloadForUser = (req: Request) => {
    const user = req.context.user;
    const body = req.body;

    if (user.role === UserRole.INSTITUTION_ADMIN) {
        if (!user.institution_id) {
            throw new Error('INSTITUTION_ADMIN must be assigned to an institution before managing templates');
        }
        return {
            ...body,
            scope: TemplateScope.INSTITUTION,
            institution_id: user.institution_id,
        };
    }

    return {
        ...body,
        scope: TemplateScope.GLOBAL,
        institution_id: null,
    };
};

class TemplateController {

    // ═══════════════════════════════════════════════════════════════════════════
    // WEBSITE TEMPLATES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * GET /templates/websites
     * Auth required — returns templates visible to the current user, grouped by category
     */
    getAllWebsiteTemplates = async (req: Request, res: Response) => {
        try {
            const cacheKey = `templates:websites:role=${req.context.user.role}:inst=${req.context.user.institution_id || 'none'}`;
            const cached = await cacheService.get(cacheKey);
            
            if (cached) {
                return res.status(200).json({
                    success: true,
                    data: cached,
                });
            }

            const templates = await templateDao.getVisibleWebsiteTemplates(req.context.user);

            // Group by category
            const grouped = templates.reduce((acc: Record<string, any[]>, t) => {
                const cat = t.category || 'General';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(t);
                return acc;
            }, {});

            await cacheService.set(cacheKey, grouped, 3600); // Cache for 1 hour

            res.status(200).json({
                success: true,
                data: grouped,
            });
        } catch (error) {
            console.error('[TemplateController] getAllWebsiteTemplates:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch templates' });
        }
    };

    /**
     * GET /templates/websites/:id
     * Admin only — full template data
     */
    getWebsiteTemplateById = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;
            const template = await templateDao.getWebsiteTemplateById(id);

            if (!template) {
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            if (!canManageWebsiteTemplate(template, req.context.user)) {
                return res.status(403).json({ success: false, message: 'You do not have permission to manage this template' });
            }

            res.status(200).json({ success: true, data: template });
        } catch (error) {
            console.error('[TemplateController] getWebsiteTemplateById:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch template' });
        }
    };

    /**
     * POST /templates/websites
     * Admin only — create a new website template
     */
    createWebsiteTemplate = async (req: Request, res: Response) => {
        try {
            const payload = getTemplatePayloadForUser(req);
            const template = await templateDao.createWebsiteTemplate(payload);

            res.status(201).json({ success: true, data: template });
        } catch (error: any) {
            console.error('[TemplateController] createWebsiteTemplate:', error);
            if (error?.message?.includes('must be assigned to an institution')) {
                return res.status(403).json({ success: false, message: error.message });
            }
            res.status(500).json({ success: false, message: 'Failed to create template' });
        }
    };

    /**
     * PATCH /templates/websites/:id
     * Admin only — update an existing website template
     */
    updateWebsiteTemplate = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const existing = await templateDao.getWebsiteTemplateById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            if (!canManageWebsiteTemplate(existing, req.context.user)) {
                return res.status(403).json({ success: false, message: 'You do not have permission to manage this template' });
            }

            const updated = await templateDao.updateWebsiteTemplate(id, getTemplatePayloadForUser(req));
            res.status(200).json({ success: true, data: updated });
        } catch (error: any) {
            console.error('[TemplateController] updateWebsiteTemplate:', error);
            if (error?.message?.includes('must be assigned to an institution')) {
                return res.status(403).json({ success: false, message: error.message });
            }
            res.status(500).json({ success: false, message: 'Failed to update template' });
        }
    };

    /**
     * DELETE /templates/websites/:id
     * Admin only — soft delete
     */
    deleteWebsiteTemplate = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const existing = await templateDao.getWebsiteTemplateById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            if (!canManageWebsiteTemplate(existing, req.context.user)) {
                return res.status(403).json({ success: false, message: 'You do not have permission to manage this template' });
            }

            await templateDao.deleteWebsiteTemplate(id);
            res.status(200).json({ success: true, message: 'Template deleted successfully' });
        } catch (error) {
            console.error('[TemplateController] deleteWebsiteTemplate:', error);
            res.status(500).json({ success: false, message: 'Failed to delete template' });
        }
    };

    /**
     * POST /templates/websites/:id/restore
     * Admin only — restore soft-deleted template
     */
    restoreWebsiteTemplate = async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const existing = await templateDao.getWebsiteTemplateById(id);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Template not found' });
            }

            if (!canManageWebsiteTemplate(existing, req.context.user)) {
                return res.status(403).json({ success: false, message: 'You do not have permission to manage this template' });
            }

            const restored = await templateDao.restoreWebsiteTemplate(id);
            res.status(200).json({ success: true, data: restored });
        } catch (error) {
            console.error('[TemplateController] restoreWebsiteTemplate:', error);
            res.status(500).json({ success: false, message: 'Failed to restore template' });
        }
    };

}

export default new TemplateController();