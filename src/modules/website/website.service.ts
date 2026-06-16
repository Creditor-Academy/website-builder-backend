import WebsiteDao from './website.dao.js';
import UserDao from '../user/user.dao.js';
import templateDao from '../template/template.dao.js';
import type { CreateWebsiteInput, DomainInput, ListWebsitesQuerySchema, PublishWebsiteInput, UpdateWebsiteInput, UpdateWebsiteSettingsInput } from './website.validation.js';
import { WebsiteStatus, type Website } from '@prisma/client';
import { addWebsiteDomain, createWebsiteContentFromTemplate, duplicateWebsiteContent, getWebsiteDomains, getWebsiteVersions, normalizeWebsiteContent, publishWebsiteContent, removeWebsiteDomain, verifyWebsiteDomain } from './website-content.utils.js';
import { deploy } from '../../services/deployment.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/error.utils.js';
import prismaClient from '../../config/prisma.js';
import cacheService from '../../services/cache.service.js';

class WebsiteService {
    private websiteDao: WebsiteDao;
    private userDao: UserDao;

    constructor() {
        this.websiteDao = new WebsiteDao();
        this.userDao = new UserDao();
    }

    async createWebsite(userId: string, institutionId: string | null, data: CreateWebsiteInput) {
        let content;
        let sourceTemplateId: string | undefined;

        if (data.template_id) {
            const template = await templateDao.getWebsiteTemplateById(data.template_id);

            if (!template || template.deletedAt) {
                throw new NotFoundError('Template not found');
            }

            content = createWebsiteContentFromTemplate(template);
            sourceTemplateId = template.id;
        } else {
            content = normalizeWebsiteContent(data.content);
        }

        return await this.websiteDao.createWebsite(userId, { 
            ...data,
            content,
            ...(sourceTemplateId ? { source_template_id: sourceTemplateId } : {}),
            institution_id: institutionId || undefined 
        } as any);
    }

    async listWebsites(user: any, filters: ListWebsitesQuerySchema) {
        // If an institution_id is explicitly provided, validate the user has access to it
        if (filters.institution_id) {
            if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
                // Super admins can view any institution's websites
                return await this.websiteDao.listWebsites(filters);
            }
            if (user.role === 'INSTITUTION_ADMIN' && user.institution_id === filters.institution_id) {
                // Institution admins can only view their own institution
                return await this.websiteDao.listWebsites(filters);
            }
            // Regular users or institution admins for other orgs: ignore filter, show only owned
            return await this.websiteDao.listWebsites({ ...filters, institution_id: undefined } as any, user.id);
        }

        // Institution Admin sees all websites in their institution by default on their dashboard
        if (user.role === 'INSTITUTION_ADMIN' && user.institution_id) {
            return await this.websiteDao.listWebsites({ 
                ...filters, 
                institution_id: user.institution_id 
            });
        }

