import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

export const domainIdParamsSchema = z.object({
    domainId: z.string().min(1, 'Domain ID is required'),
});

export const websiteIdParamsSchema = z.object({
    websiteId: z.string().min(1, 'Website ID is required'),
});

// ─── Add Subdomain ──────────────────────────────────────────────────────────

export const addSubdomainSchema = z.object({
    slug: z.string()
        .trim()
        .min(2, 'Subdomain must be at least 2 characters')
        .max(63, 'Subdomain must not exceed 63 characters')
        .regex(
            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
            'Subdomain can only contain lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)',
        ),
});

// ─── Add Custom Domain ──────────────────────────────────────────────────────

export const addCustomDomainSchema = z.object({
    domain: z.string()
        .trim()
        .min(3, 'Domain is required')
        .max(253, 'Domain name is too long')
        .regex(
            /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
            'Invalid domain format (e.g. www.example.com)',
        )
        .transform(val => val.toLowerCase()),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type DomainIdParams = z.infer<typeof domainIdParamsSchema>;
export type WebsiteIdParams = z.infer<typeof websiteIdParamsSchema>;
export type AddSubdomainInput = z.infer<typeof addSubdomainSchema>;
export type AddCustomDomainInput = z.infer<typeof addCustomDomainSchema>;
