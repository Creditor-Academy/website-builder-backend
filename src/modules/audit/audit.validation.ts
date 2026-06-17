import { z } from 'zod';

export const getAuditLogsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  user_id: z.string().optional(),
});

export type GetAuditLogsQueryInput = z.infer<typeof getAuditLogsQuerySchema>;
