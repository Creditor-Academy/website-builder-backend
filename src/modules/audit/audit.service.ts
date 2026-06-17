import AuditDao, { type CreateAuditLogData } from './audit.dao.js';
import type { AuthUser } from '../../types/auth.types.js';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../../utils/error.utils.js';

class AuditService {
  private auditDao: AuditDao;

  constructor() {
    this.auditDao = new AuditDao();
  }

  /**
   * Logs an action to the audit trail.
   * This method is intended to be called internally by other services, 
   * so it does not throw HTTP errors, just swallows or logs errors to avoid 
   * failing the main transaction if logging fails.
   */
  async logAction(data: CreateAuditLogData) {
    try {
      await this.auditDao.createLog(data);
    } catch (error) {
      // In a production scenario, you might want to log this to your infrastructure logger (e.g. Pino/Datadog)
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Fetches audit logs, restricted by role.
   */
  async getAuditLogs(currentUser: AuthUser, query: any) {
    // Only SUPER_ADMIN and ADMIN can view audit logs across the platform
    if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('You do not have permission to view audit logs');
    }

    return await this.auditDao.listLogs(query);
  }
}

export default AuditService;
