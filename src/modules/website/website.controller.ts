import type { NextFunction, Request, Response } from 'express';
import WebsiteService from './website.service.js';
import archiver from 'archiver';
import { generateStaticSite } from '../../services/static-site-generator.js';

class WebsiteController {
    private websiteService: WebsiteService;

    constructor() {
        this.websiteService = new WebsiteService();
    }

    // POST /websites - Create a new website
    createWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.context.user.id;
            const institutionId = req.validated.body.institution_id || req.context.user.institution_id;
            const website = await this.websiteService.createWebsite(userId, institutionId, req.validated.body);
            res.status(201).json({ message: 'Website created successfully', website });
        } catch (error: any) {
            next(error);
        }
    }

    // GET /websites - List my websites
    listWebsites = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const websites = await this.websiteService.listWebsites(req.context.user, req.validated.query);
            res.status(200).json({ websites });
        } catch (error: any) {
            next(error);
        }
    }

    // GET /websites/all - List all websites
    listAllWebsites = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const websites = await this.websiteService.listAllWebsites(req.context.user, req.validated.query);
            res.status(200).json({ websites });
        } catch (error: any) {
            next(error);
        }
    }

    // GET /websites/:id - Get single website by ID
    getWebsiteById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const data = await this.websiteService.getSingleWebsite(website);
            return res.status(200).json({ data });
        } catch (error: any) {
            next(error);
        }
    }

    // PATCH /websites/:id - Update website
    updateWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const updatedWebsite = await this.websiteService.updateWebsite(website, req.validated.body);
            return res.status(200).json({ message: 'Website updated successfully', website: updatedWebsite });
        } catch (error: any) {
            next(error);
        }
    }

    // DELETE /websites/:id - Soft Delete Website
    deleteWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            await this.websiteService.deleteWebsite(website);
            return res.status(200).json({ message: 'Website deleted successfully' });
        } catch (error: any) {
            next(error);
        }
    }

    // POST /websites/:id/restore - Restore Website
    restoreWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            await this.websiteService.restoreWebsite(website);
            return res.status(200).json({ message: 'Website restored successfully' });
        } catch (error: any) {
            next(error);
        }
    }

    // POST /websites/:id/duplicate - Duplicate Website
    duplicateWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const duplicated = await this.websiteService.duplicateWebsite(website);
            return res.status(200).json({ message: 'Website duplicated successfully', website: duplicated });
        } catch (error: any) {
            next(error);
        }
    }

    // PATCH /websites/:id/settings - Update Website Settings
    updateWebsiteSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const settings = await this.websiteService.updateWebsiteSettings(website, req.validated.body);
            return res.status(200).json({ message: 'Website settings updated successfully', settings });
        } catch (error: any) {
            next(error);
        }
    }

    getWebsiteVersions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const versions = await this.websiteService.getWebsiteVersions(website);
            return res.status(200).json({ versions });
        } catch (error: any) {
            next(error);
        }
    }

    publishWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const userId = req.context.user.id;
            const result = await this.websiteService.publishWebsite(website, req.validated.body, userId);
            return res.status(200).json(result);
        } catch (error: any) {
            next(error);
        }
    }

    getDeployments = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const deployments = await this.websiteService.getDeployments(website);
            return res.status(200).json({ deployments });
        } catch (error: any) {
            next(error);
        }
    }

    rollbackDeployment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const userId = req.context.user.id;
            const { deploymentId } = req.validated.body;
            const result = await this.websiteService.rollbackDeployment(website, deploymentId, userId);
            return res.status(200).json(result);
        } catch (error: any) {
            next(error);
        }
    }

    getDomains = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const domains = await this.websiteService.getDomains(website);
            return res.status(200).json({ domains });
        } catch (error: any) {
            next(error);
        }
    }

    addDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const domain = await this.websiteService.addDomain(website, req.validated.body);
            return res.status(201).json({ domain });
        } catch (error: any) {
            next(error);
        }
    }

    removeDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            await this.websiteService.removeDomain(website, req.validated.body);
            return res.status(200).json({ message: 'Domain removed successfully' });
        } catch (error: any) {
            next(error);
        }
    }

    verifyDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const verification = await this.websiteService.verifyDomain(website, req.validated.body);
            return res.status(200).json(verification);
        } catch (error: any) {
            next(error);
        }
    }

    exportWebsite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const website = req.context.website!;
            const content = website.content as Record<string, any> || {};
            const siteName = (website as any).name || 'website';
            const files = generateStaticSite(content, siteName, website.id);

            const safeName = siteName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('error', (err) => next(err));
            archive.pipe(res);

            for (const file of files) {
                archive.append(file.html, { name: file.filename });
            }

            await archive.finalize();
        } catch (error: any) {
            next(error);
        }
    }
}

export default WebsiteController;