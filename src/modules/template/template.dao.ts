import prisma from '../../config/prisma.js';
import type { AuthUser } from '../../types/auth.types.js';
import { TemplateScope, UserRole } from '@prisma/client';

export class TemplateDao {
    private buildScopeFilters(user: AuthUser) {
        return [
            { scope: TemplateScope.GLOBAL },
            ...(user.institution_id ? [{ scope: TemplateScope.INSTITUTION, institution_id: user.institution_id }] : []),
        ];
    }

    // ─── Website Templates ────────────────────────────────────────────────────

    /** Get all website templates visible to the current user */
    async getVisibleWebsiteTemplates(user: AuthUser) {
        const includeInstitution = { institution: { select: { id: true, name: true } } };

        if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
            return prisma.websiteTemplate.findMany({
                where: { deletedAt: null },
                include: includeInstitution,
                orderBy: { createdAt: 'desc' },
            });
        }

        const scopeFilters = this.buildScopeFilters(user);

        return prisma.websiteTemplate.findMany({
            where: {
                deletedAt: null,
                OR: scopeFilters,
            },
            include: includeInstitution,
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Get a single website template by ID (including deleted, for admin) */
    async getWebsiteTemplateById(id: string) {
        return prisma.websiteTemplate.findUnique({
            where: { id },
        });
    }

    /** Create a new website template */
    async createWebsiteTemplate(data: {
        name: string;
        description: string;
        category: string;
        scope?: TemplateScope;
        institution_id?: string | null;
        image?: string | null;
        global_styles?: object;
        navbar?: object;
        footer?: object;
        home_layout?: object;
    }) {
        return prisma.websiteTemplate.create({
            data: {
                name: data.name,
                description: data.description,
                category: data.category,
                scope: data.scope ?? TemplateScope.GLOBAL,
                institution_id: data.institution_id ?? null,
                image: data.image ?? null,
                global_styles: data.global_styles ?? {},
                navbar: data.navbar ?? {},
                footer: data.footer ?? {},
                home_layout: data.home_layout ?? {},
            },
        });
    }

    /** Update a website template */
    async updateWebsiteTemplate(id: string, data: Partial<{
        name: string;
        description: string;
        category: string;
        scope: TemplateScope;
        institution_id: string | null;
        image: string | null;
        global_styles: object;
        navbar: object;
        footer: object;
        home_layout: object;
    }>) {
        return prisma.websiteTemplate.update({
            where: { id },
            data,
        });
    }

    /** Soft delete a website template */
    async deleteWebsiteTemplate(id: string) {
        return prisma.websiteTemplate.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    /** Restore a soft-deleted website template */
    async restoreWebsiteTemplate(id: string) {
        return prisma.websiteTemplate.update({
            where: { id },
            data: { deletedAt: null },
        });
    }

}

export default new TemplateDao();