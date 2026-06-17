import { FormsDao } from './forms.dao.js';
import { NotFoundError, ForbiddenError } from '../../utils/error.utils.js';
import emailService from '../../services/email.service.js';
import type { SubmitFormInput } from './forms.validation.js';
import type { Prisma } from '@prisma/client';

export class FormsService {
  private formsDao: FormsDao;

  constructor() {
    this.formsDao = new FormsDao();
  }

  async submitForm(data: SubmitFormInput, ipAddress?: string, userAgent?: string) {
    const website = await this.formsDao.getWebsiteOwnerInfo(data.website_id);
    if (!website) {
      throw new NotFoundError('Website not found or not published');
    }

    const submission = await this.formsDao.createSubmission({
      website_id: data.website_id,
      page_slug: data.page_slug ?? null,
      form_name: data.form_name ?? null,
      data: data.data as Prisma.InputJsonValue,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    });

    // Send email notification (fire-and-forget)
    if (website.owner?.email) {
      const dataEntries = Object.entries(data.data as Record<string, unknown>)
        .map(([k, v]) => `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#334155">${k}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569">${String(v ?? '')}</td></tr>`)
        .join('');
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#1e293b">New Form Submission</h2>
          <p style="color:#64748b">You received a new <strong>${data.form_name || 'contact'}</strong> form submission on <strong>${website.name || 'your website'}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">${dataEntries}</table>
          <p style="color:#94a3b8;font-size:12px">Submitted at ${new Date().toLocaleString()}</p>
        </div>`;
      emailService.sendEmail(website.owner.email, `New form submission on ${website.name || 'your site'}`, html).catch(() => {});
    }

    return submission;
  }

  async authorizeSubmissionAccess(userId: string, submissionId: string) {
    const submission = await this.formsDao.getSubmissionWithWebsiteOwner(submissionId);
    if (!submission) {
      throw new NotFoundError('Submission not found');
    }
    if (submission.website.owner_id !== userId) {
      throw new ForbiddenError('Access denied to this submission');
    }
    return submission;
  }

  async getUserSubmissions(userId: string, page: number, limit: number, isRead?: boolean, isSpam?: boolean, websiteId?: string) {
    const skip = (page - 1) * limit;
    const options: { skip: number, take: number, is_read?: boolean, is_spam?: boolean, websiteId?: string } = { skip, take: limit };
    if (isRead !== undefined) options.is_read = isRead;
    if (isSpam !== undefined) options.is_spam = isSpam;
    if (websiteId) options.websiteId = websiteId;

    const { submissions, total } = await this.formsDao.getUserSubmissions(userId, options);

    return {
      data: submissions.map(sub => {
        // Map the submission fields to match what DashboardMessages expects (name, email, subject, message from JSON data)
        const d: any = sub.data || {};
        return {
          id: sub.id,
          website_id: sub.website_id,
          website: sub.website,
          form_name: sub.form_name,
          name: d.name || d.firstName || 'Anonymous',
          email: d.email || '',
          subject: d.subject || '',
          message: d.message || '',
          status: sub.is_read ? 'read' : 'unread',
          createdAt: sub.created_at,
          ...d
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUserStats(userId: string, websiteId?: string) {
    return this.formsDao.getUserStats(userId, websiteId);
  }

  async markAsRead(userId: string, submissionId: string) {
    await this.authorizeSubmissionAccess(userId, submissionId);
    return this.formsDao.markAsRead(submissionId);
  }

  async deleteSubmission(userId: string, submissionId: string) {
    await this.authorizeSubmissionAccess(userId, submissionId);
    return this.formsDao.deleteSubmission(submissionId);
  }
}
