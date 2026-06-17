import DomainDao from './domain.dao.js';
import type { AddSubdomainInput, AddCustomDomainInput } from './domain.validation.js';
import {
    requestAcmCertificate,
    describeCertificateStatus,
    createDistribution,
    deleteDistribution,
    deleteAcmCertificate,
    createCacheInvalidation,
    isHostingConfigured,
} from '../../services/aws-hosting.service.js';
import {
    ConflictError,
    NotFoundError,
    BadRequestError,
    InternalServerError,
} from '../../utils/error.utils.js';
import cacheService from '../../services/cache.service.js';
import pino from 'pino';

const logger = pino({ name: 'domain-service' });
const SITE_HOST = () => (process.env.PUBLIC_SITE_HOST || 'buildora.app').trim();

class DomainService {
    private domainDao: DomainDao;

    constructor() {
        this.domainDao = new DomainDao();
    }

    // ─── List Domains ───────────────────────────────────────────────────────

    async listDomains(websiteId: string) {
        return this.domainDao.findByWebsiteId(websiteId);
    }

    // ─── Add Subdomain ──────────────────────────────────────────────────────

    /**
     * Register a platform subdomain (e.g. school.buildora.app) for a website.
     * - Creates a Domain record with type=SUBDOMAIN, status=ACTIVE
     * - Updates the CloudFront KeyValueStore so the CF Function can route to it
     */
    async addSubdomain(websiteId: string, data: AddSubdomainInput) {
        const hostname = `${data.slug}.${SITE_HOST()}`;

        // Check for conflicts
        const existing = await this.domainDao.findByDomain(hostname);
        if (existing) {
            if (existing.website_id === websiteId) {
                // Already mapped to this website — just return it
                return existing;
            }
            throw new ConflictError(`Subdomain "${data.slug}" is already in use`);
        }

        // Create the domain record (subdomains are immediately active)
        const domain = await this.domainDao.create({
            website_id: websiteId,
            domain: hostname,
            type: 'SUBDOMAIN',
            status: 'ACTIVE',
            is_primary: true,
            ssl_enabled: true, // Covered by the wildcard *.buildora.app cert
        });


        // Invalidate domain cache
        await cacheService.del(`domain:${hostname}`).catch(() => {});

        logger.info({ websiteId, hostname }, 'Subdomain registered');
        return domain;
    }

    // ─── Add Custom Domain ──────────────────────────────────────────────────

    /**
     * Start the custom domain flow:
     * 1. Request an ACM certificate (DNS validation)
     * 2. Create a Domain record with status=PENDING
     * 3. Return DNS validation records for the user to set up
     */
    async addCustomDomain(websiteId: string, data: AddCustomDomainInput) {
        const hostname = data.domain;

        // Check for conflicts
        const existing = await this.domainDao.findByDomain(hostname);
        if (existing) {
            if (existing.website_id === websiteId && existing.status === 'PENDING') {
                // Return existing pending domain with its DNS records
                return {
                    domain: existing,
                    dnsValidationRecords: (existing.dns_records as any)?.validation || [],
                    message: 'Domain is already pending verification. Please add the DNS records shown below.',
                };
            }
            if (existing.website_id === websiteId && existing.status === 'ACTIVE') {
                throw new ConflictError('This domain is already active on your website');
            }
            throw new ConflictError('This domain is already in use by another website');
        }

        // Request ACM certificate
        if (!isHostingConfigured()) {
            throw new InternalServerError('Hosting infrastructure is not configured. Please set CLOUDFRONT_PRIMARY_DISTRIBUTION_ID.');
        }

        const certResult = await requestAcmCertificate(hostname);

        // Create Domain record with PENDING status
        const domain = await this.domainDao.create({
            website_id: websiteId,
            domain: hostname,
            type: 'CUSTOM',
            status: 'PENDING',
            is_primary: false,
            ssl_enabled: false,
            acm_certificate_arn: certResult.certificateArn,
            dns_records: {
                validation: certResult.validationRecords,
                cloudfront_domain: null,
            },
        });

        logger.info({ websiteId, hostname, certArn: certResult.certificateArn }, 'Custom domain added — awaiting DNS validation');

        return {
            domain,
            dnsValidationRecords: certResult.validationRecords,
            message: 'Add the following DNS CNAME records to verify domain ownership. Once verified, your SSL certificate will be issued automatically.',
        };
    }

