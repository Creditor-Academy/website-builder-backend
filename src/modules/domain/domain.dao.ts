import prismaClient from '../../config/prisma.js';
import type { DomainStatus, DomainType, Prisma } from '@prisma/client';

/** Helper: strips keys with undefined values from an object so Prisma's
 *  exactOptionalPropertyTypes doesn't reject them. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    const result = {} as T;
    for (const key of Object.keys(obj) as Array<keyof T>) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
}

class DomainDao {

    async findById(id: string) {
        return prismaClient.domain.findUnique({
            where: { id },
        });
    }

    async findByDomain(domain: string) {
        return prismaClient.domain.findUnique({
            where: { domain },
        });
    }

    async findByWebsiteId(websiteId: string) {
        return prismaClient.domain.findMany({
            where: { website_id: websiteId },
            orderBy: { created_at: 'desc' },
        });
    }

    async findPendingCustomDomains() {
        return prismaClient.domain.findMany({
            where: {
                type: 'CUSTOM',
                status: 'PENDING',
                acm_certificate_arn: { not: null },
            },
        });
    }

    async create(data: {
        website_id: string;
        domain: string;
        type: DomainType;
        status?: DomainStatus;
        is_primary?: boolean;
        ssl_enabled?: boolean;
        dns_records?: Prisma.InputJsonValue;
        acm_certificate_arn?: string;
    }) {
        const payload: Prisma.DomainUncheckedCreateInput = {
            website_id: data.website_id,
            domain: data.domain,
            type: data.type,
            status: data.status ?? 'PENDING',
            is_primary: data.is_primary ?? false,
            ssl_enabled: data.ssl_enabled ?? false,
        };
        
        if (data.dns_records !== undefined) payload.dns_records = data.dns_records;
        if (data.acm_certificate_arn !== undefined) payload.acm_certificate_arn = data.acm_certificate_arn;

        return prismaClient.domain.create({
            data: payload,
        });
    }

    async upsertByDomain(domain: string, data: {
        website_id: string;
        type: DomainType;
        status?: DomainStatus;
        is_primary?: boolean;
        ssl_enabled?: boolean;
        dns_records?: Prisma.InputJsonValue;
        acm_certificate_arn?: string;
        cloudfront_distribution_id?: string;
        cloudfront_domain_name?: string;
    }) {
        const status = data.status ?? 'PENDING';
        const is_primary = data.is_primary ?? false;
        const ssl_enabled = data.ssl_enabled ?? false;

        const updatePayload: Prisma.DomainUpdateInput = {
            website: { connect: { id: data.website_id } },
            type: data.type,
            status,
            is_primary,
            ssl_enabled,
        };
        if (data.dns_records !== undefined) updatePayload.dns_records = data.dns_records;
        if (data.acm_certificate_arn !== undefined) updatePayload.acm_certificate_arn = data.acm_certificate_arn;
        if (data.cloudfront_distribution_id !== undefined) updatePayload.cloudfront_distribution_id = data.cloudfront_distribution_id;
        if (data.cloudfront_domain_name !== undefined) updatePayload.cloudfront_domain_name = data.cloudfront_domain_name;

        const createPayload: Prisma.DomainUncheckedCreateInput = {
            website_id: data.website_id,
            domain,
            type: data.type,
            status,
            is_primary,
            ssl_enabled,
        };
        if (data.dns_records !== undefined) createPayload.dns_records = data.dns_records;
        if (data.acm_certificate_arn !== undefined) createPayload.acm_certificate_arn = data.acm_certificate_arn;
        if (data.cloudfront_distribution_id !== undefined) createPayload.cloudfront_distribution_id = data.cloudfront_distribution_id;
        if (data.cloudfront_domain_name !== undefined) createPayload.cloudfront_domain_name = data.cloudfront_domain_name;

        return prismaClient.domain.upsert({
            where: { domain },
            update: updatePayload,
            create: createPayload,
        });
    }

    async updateStatus(id: string, data: {
        status: DomainStatus;
        ssl_enabled?: boolean;
        verified_at?: Date | null;
        dns_records?: Prisma.InputJsonValue;
        acm_certificate_arn?: string | null;
        cloudfront_distribution_id?: string | null;
        cloudfront_domain_name?: string | null;
    }) {
        return prismaClient.domain.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prismaClient.domain.delete({
            where: { id },
        });
    }

    async deleteByDomainAndWebsite(domain: string, websiteId: string) {
        return prismaClient.domain.deleteMany({
            where: { domain, website_id: websiteId },
        });
    }
}

export default DomainDao;