        // For Super Admin on personal dash, and regular users: show only their owned websites
        return await this.websiteDao.listWebsites(filters, user.id);
    }

    async listAllWebsites(user: any, filters: ListWebsitesQuerySchema) {
        // Super Admin sees everything (optionally filtered by institution_id)
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            return await this.websiteDao.listWebsites(filters);
        }

        // Institution Admin sees all websites in their institution (ignore other institution_id filters)
        if (user.role === 'INSTITUTION_ADMIN' && user.institution_id) {
            return await this.websiteDao.listWebsites({ 
                ...filters, 
                institution_id: user.institution_id 
            });
        }

        // Regular users/others shouldn't really call listAllWebsites, but if they do, show only their own
        return await this.websiteDao.listWebsites(filters, user.id);
    }

    async getSingleWebsite(website: any) {
        const settingsId = website.settings?.id || website.settings_id;
        const settingsPromise = settingsId ? this.websiteDao.getWebsiteSettings(settingsId) : Promise.resolve(null);
        const ownerPromise = this.userDao.findUserById(website.owner_id);

        const [settings, owner] = await Promise.all([settingsPromise, ownerPromise]);

        return { website, settings, owner };
    }

    async updateWebsite(website: Website, data: UpdateWebsiteInput) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new NotFoundError("Website not found")
        }
        const updateData = {
            ...data,
            ...(data.content ? { content: normalizeWebsiteContent(data.content) } : {}),
        };
        return await this.websiteDao.updateWebsite(website.id, updateData);
    }

    async deleteWebsite(website: Website) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new ConflictError("Website Already Deleted");
        }
        await this.websiteDao.updateWebsite(website.id, {
            status: WebsiteStatus.DELETED,
            deleted_at: new Date()
        });

        // Mark all domains as DELETED and invalidate cache
        const domains = await prismaClient.domain.findMany({ where: { website_id: website.id } });
        if (domains.length > 0) {
            await prismaClient.domain.updateMany({
                where: { website_id: website.id },
                data: { status: 'DELETED' },
            });
            for (const d of domains) {
                await cacheService.del(`domain:${d.domain}`);
            }
        }
    }

    async restoreWebsite(website: Website) {
        if (website.status !== WebsiteStatus.DELETED) {
            throw new BadRequestError("Website Already not Deleted");
        }
        await this.websiteDao.updateWebsite(website.id, {
            status: WebsiteStatus.DRAFT,
            deleted_at: null
        });

        // Reactivate domains — subdomains go ACTIVE, custom domains go PENDING (need re-verify)
        const domains = await prismaClient.domain.findMany({ where: { website_id: website.id, status: 'DELETED' } });
        for (const d of domains) {
            await prismaClient.domain.update({
                where: { id: d.id },
                data: { status: d.type === 'SUBDOMAIN' ? 'ACTIVE' : 'PENDING' },
            });
            await cacheService.del(`domain:${d.domain}`);
        }
    }

    async duplicateWebsite(website: Website) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError("Website Deleted");
        }
        const duplicatedContent = duplicateWebsiteContent(website.content);
        const currentSettings = website.settings_id ? await this.websiteDao.getWebsiteSettings(website.settings_id) : null;

        return await this.websiteDao.createWebsiteWithSettings(website.owner_id, {
            name: `${website.name} (Copy)`,
            ...(website.institution_id ? { institution_id: website.institution_id } : {}),
            content: duplicatedContent,
            settings: currentSettings ? {
                seo: currentSettings.seo,
                contact: currentSettings.contact,
                social_links: currentSettings.social_links,
            } : {},
        });
    }

    async updateWebsiteSettings(website: any, data: UpdateWebsiteSettingsInput) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError("Website Deleted");
        }
        const settingId = website.settings?.id || website.settings_id;
        if (!settingId) throw new NotFoundError('Settings not found');
        return await this.websiteDao.updateWebsiteSettings(settingId, data);
    }

    async getWebsiteVersions(website: Website) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }
        return getWebsiteVersions(website.content);
    }

    async publishWebsite(website: Website, data: PublishWebsiteInput, userId: string) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }

        const siteHost = process.env.PUBLIC_SITE_HOST || 'buildora.app';
        const hostname = data.customDomain || (data.subdomain ? `${data.subdomain}.${siteHost}` : `${website.id.slice(0, 8)}.${siteHost}`);

        // Run the real deployment pipeline: generate HTML â†’ upload to S3
        const normalized = normalizeWebsiteContent(website.content as Record<string, any>);
        const deploymentResult = await deploy({
            websiteId: website.id,
            versionId: 'pending', // will be replaced below
            domain: hostname,
            content: normalized,
            siteName: website.name,
            deployedBy: userId,
        });

        // Build the published content with the real deployment record
        const published = publishWebsiteContent(website.content, {
            websiteId: website.id,
            ...(data.subdomain ? { subdomain: data.subdomain } : {}),
            ...(data.customDomain ? { customDomain: data.customDomain } : {}),
            deploymentRecord: {
                ...deploymentResult,
                versionId: '', // will be set by publishWebsiteContent
                sslEnabled: true,
            },
        });

        // Patch the versionId into the first deployment record
        const firstDep = published.content.builderMeta.deployments[0];
        if (firstDep && published.publishedVersionId) {
            firstDep.versionId = published.publishedVersionId;
        }

        await this.websiteDao.updateWebsite(website.id, {
            status: WebsiteStatus.PUBLISHED,
            content: published.content,
        });

        // Sync domain to Domain table so domain-router can serve it
        const isSubdomain = hostname.endsWith(`.${siteHost}`);
        await prismaClient.domain.upsert({
            where: { domain: hostname },
            update: {
                website_id: website.id,
                type: isSubdomain ? 'SUBDOMAIN' : 'CUSTOM',
                status: isSubdomain ? 'ACTIVE' : 'PENDING',
                is_primary: true,
                ssl_enabled: isSubdomain,
            },
            create: {
                website_id: website.id,
                domain: hostname,
                type: isSubdomain ? 'SUBDOMAIN' : 'CUSTOM',
                status: isSubdomain ? 'ACTIVE' : 'PENDING',
                is_primary: true,
                ssl_enabled: isSubdomain,
            },
        });

        return {
            ...published.response,
            deployment: {
                id: deploymentResult.id,
                status: deploymentResult.status,
                url: deploymentResult.url,
                fileCount: deploymentResult.fileCount,
                totalSize: deploymentResult.totalSize,
                logs: deploymentResult.logs,
            },
        };
    }

    async getDeployments(website: Website) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }
        const content = normalizeWebsiteContent(website.content as Record<string, any>);
        return content.builderMeta.deployments;
    }

    async rollbackDeployment(website: Website, deploymentId: string, userId: string) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }

        const content = normalizeWebsiteContent(website.content as Record<string, any>);
        const targetDeployment = content.builderMeta.deployments.find((d) => d.id === deploymentId);
        if (!targetDeployment) {
            throw new NotFoundError('Deployment not found');
        }
        if (targetDeployment.status !== 'active') {
            throw new BadRequestError('Can only rollback active deployments');
        }

        // Find the version snapshot for the target deployment
        const targetVersion = content.builderMeta.versions.find((v) => v.id === targetDeployment.versionId);
        if (!targetVersion) {
            throw new NotFoundError('Deployment version snapshot not found');
        }

        // Re-deploy the old version's content
        const redeployContent = {
            ...content,
            pages: targetVersion.snapshot.pages,
            activePageId: targetVersion.snapshot.activePageId,
            templateId: targetVersion.snapshot.templateId,
        };

        const deploymentResult = await deploy({
            websiteId: website.id,
            versionId: targetDeployment.versionId,
            domain: targetDeployment.domain,
            content: redeployContent,
            siteName: website.name,
            deployedBy: userId,
        });

        // Mark old deployment as rolled back
        content.builderMeta.deployments = content.builderMeta.deployments.map((d) =>
            d.id === deploymentId ? { ...d, status: 'rolled_back' as const } : d
        );

        // Add new deployment record
        content.builderMeta.deployments = [
            {
                ...deploymentResult,
                sslEnabled: true,
            },
            ...content.builderMeta.deployments,
        ];

        if (deploymentResult.url) {
            content.builderMeta.publishedUrl = deploymentResult.url;
        }

        await this.websiteDao.updateWebsite(website.id, { content });

        return {
            success: deploymentResult.status === 'active',
            deployment: {
                id: deploymentResult.id,
                status: deploymentResult.status,
                url: deploymentResult.url,
            },
        };
    }

    async getDomains(website: Website) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }
        return getWebsiteDomains(website.content);
    }

    async addDomain(website: Website, data: DomainInput) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }

        const result = addWebsiteDomain(website.content, data.domain);
        await this.websiteDao.updateWebsite(website.id, { content: result.content });

        // Sync to Domain table for fast host-based lookups
        const isSubdomain = result.domain.type === 'subdomain';
        await prismaClient.domain.upsert({
            where: { domain: data.domain },
            update: {
                website_id: website.id,
                type: isSubdomain ? 'SUBDOMAIN' : 'CUSTOM',
                status: isSubdomain ? 'ACTIVE' : 'PENDING',
                is_primary: result.domain.primary || false,
            },
            create: {
                website_id: website.id,
                domain: data.domain,
                type: isSubdomain ? 'SUBDOMAIN' : 'CUSTOM',
                status: isSubdomain ? 'ACTIVE' : 'PENDING',
                is_primary: result.domain.primary || false,
            },
        });

        return result.domain;
    }

    async removeDomain(website: Website, data: DomainInput) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }

        const content = removeWebsiteDomain(website.content, data.domain);
        await this.websiteDao.updateWebsite(website.id, { content });

        // Remove from Domain table
        await prismaClient.domain.deleteMany({ where: { domain: data.domain, website_id: website.id } });
    }

    async verifyDomain(website: Website, data: DomainInput) {
        if (website.status === WebsiteStatus.DELETED) {
            throw new BadRequestError('Website Deleted');
        }

        const result = await verifyWebsiteDomain(website.content, data.domain);
        await this.websiteDao.updateWebsite(website.id, { content: result.content });

        // Sync verification status to Domain table
        if (result.domain) {
            await prismaClient.domain.updateMany({
                where: { domain: data.domain, website_id: website.id },
                data: {
                    status: result.domain.status === 'active' ? 'ACTIVE' : 'PENDING',
                    ssl_enabled: result.domain.sslEnabled || false,
                    verified_at: result.domain.status === 'active' ? new Date() : null,
                },
            });
        }

        return {
            verified: Boolean(result.domain) && result.domain?.status === 'active',
            dnsRecords: result.domain?.dnsRecords || {},
        };
    }

    async cleanupDeletedWebsites() {
        // Hard delete websites that were soft deleted more than 30 days ago
        await this.websiteDao.cleanupDeletedWebsites();
    }
}

export default WebsiteService;