    // ─── Verify Domain ──────────────────────────────────────────────────────

    /**
     * Check if the ACM certificate has been issued.
     * If issued, provision a dedicated CloudFront distribution.
     */
    async verifyDomain(domainId: string) {
        const domain = await this.domainDao.findById(domainId);
        if (!domain) throw new NotFoundError('Domain not found');
        if (domain.type !== 'CUSTOM') throw new BadRequestError('Only custom domains need verification');

        if (domain.status === 'ACTIVE') {
            return {
                verified: true,
                domain,
                message: 'Domain is already verified and active.',
            };
        }

        if (!domain.acm_certificate_arn) {
            throw new BadRequestError('Domain has no ACM certificate — please remove and re-add it');
        }

        // Check ACM certificate status
        const certStatus = await describeCertificateStatus(domain.acm_certificate_arn);

        if (certStatus.status !== 'ISSUED') {
            // Not ready yet — return current status with DNS records
            return {
                verified: false,
                certificateStatus: certStatus.status,
                dnsValidationRecords: certStatus.validationRecords,
                message: `Certificate is ${certStatus.status}. Please ensure the DNS CNAME records are correctly configured.`,
            };
        }

        // Certificate is issued! Provision CloudFront distribution.
        logger.info({ domainId, domain: domain.domain }, 'ACM certificate issued — provisioning CloudFront distribution');

        const distribution = await createDistribution(
            domain.domain,
            domain.acm_certificate_arn,
            domain.website_id,
        );

        // Update the domain record to ACTIVE
        const updatedDomain = await this.domainDao.updateStatus(domain.id, {
            status: 'ACTIVE',
            ssl_enabled: true,
            verified_at: new Date(),
            cloudfront_distribution_id: distribution.distributionId,
            cloudfront_domain_name: distribution.domainName,
            dns_records: {
                ...(domain.dns_records as object || {}),
                cloudfront_domain: distribution.domainName,
            },
        });

        // Invalidate domain cache
        await cacheService.del(`domain:${domain.domain}`).catch(() => {});

        logger.info({
            domain: domain.domain,
            distributionId: distribution.distributionId,
            cfDomain: distribution.domainName,
        }, 'Custom domain fully provisioned');

        return {
            verified: true,
            domain: updatedDomain,
            cloudfrontDomain: distribution.domainName,
            message: `Domain verified! Now point your domain's CNAME to: ${distribution.domainName}`,
        };
    }

    // ─── Remove Domain ──────────────────────────────────────────────────────

    /**
     * Remove a domain from a website.
     * - Subdomain: remove KVS entry
     * - Custom domain: disable/delete CloudFront distribution + delete ACM cert
     */
    async removeDomain(domainId: string, websiteId: string) {
        const domain = await this.domainDao.findById(domainId);
        if (!domain) throw new NotFoundError('Domain not found');
        if (domain.website_id !== websiteId) throw new NotFoundError('Domain not found');

        if (domain.type === 'SUBDOMAIN') {
            // Invalidate domain cache
            await cacheService.del(`domain:${domain.domain}`).catch(() => {});
            // Delete from database
            await this.domainDao.delete(domain.id);
            logger.info({ websiteId, domain: domain.domain }, 'Subdomain removed');
            return;
        } else if (domain.type === 'CUSTOM') {
            // Tear down CloudFront distribution (async — disabling takes time)
            if (domain.cloudfront_distribution_id) {
                await deleteDistribution(domain.cloudfront_distribution_id).catch(err => {
                    logger.error({ err, distributionId: domain.cloudfront_distribution_id }, 'Failed to disable CloudFront distribution');
                });
            }

            // Invalidate domain cache
            await cacheService.del(`domain:${domain.domain}`).catch(() => {});

            // Soft delete for background cleanup
            await this.domainDao.updateStatus(domain.id, { status: 'DELETED' });
            logger.info({ domain: domain.domain, type: domain.type }, 'Custom domain marked as DELETED for background cleanup');
        }
    }

