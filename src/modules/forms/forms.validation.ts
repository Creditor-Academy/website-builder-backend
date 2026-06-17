import { z } from 'zod';

export const submitFormSchema = z.object({
  website_id: z.string().min(1),
  page_slug: z.string().optional(),
  form_name: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

export const getSubmissionsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  is_read: z.enum(['true', 'false']).optional(),
  is_spam: z.enum(['true', 'false']).optional(),
  websiteId: z.string().optional(),
});

export const formIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const websiteIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type SubmitFormInput = z.infer<typeof submitFormSchema>;
