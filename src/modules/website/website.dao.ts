import { Prisma, WebsiteStatus } from "@prisma/client";
import prismaClient from "../../config/prisma.js";
import { DELETED_WEBSITE_RETENTION_TIME, SELECT_WEBSITE_FIELDS } from "../../constants/website.constants.js";
import type { ListWebsitesQuerySchema, UpdateWebsiteSettingsInput } from "./website.validation.js";

class WebsiteDao {
    async findWebsiteById(id: string) {
        return await prismaClient.website.findUnique({
            where: { id }
        });
    }

    async listWebsites(filters: ListWebsitesQuerySchema, ownerId?: string) {
        const {
            page = 1, limit = 10,
            search, status, created_after
        } = filters;

        const skip = (page - 1) * limit;

        const where: Prisma.WebsiteWhereInput = {};

        if (status) where.status = status;
        if (ownerId && !filters.institution_id) where.owner_id = ownerId;
        if (filters.institution_id) where.institution_id = filters.institution_id;

        if (created_after) {
            where.created_at = { gte: new Date(created_after) };
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [websites, total] = await Promise.all([
            prismaClient.website.findMany({
                where,
                skip, take: limit,
                orderBy: { created_at: 'desc' },
                select: SELECT_WEBSITE_FIELDS
            }),
            prismaClient.website.count({ where }),
        ]);

        return {
            websites,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async createWebsite(userId: string, websiteData: { name: string, institution_id?: string, content?: any, source_template_id?: string }) {
        const { name, institution_id, content, source_template_id } = websiteData;
        const data: Prisma.WebsiteCreateInput = {
            name,
            owner: { connect: { id: userId } },
            settings: { create: {} },
            content: content || null
        };

        if (institution_id) {
            data.institution = { connect: { id: institution_id } };
        }

        if (source_template_id) {
            (data as any).sourceTemplate = { connect: { id: source_template_id } };
        }

        return await prismaClient.website.create({ data });
    }

    async createWebsiteWithSettings(userId: string, websiteData: { name: string, institution_id?: string, content?: any, settings?: any, source_template_id?: string }) {
        const { name, institution_id, content, settings, source_template_id } = websiteData;
        const data: Prisma.WebsiteCreateInput = {
            name,
            owner: { connect: { id: userId } },
            settings: { create: settings || {} },
            content: content || null
        };

        if (institution_id) {
            data.institution = { connect: { id: institution_id } };
        }

        if (source_template_id) {
            (data as any).sourceTemplate = { connect: { id: source_template_id } };
        }

        return await prismaClient.website.create({ data });
    }

    async updateWebsite(id: string, websiteData: any) {
        return await prismaClient.website.update({
            data: websiteData,
            where: { id }
        });
    }

    async getWebsiteSettings(settingsId: string) {
        return await prismaClient.settings.findUnique({
            where: { id: settingsId }
        })
    }

    async updateWebsiteSettings(id: string, data: any) {
        return await prismaClient.settings.update({
            where: { id },
            data: data
        })
    }

    async cleanupDeletedWebsites() {
        await prismaClient.website.deleteMany({
            where: {
                status: WebsiteStatus.DELETED,
                deleted_at: {
                    lte: new Date(Date.now() - DELETED_WEBSITE_RETENTION_TIME)
                }
            }
        });
    }
}

export default WebsiteDao;