    // ─── Certificate Polling (Cron) ─────────────────────────────────────────

    /**
     * Poll all PENDING custom domains to check if their ACM certificates
     * have been issued. If issued, auto-provision the CloudFront distribution.
     *
     * This should be called periodically (e.g. every 5 minutes).
     */
    async pollPendingCertificates() {
        const pendingDomains = await this.domainDao.findPendingCustomDomains();
        if (pendingDomains.length === 0) return;

        logger.info({ count: pendingDomains.length }, 'Polling pending ACM certificates');

        for (const domain of pendingDomains) {
            try {
                const result = await this.verifyDomain(domain.id);
                if (result.verified) {
                    logger.info({ domain: domain.domain }, 'Auto-provisioned via certificate polling');
                }
            } catch (err) {
                logger.error({ err, domain: domain.domain }, 'Certificate poll check failed');
            }
        }
    }

    /**
     * Poll all DELETED custom domains to check if their CloudFront distributions
     * have finished disabling. If disabled, delete the distribution, the ACM cert,
     * and permanently remove the domain from the database.
     */
    async cleanupDisabledDistributions() {
        const deletedDomains = await this.domainDao.findDeletedCustomDomains();
        if (deletedDomains.length === 0) return;

        logger.info({ count: deletedDomains.length }, 'Cleaning up deleted custom domains');

        for (const domain of deletedDomains) {
            try {
                // Try to delete the CloudFront distribution
                if (domain.cloudfront_distribution_id) {
                    await deleteDistribution(domain.cloudfront_distribution_id);
                }

                // If we reach here, it either didn't have one or it was successfully deleted (or is still disabling and we just wait)
                // Wait, deleteDistribution logs and doesn't throw if it's still disabling. We need to know if it actually deleted it.
                // However, if we just try to delete the ACM cert and it fails because it's still attached, that's fine. We'll catch and skip.
                if (domain.acm_certificate_arn) {
                    await deleteAcmCertificate(domain.acm_certificate_arn);
                }

                // If ACM deletion succeeds (or it didn't have one), we can hard delete from DB
                await this.domainDao.delete(domain.id);
                logger.info({ domain: domain.domain }, 'Fully cleaned up and removed DELETED domain');
            } catch (err: any) {
                // ResourceInUseException is expected if distribution is still disabling/deployed
                if (err.name === 'ResourceInUseException') {
                    logger.info({ domain: domain.domain }, 'Domain cleanup pending: Resources still in use (likely disabling)');
                } else {
                    logger.error({ err, domain: domain.domain }, 'Domain cleanup check failed');
                }
            }
        }
    }

    // ─── Cache Invalidation (called after publish/rollback) ─────────────────

    /**
     * Invalidate CloudFront cache for all distributions serving a website.
     * Called after a site is re-published or rolled back.
     */
    async invalidateCacheForWebsite(websiteId: string) {
        const domains = await this.domainDao.findByWebsiteId(websiteId);

        for (const domain of domains) {
            // Custom domains have their own CloudFront distribution
            if (domain.type === 'CUSTOM' && domain.cloudfront_distribution_id && domain.status === 'ACTIVE') {
                await createCacheInvalidation(domain.cloudfront_distribution_id, ['/*']).catch(err => {
                    logger.error({ err, domain: domain.domain }, 'Failed to invalidate custom domain cache');
                });
            }
        }

        // Primary distribution (for subdomains) — invalidate the specific site prefix
        const primaryDistId = (process.env.CLOUDFRONT_PRIMARY_DISTRIBUTION_ID || '').trim();
        if (primaryDistId) {
            await createCacheInvalidation(primaryDistId, [`/sites/${websiteId}/*`]).catch(err => {
                logger.error({ err, websiteId }, 'Failed to invalidate primary distribution cache');
            });
        }
    }
}

export default DomainService;
