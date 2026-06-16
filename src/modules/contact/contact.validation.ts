import { z } from 'zod';

export const createContactSubmissionSchema = z.object({
    websiteId: z.string().min(1, 'Website ID is required'),
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Valid email is required').max(255),
    subject: z.string().max(200).optional(),
    message: z.string().min(1, 'Message is required').max(2000),
});

export const updateContactSubmissionSchema = z.object({
    status: z.enum(['unread', 'read', 'replied']).optional(),
});

export const contactSubmissionIdParamsSchema = z.object({
    id: z.string().min(1, 'Contact submission ID is required'),
});

export const getContactSubmissionsQuerySchema = z.object({
    websiteId: z.string().min(1, 'Website ID must not be empty').optional(),
    status: z.enum(['unread', 'read', 'replied']).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});
