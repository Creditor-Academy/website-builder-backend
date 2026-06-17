import type { Request, Response, NextFunction } from 'express';
import AuditService from './audit.service.js';

class AuditController {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUser = req.context.user;
      const query = req.validated.query;
      
      const result = await this.auditService.getAuditLogs(currentUser, query);
      
      res.status(200).json(result);
    } catch (error: any) {
      next(error);
    }
  };
}

export default AuditController;
