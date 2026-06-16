import type { NextFunction, Request, Response } from 'express';
import InstitutionService from './institution.service.js';

class InstitutionController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await InstitutionService.createInstitution(req.body);
            res.status(201).json({ message: 'Organization created successfully', data: result });
        } catch (error) {
            next(error);
        }
    }

    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await InstitutionService.getInstitutions();
            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    }

    async listDetailed(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.context.user;
            let result: any[] = [];

            if (user.role === 'SUPER_ADMIN') {
                result = await InstitutionService.getDetailedInstitutions();
            } else if (user.institution_id) {
                // If not Super Admin, only return their own institution details
                const org = await InstitutionService.getDetailedInstitutionById(user.institution_id);
                // Return in an array to match expected shape
                result = org ? [org] : [];
            }

            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as string;
            const result = await InstitutionService.getInstitutionById(id);
            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as string;
            const user = req.context.user;

            // Isolation: If not Super Admin, can only update their own organization
            if (user.role !== 'SUPER_ADMIN' && user.institution_id !== id) {
                return res.status(403).json({ error: "Access Denied: You can only update your own organization" });
            }

            const result = await InstitutionService.updateInstitution(id, req.body);
            res.status(200).json({ message: 'Organization updated successfully', data: result });
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as string;
            await InstitutionService.deleteInstitution(id);
            res.status(200).json({ message: 'Organization deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
}

export default new InstitutionController();
