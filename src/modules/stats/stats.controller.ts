import type { NextFunction, Request, Response } from 'express';
import StatsService from './stats.service.js';

class StatsController {
    async getDashboardStats(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.context.user;
            const adminView = req.query.adminView === 'true';
            
            if (user.role === 'SUPER_ADMIN') {
                if (adminView) {
                    const stats = await StatsService.getPlatformStats();
                    return res.status(200).json({ data: stats });
                } else {
                    const stats = await StatsService.getUserStats(user.id);
                    return res.status(200).json({ data: stats });
                }
            } 
            
            if (user.role === 'INSTITUTION_ADMIN' || user.institution_id) {
                const stats = await StatsService.getTenantStats(user.institution_id!);
                return res.status(200).json({ data: stats });
            }

            // Fallback for regular users (their own stats)
            const stats = await StatsService.getUserStats(user.id);
            res.status(200).json({ data: stats });
        } catch (error) {
            next(error);
        }
    }
}

export default new StatsController();
