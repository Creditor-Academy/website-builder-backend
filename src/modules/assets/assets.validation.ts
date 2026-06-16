import { z } from 'zod';

export const importAssetUrlSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url('A valid asset URL is required'),
  website_id: z.string().min(1).optional(),
});

export const assetIdParamsSchema = z.object({
  id: z.string().min(1, 'Asset ID is required'),
});