import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import prismaClient from '../../config/prisma.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import emailService from '../../services/email.service.js';

const router = Router();

const submitSchema = z.object({
  website_id: z.string().min(1),
  page_slug: z.string().optional(),
  form_name: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

// POST /forms/submit — Public endpoint for published site form submissions
router.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid form data', details: parsed.error.flatten() });
    }

    const { website_id, page_slug, form_name, data } = parsed.data;

    // Verify website exists and is published
    const website = await prismaClient.website.findFirst({
      where: { id: website_id, status: 'PUBLISHED' },
      select: { id: true, name: true, owner: { select: { email: true, name: true } } },
    });

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].substring(0, 512) : undefined;

    const submission = await prismaClient.formSubmission.create({
      data: {
        website_id,
        page_slug: page_slug ?? null,
        form_name: form_name ?? null,
        data: data as Prisma.InputJsonValue,
        ip_address: clientIp ?? null,
        user_agent: ua ?? null,
      },
    });

    // Send email notification to site owner (fire-and-forget)
    if (website.owner?.email) {
      const dataEntries = Object.entries(data as Record<string, unknown>)
        .map(([k, v]) => `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#334155">${k}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569">${String(v ?? '')}</td></tr>`)
        .join('');
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#1e293b">New Form Submission</h2>
          <p style="color:#64748b">You received a new <strong>${form_name || 'contact'}</strong> form submission on <strong>${website.name || 'your website'}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">${dataEntries}</table>
          <p style="color:#94a3b8;font-size:12px">Submitted at ${new Date().toLocaleString()}</p>
        </div>`;
      emailService.sendEmail(website.owner.email, `New form submission on ${website.name || 'your site'}`, html).catch(() => {});
    }

    res.status(201).json({ message: 'Form submitted successfully', id: submission.id });
  } catch (error) {
    next(error);
  }
});

// GET /forms/websites/:id — List submissions for a website (owner only)
router.get(
  '/websites/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const website = await prismaClient.website.findUnique({
        where: { id: req.params.id as string },
        select: { owner_id: true },
      });
      if (!website || website.owner_id !== req.context.user.id) {
        return res.status(404).json({ error: 'Website not found' });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const where: any = { website_id: req.params.id as string };
      if (req.query.is_read !== undefined) where.is_read = req.query.is_read === 'true';
      if (req.query.is_spam !== undefined) where.is_spam = req.query.is_spam === 'true';

      const [submissions, total] = await Promise.all([
        prismaClient.formSubmission.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        prismaClient.formSubmission.count({ where }),
      ]);

      res.json({
        submissions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /forms/:id/read — Mark submission as read
router.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submission = await prismaClient.formSubmission.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, website_id: true },
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const website = await prismaClient.website.findUnique({
      where: { id: submission.website_id },
      select: { owner_id: true },
    });
    if (!website || website.owner_id !== req.context.user.id) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    await prismaClient.formSubmission.update({
      where: { id: req.params.id as string },
      data: { is_read: true },
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
});

// DELETE /forms/:id — Delete a submission
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submission = await prismaClient.formSubmission.findUnique({
      where: { id: req.params.id as string },
      select: { id: true, website_id: true },
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const website = await prismaClient.website.findUnique({
      where: { id: submission.website_id },
      select: { owner_id: true },
    });
    if (!website || website.owner_id !== req.context.user.id) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    await prismaClient.formSubmission.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Submission deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
