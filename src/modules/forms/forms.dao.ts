import prismaClient from '../../config/prisma.js';
import type { Prisma } from '@prisma/client';

export class FormsDao {
  async getWebsiteOwnerInfo(websiteId: string) {
    return prismaClient.website.findFirst({
      where: { id: websiteId, status: 'PUBLISHED' },
      select: { id: true, name: true, owner_id: true, owner: { select: { email: true, name: true } } },
    });
  }

  async getSubmissionWithWebsiteOwner(submissionId: string) {
    return prismaClient.formSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, website_id: true, website: { select: { owner_id: true } } },
    });
  }

  async createSubmission(data: Prisma.FormSubmissionUncheckedCreateInput) {
    return prismaClient.formSubmission.create({ data });
  }

  async getUserSubmissions(userId: string, options: { skip: number; take: number; is_read?: boolean; is_spam?: boolean; websiteId?: string }) {
    const where: any = { website: { owner_id: userId } };
    if (options.is_read !== undefined) where.is_read = options.is_read;
    if (options.is_spam !== undefined) where.is_spam = options.is_spam;
    if (options.websiteId) where.website_id = options.websiteId;

    const [submissions, total] = await Promise.all([
      prismaClient.formSubmission.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: options.skip,
        take: options.take,
        include: { website: { select: { id: true, name: true } } },
      }),
      prismaClient.formSubmission.count({ where }),
    ]);

    return { submissions, total };
  }

  async getUserStats(userId: string, websiteId?: string) {
    const where: any = { website: { owner_id: userId } };
    if (websiteId) where.website_id = websiteId;

    const total = await prismaClient.formSubmission.count({ where });
    const unread = await prismaClient.formSubmission.count({ where: { ...where, is_read: false } });
    const read = await prismaClient.formSubmission.count({ where: { ...where, is_read: true } });
    return { total, unread, read };
  }

  async markAsRead(submissionId: string) {
    return prismaClient.formSubmission.update({
      where: { id: submissionId },
      data: { is_read: true },
    });
  }

  async deleteSubmission(submissionId: string) {
    return prismaClient.formSubmission.delete({
      where: { id: submissionId },
    });
  }
}
