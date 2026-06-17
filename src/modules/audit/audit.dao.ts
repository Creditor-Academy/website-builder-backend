import prismaClient from '../../config/prisma.js';

export interface CreateAuditLogData {
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: any;
  ip_address?: string | null;
}

export interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  action?: string;
  entity_type?: string;
  user_id?: string;
}

class AuditDao {
  async createLog(data: CreateAuditLogData) {
    return await prismaClient.auditLog.create({
      data: {
        user_id: data.user_id ?? null,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id ?? null,
        metadata: data.metadata ?? undefined,
        ip_address: data.ip_address ?? null,
      },
    });
  }

  async listLogs(query: ListAuditLogsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.action) where.action = query.action;
    if (query.entity_type) where.entity_type = query.entity_type;
    if (query.user_id) where.user_id = query.user_id;

    const [logs, total] = await Promise.all([
      prismaClient.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prismaClient.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default AuditDao;
