import prisma from '../../config/prisma.js';

export class ContactDao {
    
    /** Create a new contact submission */
    async createContactSubmission(data: {
        websiteId: string;
        name: string;
        email: string;
        subject?: string;
        message: string;
    }) {
        return prisma.contactSubmission.create({
            data: {
                websiteId: data.websiteId,
                name: data.name,
                email: data.email,
                subject: data.subject ?? null,
                message: data.message,
            },
            include: {
                website: {
                    select: {
                        id: true,
                        name: true,
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            }
                        }
                    }
                }
            }
        });
    }

    /** Get all contact submissions for a website owner */
    async getContactSubmissionsByOwnerId(ownerId: string, options?: {
        websiteId?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: any = {
            website: {
                owner_id: ownerId
            }
        };

        if (options?.websiteId) {
            where.website.id = options.websiteId;
        }

        if (options?.status) {
            where.status = options.status;
        }

        const query: any = {
            where,
            include: {
                website: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc' as const
            },
        };
        if (options?.limit != null) query.take = options.limit;
        if (options?.offset != null) query.skip = options.offset;

        return prisma.contactSubmission.findMany(query);
    }

    /** Get a single contact submission by ID */
    async getContactSubmissionById(id: string, ownerId?: string) {
        const where: any = { id };
        
        if (ownerId) {
            where.website = {
                owner_id: ownerId
            };
        }

        return prisma.contactSubmission.findFirst({
            where,
            include: {
                website: {
                    select: {
                        id: true,
                        name: true,
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            }
                        }
                    }
                }
            }
        });
    }

    /** Update contact submission status */
    async updateContactSubmissionStatus(id: string, status: string) {
        return prisma.contactSubmission.update({
            where: { id },
            data: { 
                status,
                updatedAt: new Date()
            },
            include: {
                website: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });
    }

    /** Delete a contact submission */
    async deleteContactSubmission(id: string) {
        return prisma.contactSubmission.delete({
            where: { id },
        });
    }

    /** Get contact submission stats for a website owner */
    async getContactSubmissionStats(ownerId: string, websiteId?: string) {
        const where: any = {
            website: {
                owner_id: ownerId
            }
        };

        if (websiteId) {
            where.website.id = websiteId;
        }

        const stats = await prisma.contactSubmission.groupBy({
            by: ['status'],
            where,
            _count: {
                id: true
            }
        });

        const total = await prisma.contactSubmission.count({
            where
        });

        return {
            total,
            unread: stats.find(s => s.status === 'unread')?._count.id || 0,
            read: stats.find(s => s.status === 'read')?._count.id || 0,
            replied: stats.find(s => s.status === 'replied')?._count.id || 0,
        };
    }
}

export default new ContactDao();
