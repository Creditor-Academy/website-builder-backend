import type { NextFunction, Request, Response } from 'express';
import DomainService from './domain.service.js';

class DomainController {
    private domainService: DomainService;

    constructor() {
        this.domainService = new DomainService();
    }

    // GET /domains/website/:websiteId — List all domains for a website
    listDomains = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { websiteId } = req.validated.params;
            const domains = await this.domainService.listDomains(websiteId);
            res.status(200).json({ domains });
        } catch (error: any) {
            next(error);
        }
    }

    // POST /domains/website/:websiteId/subdomain — Register a platform subdomain
    addSubdomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { websiteId } = req.validated.params;
            const domain = await this.domainService.addSubdomain(websiteId, req.validated.body);
            res.status(201).json({
                message: 'Subdomain registered successfully',
                domain,
            });
        } catch (error: any) {
            next(error);
        }
    }

    // POST /domains/website/:websiteId/custom — Start custom domain flow
    addCustomDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { websiteId } = req.validated.params;
            const result = await this.domainService.addCustomDomain(websiteId, req.validated.body);
            res.status(201).json(result);
        } catch (error: any) {
            next(error);
        }
    }

    // POST /domains/:domainId/verify — Check certificate status & provision CDN
    verifyDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { domainId } = req.validated.params;
            const result = await this.domainService.verifyDomain(domainId);
            res.status(200).json(result);
        } catch (error: any) {
            next(error);
        }
    }

    // DELETE /domains/:domainId/website/:websiteId — Remove a domain
    removeDomain = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { domainId } = req.validated.params;
            const websiteId = req.validated.params.websiteId || req.query.websiteId as string;
            await this.domainService.removeDomain(domainId, websiteId);
            res.status(200).json({ message: 'Domain removed successfully' });
        } catch (error: any) {
            next(error);
        }
    }
}

export default DomainController;
